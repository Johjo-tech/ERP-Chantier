/**
 * Une base qui refuse de répondre doit le DIRE.
 *
 * `chargerCollection` avalait l'erreur : un `console.error`, puis un tableau
 * vide rendu à l'écran. Il le faut — une collection en panne ne doit pas
 * emporter les quinze autres — mais l'application s'affichait alors ENTIÈRE et
 * PARFAITEMENT VIDE : « Aucun bon de commande pour cette société » sur une
 * société qui en compte trois, tous les boutons sans effet, et pas un mot.
 * Rien ne distinguait une panne d'une base réellement vide.
 *
 * Le bandeau « Supabase inaccessible » censé couvrir ce cas ne pouvait PAS
 * s'afficher : il dépendait de `hasRealStorage`, que seules les fonctions
 * `kv_store` héritées de `app.js` mettent à jour — or ce sont les versions du
 * pont qui tournent sur `window`, jamais celles-là. Le drapeau restait
 * éternellement vrai. Le commentaire de `chargerCollection` affirmait pourtant
 * que « le bandeau s'affiche » : deux erreurs qui se couvraient l'une l'autre.
 *
 * Signalé le 22/09/2026 : écran vide sur KTA, qui compte 3 bons de commande,
 * 4 devis et 4 factures, avec un compte administrateur sur les quatre
 * sociétés — ni les droits ni la RLS n'étaient en cause.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { echecsDeLecture, oublierEchecsDeLecture } from "@/integrations/html-adapter";

const APP = readFileSync(resolve(__dirname, "../pages/app.js"), "utf8");
const ADAPTATEUR = readFileSync(resolve(__dirname, "../integrations/html-adapter.ts"), "utf8");

/**
 * `noterEchecDeLecture` n'est pas exportée — c'est un détail interne. On
 * l'extrait avec sa dépendance `estSessionExpiree`, et on branche le registre
 * réel : ce qui compte est ce que `echecsDeLecture()` rendra à l'écran.
 */
function extraire(nom: string): string {
  const debut = ADAPTATEUR.indexOf(`\nfunction ${nom}(`);
  if (debut < 0) throw new Error(`\`${nom}\` introuvable dans html-adapter.ts`);
  const fin = ADAPTATEUR.indexOf("\n}", debut);
  return ADAPTATEUR.slice(debut, fin + 2)
    .replace(/: (boolean|void|string|unknown)\b/g, "")
    .replace(/\(erreur: unknown\)/, "(erreur)")
    .replace(/\(e: \{[^}]*\}\)/, "(e)")
    .replace(/\(source: string, erreur\)/, "(source, erreur)")
    .replace(/erreur as \{[^}]*\}/, "erreur");
}

const registre = new Map<string, unknown>();
const noter = new Function(
  "echecsLecture",
  `${extraire("estSessionExpiree")}\n${extraire("noterEchecDeLecture")}; return noterEchecDeLecture;`
)(registre) as (source: string, erreur: unknown) => void;

const dernier = () => [...registre.values()].at(-1) as {
  source: string;
  message: string;
  code?: string;
  sessionExpiree: boolean;
};

describe("Un refus de lecture est retenu, pas avalé", () => {
  beforeEach(() => registre.clear());

  it("retient la table et le motif", () => {
    noter("bons_commande", { code: "PGRST116", message: "quelque chose a mal tourné" });

    expect(dernier().source).toBe("bons_commande");
    expect(dernier().message).toBe("quelque chose a mal tourné");
  });

  it("préfère le détail de Postgres au message d'emballage", () => {
    noter("factures", { message: "Failed to load", details: "permission denied for table factures" });

    expect(dernier().message).toBe("permission denied for table factures");
  });

  it("reconnaît une session expirée au code de PostgREST", () => {
    noter("devis", { code: "PGRST301", message: "JWT expired" });

    expect(dernier().sessionExpiree).toBe(true);
  });

  it("la reconnaît aussi au seul message, quelle que soit la casse", () => {
    noter("devis", { message: "JWT expired" });
    expect(dernier().sessionExpiree).toBe(true);

    registre.clear();
    noter("devis", { message: "JWT is invalid" });
    expect(dernier().sessionExpiree).toBe(true);
  });

  it("ne confond pas une panne réseau avec une session expirée", () => {
    /* Les deux se réparent autrement : l'une en réessayant, l'autre en se
       reconnectant. Proposer le mauvais geste fait perdre du temps. */
    noter("clients", { message: "Failed to fetch" });

    expect(dernier().sessionExpiree).toBe(false);
  });

  it("ne garde qu'une entrée par table, la plus récente", () => {
    noter("devis", { message: "première" });
    noter("devis", { message: "seconde" });

    expect(registre.size).toBe(1);
    expect(dernier().message).toBe("seconde");
  });

  it("s'oublie sur demande", () => {
    oublierEchecsDeLecture();
    expect(echecsDeLecture()).toEqual([]);
  });
});

describe("L'écran ne se montre plus vide sans rien dire", () => {
  it("signale les échecs après chaque chargement complet", () => {
    const i = APP.indexOf("async function loadAll(){");
    const fin = APP.indexOf("\n}", i);
    expect(APP.slice(i, fin)).toContain("signalerEchecsDeChargement()");
  });

  it("propose de se reconnecter quand la session a expiré", () => {
    expect(APP).toContain("Votre session a expiré");
    expect(APP).toContain("seReconnecter()");
  });

  it("propose de réessayer quand ce n'est qu'une panne de lecture", () => {
    expect(APP).toContain("rechargerToutesLesDonnees()");
  });

  it("nomme les tables qui manquent plutôt que de rester vague", () => {
    const i = APP.indexOf("function signalerEchecsDeChargement(");
    const fin = APP.indexOf("\n}", i);
    expect(APP.slice(i, fin)).toContain("tables.join");
  });

  it("dit que ce qui est affiché est incomplet", () => {
    /* Le point qui compte pour l'utilisateur : ne pas décider sur ces
       chiffres-là. Un écran vide sans avertissement se lit « rien à faire ». */
    expect(APP).toContain("incomplet");
  });

  it("a retiré le bandeau qui ne pouvait pas s'afficher", () => {
    /* `hasRealStorage` n'est écrit que par les fonctions `kv_store` héritées,
       que le pont remplace sur `window` : elles ne tournent jamais. */
    expect(APP).not.toContain("if(!hasRealStorage){");
    expect(APP).not.toContain("noStorageBanner");
  });
});
