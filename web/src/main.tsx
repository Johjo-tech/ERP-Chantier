import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
// L'ordre compte : l'ancienne feuille, puis ce qu'elle n'a pas, puis Tailwind (en couches, donc perdant).
import "./styles/ancien.css";
import "./styles/complements.css";
import "./index.css";

const racine = document.getElementById("root");
if (!racine) throw new Error("Élément #root absent de index.html");

createRoot(racine).render(
  <StrictMode>
    <App />
  </StrictMode>
);
