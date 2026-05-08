import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log("App starting...");

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
} else {
  document.body.innerHTML = "<h1>Root element not found</h1>";
}
