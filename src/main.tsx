import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication } from "@azure/msal-browser";
import App from "./App";
import { authConfigurationError, authMode, isLocalDemoMode, msalConfig } from "./auth/authConfig";
import "./global.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("앱을 표시할 root 요소를 index.html에서 찾을 수 없습니다.");
}

const root = createRoot(container);

if (authMode === "azure-static-web-apps") {
  root.render(
    <StrictMode>
      <App configurationError={null} authMode={authMode} />
    </StrictMode>,
  );
} else if (isLocalDemoMode) {
  root.render(
    <StrictMode>
      <App configurationError={null} localDemoMode />
    </StrictMode>,
  );
} else if (authConfigurationError) {
  root.render(
    <StrictMode>
      <App configurationError={authConfigurationError} />
    </StrictMode>,
  );
} else {
  const msalInstance = new PublicClientApplication(msalConfig);

  root.render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <App configurationError={null} />
      </MsalProvider>
    </StrictMode>,
  );
}
