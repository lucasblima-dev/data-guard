import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "framer-motion";
import { Toaster } from "sonner";
import "./index.css";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("Elemento #root não encontrado");

createRoot(root).render(
  <StrictMode>
    {/* "user" respeita prefers-reduced-motion automaticamente */}
    <MotionConfig reducedMotion="user">
      <App />
      <Toaster theme="system" position="bottom-right" />
    </MotionConfig>
  </StrictMode>,
);
