import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import "./index.css";
import { App } from "./App";
import { useTheme } from "./lib/theme";

function ThemedToaster() {
  return <Toaster theme={useTheme()} position="bottom-right" />;
}

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado");

createRoot(root).render(
  <StrictMode>
    {/* "user" respeita prefers-reduced-motion automaticamente */}
    <MotionConfig reducedMotion="user">
      <App />
      <ThemedToaster />
    </MotionConfig>
  </StrictMode>,
);
