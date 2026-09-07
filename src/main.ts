/**
 * Point d'entrée de l'app.
 *
 * Substitue l'accès aux données du HTML historique (kv_store) par les tables
 * Supabase, charge le cloisonnement réel (sociétés visibles et rôle donné par
 * la base), puis débloque le démarrage. L'ordre compte : les scripts `type
 * module` sont différés, donc le HTML attend ce signal via `window.__erpBridge`
 * avant de lire quoi que ce soit.
 */

import { getCurrentSession } from "./api/client";
import { injectGlobalFunctions, viderCache } from "./integrations/html-adapter";
import { protectRoute, watchAuthState } from "./integrations/auth-guard";
import {
  chargerSession,
  injecterSession,
  roleReel,
  setIdentite,
  societeActive,
} from "./integrations/session";

interface Bridge {
  resolve: (societes: unknown) => void;
  reject: (raison: unknown) => void;
}

function bridge(): Bridge | undefined {
  return (window as unknown as { __erpBridge?: Bridge }).__erpBridge;
}

async function init() {
  try {
    if (!(await protectRoute())) return; // redirection vers /login.html

    injectGlobalFunctions();
    injecterSession();

    const session = await getCurrentSession();
    setIdentite(session?.user.email ?? "");
    console.log("📝 Connecté :", session?.user.email);

    const societes = await chargerSession();
    if (!societes.length) {
      throw new Error(
        "Ce compte n'est rattaché à aucune société. Demandez une invitation à un administrateur."
      );
    }

    console.log(
      "🏢 Sociétés :",
      societes.map((s) => `${s.id} — ${s.nom} (${s.role ?? "sans rôle"})`).join(", ")
    );
    console.log("🔑 Rôle actif :", roleReel() ?? "aucun", "sur", societeActive()?.id);

    watchAuthState(() => viderCache());

    bridge()?.resolve(societes);
  } catch (error) {
    console.error("❌ Initialisation impossible :", error);
    bridge()?.reject(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
