import logging
from typing import Any

from app.providers.base import BaseLLMProvider
from app.schemas.report import KeyInsight, ReportLLMResponse

logger = logging.getLogger(__name__)


class RulesOnlyProvider(BaseLLMProvider):
    @property
    def provider_name(self) -> str:
        return "rules_only"

    async def generate_report_synthesis(
        self,
        row_count: int,
        column_count: int,
        columns_summary: dict[str, Any],
        findings: list[dict[str, Any]],
    ) -> tuple[ReportLLMResponse, str]:
        logger.info("Executando síntese determinística baseada em regras locais...")

        insights: list[KeyInsight] = []
        recommended_actions: list[str] = []
        critical_count = 0
        warning_count = 0

        for f in findings:
            code = str(f.get("code", "UNKNOWN"))
            sev = str(f.get("severity", "info"))
            col = f.get("target_column")
            desc = str(f.get("description", ""))

            if sev == "critical":
                critical_count += 1
            elif sev == "warning":
                warning_count += 1

            if code == "DUPLICATE_ROWS":
                insights.append(
                    KeyInsight(
                        finding_code=code,
                        interpretation=(
                            "A existência de linhas redundantes pode distorcer métricas agregadas, "
                            "enviesar modelos analíticos e inflacionar o volume de armazenamento."
                        ),
                        suggested_action=(
                            "Executar rotina de deduplicação antes da ingestão e definir chaves "
                            "naturais ou primárias restritivas na base de dados de destino."
                        ),
                    )
                )
                recommended_actions.append(
                    "Aplicar deduplicação exata na camada de pré-processamento."
                )

            elif code == "CRITICAL_NULL_RATE":
                col_text = f" na coluna '{col}'" if col else ""
                insights.append(
                    KeyInsight(
                        finding_code=code,
                        interpretation=(
                            f"Identificada taxa elevada de ausência de dados{col_text}. "
                            "Valores faltantes comprometem a completude da base e exigem tratamento especial."
                        ),
                        suggested_action=(
                            f"Avaliar estratégia de imputação estatística (média/mediana/moda){col_text} "
                            "ou descartar a coluna caso ela não seja estritamente essencial."
                        ),
                    )
                )
                recommended_actions.append(
                    f"Definir política de imputação ou descarte para a coluna '{col}'." if col else
                    "Tratar atributos com concentração excessiva de dados nulos."
                )

            else:
                insights.append(
                    KeyInsight(
                        finding_code=code,
                        interpretation=f"Detecção de inconformidade: {desc}",
                        suggested_action="Inspecionar o processo de ETL responsável pela geração do dado.",
                    )
                )

        total_findings = len(findings)
        if total_findings == 0:
            summary = (
                f"O conjunto de dados analisado possui {row_count} registros distribuídos em {column_count} "
                "atributos e apresentou alto nível de integridade estrutural, sem violações críticas "
                "de conformidade ou inconsistências detectadas nas regras vigentes."
            )
            recommended_actions.append("Manter o monitoramento contínuo das próximas cargas da base.")
        else:
            summary = (
                f"A auditoria da base ({row_count} linhas e {column_count} colunas) identificou um total de "
                f"{total_findings} achados de conformidade, sendo {critical_count} com severidade crítica "
                f"e {warning_count} em nível de alerta. Recomenda-se saneamento preventivo antes de prosseguir "
                "com análises estatísticas avançadas ou treinamento de modelos de aprendizado de máquina."
            )

        limitations = [
            "A análise foi efetuada estritamente sobre a fotografia do arquivo submetido.",
            "Não foram aplicadas validações semânticas de negócio externas à tipagem estrutural.",
            "Síntese gerada via motor heurístico determinístico (modo rules_only).",
        ]

        unique_actions = list(dict.fromkeys(recommended_actions))

        response = ReportLLMResponse(
            executive_summary=summary,
            key_insights=insights,
            recommended_actions=unique_actions,
            limitations=limitations,
        )

        return response, "rules_only"
