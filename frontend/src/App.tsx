import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { HistoryPage } from "./features/history/HistoryPage";
import { UploadPage } from "./features/upload/UploadPage";
import { PagePlaceholder } from "./components/layout/PagePlaceholder";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HistoryPage />} />
          <Route path="upload" element={<UploadPage />} />
          <Route
            path="analyses/:id"
            element={<PagePlaceholder title="Diagnóstico" description="Status, qualidade e relatório da análise." />}
          />
          <Route path="*" element={<PagePlaceholder title="Página não encontrada" description="O endereço não existe." />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
