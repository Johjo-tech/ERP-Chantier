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
import { injectGlobalFunctions } from "./integrations/html-adapter";
import { protectRoute, watchAuthState } from "./integrations/auth-guard";

async function init() {
  console.log("🚀 ERP Chantier initializing...");

  try {
    // 0️⃣ PROTECTION: Vérifier l'authentification
    const isAuthenticated = await protectRoute();
    if (!isAuthenticated) return;

    // 1️⃣ Injecter les fonctions globales pour le HTML
    // Remplace: stGet/stSet/stDelete/stListKeys (kv_store → Supabase)
    injectGlobalFunctions();

    // 2️⃣ Afficher la session Supabase
    const session = await getCurrentSession();
    if (session) {
      console.log("📝 ✅ User:", session.user.email);
    }

    // 3️⃣ S'abonner aux changements d'auth (déconnexion)
    watchAuthState(() => {
      console.log("👋 User signed out");
    });

    // 4️⃣ HTML peut maintenant utiliser:
    // - stGet/stSet (→ Supabase tables)
    // - stDelete/stListKeys
    // - nextNumero/nextSAVNumero (→ Supabase RPC)
    // - loadAllData/exportAllData/importAllData
    // SANS AUCUNE MODIFICATION!

    console.log("✅ ERP Chantier ready");
  } catch (error) {
    console.error("❌ Init failed:", error);
    throw error;
  }
}

// Lancer au démarrage
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
