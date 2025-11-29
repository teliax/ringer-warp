import React from "react";
import * as ReactDOM from "react-dom";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "./lib/auth/AuthContext";
import App from "./App";
import "./index.css";
import "./lib/axios-config"; // Configure axios globally

// Make React and ReactDOM globally available immediately (not in useEffect)
window.React = React;
window.ReactDOM = ReactDOM;

function Main() {
  return (
    <React.StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </React.StrictMode>
  );
}

const root = createRoot(document.getElementById("root") as HTMLElement);
root.render(<Main />);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
