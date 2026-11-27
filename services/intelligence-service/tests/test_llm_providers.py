import json
import unittest
from unittest.mock import AsyncMock, patch

import httpx

from app.api.v1.reports import probe_llm_provider
from app.config import Settings, settings
from app.providers.base import parse_llm_json_response
from app.providers.dispatcher import ReportDispatcher
from app.providers.huggingface import HuggingFaceProvider
from app.providers.ollama import OllamaProvider


class TestLLMProviders(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self._orig_enabled = settings.LLM_ENABLED
        self._orig_provider = settings.LLM_PROVIDER
        self._orig_token = settings.HF_TOKEN
        self._orig_model = settings.HF_MODEL_ID
        self._orig_api_url = settings.HF_API_URL
        self._orig_ollama_url = settings.OLLAMA_BASE_URL
        self._orig_ollama_model = settings.OLLAMA_MODEL
        self._orig_messaging = settings.MESSAGING_ENABLED

    def tearDown(self) -> None:
        settings.LLM_ENABLED = self._orig_enabled
        settings.LLM_PROVIDER = self._orig_provider
        settings.HF_TOKEN = self._orig_token
        settings.HF_MODEL_ID = self._orig_model
        settings.HF_API_URL = self._orig_api_url
        settings.OLLAMA_BASE_URL = self._orig_ollama_url
        settings.OLLAMA_MODEL = self._orig_ollama_model
        settings.MESSAGING_ENABLED = self._orig_messaging

    def test_config_sanitizes_token_and_legacy_hf_url(self) -> None:
        cfg = Settings(
            HF_TOKEN='"SEU_TOKEN_AQUI"',
            HF_API_URL="https://router.huggingface.co/hf-inference/v1/chat/completions",
        )
        self.assertEqual(cfg.HF_TOKEN, "")
        self.assertEqual(cfg.HF_API_URL, "https://router.huggingface.co/v1/chat/completions")

        cfg_valid = Settings(HF_TOKEN=' "hf_realToken123" ')
        self.assertEqual(cfg_valid.HF_TOKEN, "hf_realToken123")

    def test_parse_llm_json_response_handles_markdown_and_think_blocks(self) -> None:
        raw = (
            "<think>Raciocinando sobre os achados...</think>\n"
            "Aqui está o diagnóstico solicitado:\n"
            "```json\n"
            "{\n"
            '  "executive_summary": "Base com 16% de duplicidade e nulos críticos em email.",\n'
            '  "key_insights": [\n'
            "    {\n"
            '      "finding_code": "DUPLICATE_ROWS",\n'
            '  "interpretation": "Risco de distorção em contagens.",\n'
            '      "suggested_action": "Deduplicar por chave primária."\n'
            "    }\n"
            "  ],\n"
            '  "recommended_actions": ["Implementar constraint UNIQUE"],\n'
            '  "limitations": ["Análise estática sobre amostra CSV"]\n'
            "}\n"
            "```"
        )
        parsed = parse_llm_json_response(raw)
        self.assertIn("duplicidade", parsed.executive_summary)
        self.assertEqual(len(parsed.key_insights), 1)
        self.assertEqual(parsed.key_insights[0].finding_code, "DUPLICATE_ROWS")
        self.assertEqual(parsed.recommended_actions, ["Implementar constraint UNIQUE"])

    async def test_huggingface_provider_chat_completions_success(self) -> None:
        settings.HF_TOKEN = "hf_test_token"
        settings.HF_MODEL_ID = "Qwen/Qwen2.5-7B-Instruct"
        settings.HF_API_URL = "https://router.huggingface.co/v1/chat/completions"

        llm_json = {
            "executive_summary": "Síntese gerada via Hugging Face Router.",
            "key_insights": [
                {
                    "finding_code": "CRITICAL_NULL_RATE",
                    "interpretation": "40% dos registros não possuem email.",
                    "suggested_action": "Tornar campo obrigatório no formulário.",
                }
            ],
            "recommended_actions": ["Validar emails na entrada"],
            "limitations": ["Sem validação de domínio MX"],
        }
        mock_response = httpx.Response(
            200,
            json={"choices": [{"message": {"role": "assistant", "content": json.dumps(llm_json)}}]},
        )

        with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=mock_response)) as mock_post:
            provider = HuggingFaceProvider()
            result, mode = await provider.generate_report_synthesis(
                row_count=100,
                column_count=2,
                columns_summary={"email": {"null_percentage": 40.0}},
                findings=[{"code": "CRITICAL_NULL_RATE", "severity": "warning"}],
            )

        self.assertEqual(mode, "llm_assisted")
        self.assertEqual(result.executive_summary, "Síntese gerada via Hugging Face Router.")
        self.assertEqual(result.key_insights[0].finding_code, "CRITICAL_NULL_RATE")
        called_kwargs = mock_post.call_args.kwargs
        self.assertEqual(called_kwargs["json"]["model"], "Qwen/Qwen2.5-7B-Instruct")
        self.assertEqual(called_kwargs["json"]["messages"][0]["role"], "system")

    async def test_ollama_provider_chat_json_success(self) -> None:
        settings.OLLAMA_BASE_URL = "http://localhost:11434"
        settings.OLLAMA_MODEL = "qwen2.5:7b"

        llm_json = {
            "executive_summary": "Síntese gerada localmente via Ollama.",
            "key_insights": [
                {
                    "finding_code": "DUPLICATE_ROWS",
                    "interpretation": "Duplicatas exatas encontradas.",
                    "suggested_action": "Executar deduplicação no staging.",
                }
            ],
            "recommended_actions": ["Revisar ingestão"],
            "limitations": ["Apenas fotografia estática"],
        }
        mock_response = httpx.Response(
            200,
            json={"message": {"role": "assistant", "content": json.dumps(llm_json)}},
        )

        with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=mock_response)) as mock_post:
            provider = OllamaProvider()
            result, mode = await provider.generate_report_synthesis(
                row_count=50,
                column_count=3,
                columns_summary={},
                findings=[{"code": "DUPLICATE_ROWS", "severity": "critical"}],
            )

        self.assertEqual(mode, "llm_assisted")
        self.assertEqual(result.executive_summary, "Síntese gerada localmente via Ollama.")
        self.assertEqual(mock_post.call_args.kwargs["json"]["format"], "json")

    async def test_dispatcher_falls_back_to_rules_on_rate_limit(self) -> None:
        settings.LLM_ENABLED = True
        settings.LLM_PROVIDER = "huggingface"
        settings.HF_TOKEN = "hf_test_token"

        mock_429 = httpx.Response(429, text="Rate limit")
        with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=mock_429)):
            dispatcher = ReportDispatcher()
            result, mode = await dispatcher.synthesize(
                row_count=20,
                column_count=2,
                columns_summary={},
                findings=[{"code": "DUPLICATE_ROWS", "severity": "warning", "description": "2 duplicatas"}],
            )

        self.assertEqual(mode, "rules_only")
        self.assertEqual(result.key_insights[0].finding_code, "DUPLICATE_ROWS")

    async def test_probe_endpoint_reports_fallback_reason_when_token_missing(self) -> None:
        settings.LLM_ENABLED = True
        settings.LLM_PROVIDER = "huggingface"
        settings.HF_TOKEN = ""
        settings.MESSAGING_ENABLED = False

        resp = await probe_llm_provider()

        self.assertFalse(resp.direct_provider_ok)
        self.assertEqual(resp.generation_mode, "rules_only")
        self.assertIn("HF_TOKEN", resp.error_detail or "")


if __name__ == "__main__":
    unittest.main()
