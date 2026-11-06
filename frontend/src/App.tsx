import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { HistoryPage } from "./features/history/HistoryPage";
import { AnalysisPage } from "./features/status/AnalysisPage";
import { UploadPage } from "./features/upload/UploadPage";
import { PagePlaceholder } from "./components/layout/PagePlaceholder";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HistoryPage />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="analyses/:id" element={<AnalysisPage />} />
          <Route path="*" element={<PagePlaceholder title="Página não encontrada" description="O endereço não existe." />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
