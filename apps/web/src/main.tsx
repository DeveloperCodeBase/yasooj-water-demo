import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/600.css";
import "./styles/globals.css";
import { App } from "./app/App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
