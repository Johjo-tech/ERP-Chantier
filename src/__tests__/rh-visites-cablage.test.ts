/**
 * Le module du registre reçoit bien tout ce dont il a besoin.
 *
 * `rh-visites.js` est sorti d'`app.js` pour tenir le monolithe sous le seuil
 * d'analyse de Semgrep. Il ne connaît plus l'application : elle lui prête
 * treize noms par `installerRhVisites`, une fois au chargement.
 *
 * D'où le risque propre à ce découpage : un nom oublié dans cette liste ne se
 * voit NULLE PART avant le clic. Le contrôle de types de l'écran est souple,
 * les autres tests extraient les fonctions une à une en leur passant des
 * doublures, et le build ne regarde que les noms publiés sur `window`. Le
 * ReferenceError attendrait l'utilisateur.
 *
 * Ce banc charge donc le module POUR DE VRAI, avec un faux navigateur, et fait
 * tourner tout ce que la fiche salarié et l'onglet Visites médicales appellent.
 * Ce qui manquerait à l'injection rougit ici.
 */

import { describe, it, expect, beforeAll } from "vitest";

/* L'environnement des tests est `node` : ni `window`, ni `document`. Le module
   les lit au moment de l'appel, jamais à l'import — c'est ce qui permet de les
   poser ici. */
const champs: Record<string, { value: string; files?: unknown[] }> = {};

interface ModuleVisites {
  installerRhVisites: (contexte: Record<string, unknown>) => void;
  visitesMedicalesHTML: (salarie: { id?: string }) => string;
  badgeVisiteMedicaleListe: (id: string) => string;
  pastilleVisiteRh: (id: string) => string;
  conformiteRhDuSalarie: (id: string) => { complet: boolean };
  renderRHVisites: () => string;
  visitesRhPretes: () => boolean;
  cleRegistreVisites: (salarie: { id?: string }) => string;
  resynchroniserDatesVisite: (id: string) => void;
  rafraichirZoneVisites: () => void;
}

let M: ModuleVisites;
let state: Record<string, any>;

beforeAll(async () => {
  /* Le pont que `src/integrations` pose sur `window` : les règles du suivi
     médical, réduites à ce que l'affichage consulte. */
  (globalThis as any).window = {
    typeVisite: (c: string) => ({ code: c, libelle: "Visite périodique", icone: "🩺" }),
    avisAptitude: (c: string) => (c ? { code: c, libelle: "Apte", gravite: "ok" } : null),
    regimeSuivi: (c: string) => ({ code: c, libelle: "Suivi simple", plafondMois: 60, reference: "art. R.4624-16" }),
    etatVisite: () => ({ etat: "inconnue", jours: null }),
    trierVisites: (v: unknown[]) => v,
    derniereVisite: (v: unknown[]) => v[0] ?? null,
    prochaineVisiteSuggeree: () => null,
    depasseLePlafondLegal: () => false,
    TYPES_VISITE: [{ code: "embauche", libelle: "Visite d'embauche", icone: "🧾" }],
    REGIMES_SUIVI: [{ code: "simple", libelle: "Suivi simple" }],
    AVIS_APTITUDE: [{ code: "apte", libelle: "Apte" }],
  };
  (globalThis as any).document = { getElementById: (id: string) => champs[id] ?? null };
  (globalThis as any).confirm = () => false;

  /* Import dynamique : un import statique serait hissé au-dessus des globales
     ci-dessus, et le module publierait sur un `window` qui n'existe pas.

     `@ts-expect-error` assumé : les modules d'écran sont hors de la couche
     stricte — `tsconfig.json` ne les compile pas, et c'est `tsconfig.ecran.json`
     qui les relit en mode souple. D'où l'interface `ModuleVisites` ci-dessus,
     écrite à la main : elle dit ce que ce banc attend, et rien de plus. */
  // @ts-expect-error — module JavaScript sans déclaration, à dessein
  M = (await import("../pages/rh-visites.js")) as unknown as ModuleVisites;

  state = {
    salaries: [{ id: "s1", societeId: "soc", nom: "Benali", prenom: "Karim",
                 visiteMedicaleDate: null, visiteMedicaleProchaine: null }],
    visitesRh: [], visitesRhCharges: true, visitesRhSociete: "soc", societeId: "soc",
    editing: { id: "s1" }, formOpen: { salarie: true },
    rhVisiteForm: null, rhVisiteFiltre: "", rhVisiteSalarieId: null,
  };

  M.installerRhVisites({
    state,
    esc: (s: unknown) => String(s ?? ""),
    fmtDate: (d: string) => d || "—",
    jsAttr: (s: unknown) => String(s ?? ""),
    renderTab: () => {},
    showToast: () => {},
    recharger: async () => {},
    todayISO: () => "2026-09-23",
    uid: () => "k1",
    openAttachmentPreview: () => {},
    reglagesCourants: () => ({ seuils: { visiteMedicale: 45 } }),
    dossierDuSalarie: () => ({ complet: true, manquants: [] }),
    refusDocumentRh: (e: unknown) => String(e),
  });
});

