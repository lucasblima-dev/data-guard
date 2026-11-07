/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base da API publica do analysis-service, ex.: http://localhost:8000/api */
  readonly VITE_API_URL?: string;
  /** "false" desliga os mocks de upload/relatorio (padrao: ligados). */
  readonly VITE_USE_MOCKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
