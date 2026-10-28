import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DescentTestApp } from "./DescentTestApp";
import { isDescentTestEnabled } from "./descentGate";
import "../global.css";

const container = document.getElementById("root");
if (!container) throw new Error("내려오기 테스트를 표시할 root 요소를 찾을 수 없습니다.");
createRoot(container).render(
  <StrictMode><DescentTestApp enabled={isDescentTestEnabled(import.meta.env)} /></StrictMode>,
);