describe("Ce que la fiche salarié appelle dans le module", () => {
  it("rend le registre d'un salarié enregistré", () => {
    state.editing = { id: "s1" };
    expect(M.visitesMedicalesHTML({ id: "s1" })).toContain("Enregistrer une visite");
  });

  it("rend le registre d'une fiche pas encore enregistrée", () => {
    /* Le cas ajouté le 22/09 : la section était masquée en bloc, et le texte
       du champ renvoyait vers un registre « ci-dessous » inexistant. */
    state.editing = { id: undefined };
    const neuve = M.visitesMedicalesHTML({ id: undefined });
    expect(neuve).toContain("Enregistrer une visite");
    /* La sentinelle, et non la chaîne « undefined » que `jsAttr` produirait
       d'un identifiant absent — sans elle le panneau s'ouvre sans s'afficher. */
    expect(neuve).toContain("__salarie_en_creation__");
  });

  it("répond sur toutes les entrées de la fiche et de l'onglet", () => {
    state.editing = { id: "s1" };
    const appels: [string, () => unknown][] = [
      ["badgeVisiteMedicaleListe", () => M.badgeVisiteMedicaleListe("s1")],
      ["pastilleVisiteRh", () => M.pastilleVisiteRh("s1")],
      ["conformiteRhDuSalarie", () => M.conformiteRhDuSalarie("s1")],
      ["renderRHVisites", () => M.renderRHVisites()],
      ["visitesRhPretes", () => M.visitesRhPretes()],
      ["cleRegistreVisites", () => M.cleRegistreVisites({ id: undefined })],
      ["resynchroniserDatesVisite", () => M.resynchroniserDatesVisite("s1")],
      ["rafraichirZoneVisites", () => M.rafraichirZoneVisites()],
    ];
    const fautifs = appels
      .map(([nom, fn]) => { try { fn(); return null; } catch (e) { return `${nom} → ${(e as Error).message}`; } })
      .filter(Boolean);

    expect(
      fautifs,
      `Ces appels lèvent une erreur : un nom manque à \`installerRhVisites\`, ` +
        `et l'utilisateur ne le verrait qu'au clic.`,
    ).toEqual([]);
  });

  it("publie sur window ce que ses propres attributs appellent", () => {
    /* Le module rend son HTML en chaînes : `onclick="…"` résout le nom sur
       `window` au moment du clic, jamais avant. */
    const w = (globalThis as any).window as Record<string, unknown>;
    for (const nom of ["ouvrirFormVisiteRh", "enregistrerVisiteRh", "supprimerVisiteRhEcran",
                       "fermerFormVisiteRh", "ouvrirFormVisiteRhEnAttente", "retirerVisiteEnAttente",
                       "ouvrirRegistreVisites", "filtrerVisitesRh"]) {
      expect(typeof w[nom], `${nom} n'est pas publié`).toBe("function");
    }
  });

  it("ouvre le panneau de saisie sur une fiche neuve", () => {
    const w = (globalThis as any).window as Record<string, any>;
    state.editing = { id: undefined };
    state.rhVisiteForm = null;
    w.ouvrirFormVisiteRh("__salarie_en_creation__");

    expect(state.rhVisiteForm).not.toBeNull();
    /* Sans visite au registre, c'est une embauche : le type par défaut le dit. */
    expect(state.rhVisiteForm.type).toBe("embauche");
    expect(w.formVisiteRhHTML()).toContain("visRh_dateVisite");
  });
});
