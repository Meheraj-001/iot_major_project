import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider, App as AntApp } from "antd";
import "antd/dist/reset.css";
import "./index.css";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConfigProvider
        theme={{
        token: {
          colorPrimary: "#2563eb",
          borderRadius: 14,
          fontFamily:
            "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        },
        components: {
          Card: {
            borderRadiusLG: 20,
          },
          Button: {
            borderRadius: 12,
            controlHeight: 40,
          },
          Table: {
            borderRadiusLG: 16,
          },
        },
      }}
    >
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
    </ErrorBoundary>
  </React.StrictMode>
);