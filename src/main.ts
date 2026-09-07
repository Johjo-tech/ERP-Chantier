/**
 * ERP Chantier - Point d'entrée
 *
 * Initialise:
 * - Supabase client
 * - Session/Auth
 * - Listeners temps-réel
 * - Branchement HTML
 */

import { supabase, getCurrentSession } from "./api/client";

async function init() {
  console.log("🚀 ERP Chantier initializing...");

  try {
    // Vérifier la session Supabase
    const session = await getCurrentSession();
    console.log("📝 Session:", session ? "Authenticated" : "Anonymous");

    // TODO: Initialiser l'app HTML avec l'API Supabase
    // const app = initApp(session);

    console.log("✅ ERP Chantier ready");
  } catch (error) {
    console.error("❌ Init failed:", error);
  }
}

// Lancer au démarrage
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
