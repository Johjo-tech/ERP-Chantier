import type { Page } from "@playwright/test";
import { ecransParcRh } from "./ecrans-parc-rh";

/**
 * La table de correspondance « écran ancien ↔ route nouvelle ».
 *
 * L'ancienne application est une page unique à onglets : on y arrive par la
 * racine, puis par des GESTES (l'onglet, le sous-onglet, un filtre). La
 * nouvelle a des routes. Chaque entrée dit comment atteindre le même écran des
 * deux côtés, avec le même compte, et quel écart on tolère encore.
 *
 * Les seuils sont des cliquets : on les ABAISSE à mesure qu'un écran est refait,
 * jamais on ne les relève pour faire passer un écran qui s'est dégradé.
 * `aFaire` marque un écran que la vague « socle » n'a pas repris : son seuil
 * est l'écart constaté, pour qu'il ne puisse pas empirer en attendant.
 */

export type App = "ancien" | "nouveau";
export type Taille = "bureau" | "mobile";
export type Compte = "admin" | "secretaire" | "conducteur" | "technicien" | "lecture" | "soustraitant";

export const COMPTES: Record<Compte, string> = {
  admin: "admin.alpha@erp.local",
  secretaire: "secretaire.alpha@erp.local",
  conducteur: "conducteur.alpha@erp.local",
  technicien: "technicien.alpha@erp.local",
  lecture: "lecture.alpha@erp.local",
  soustraitant: "soustraitant.alpha@erp.local",
};

type Geste = (page: Page) => Promise<void>;

interface Cote {
  /** Chemin chargé en premier (l'ancien : `/` ou `/login.html`). */
  chemin: string;
  /** Ce qu'on fait ensuite pour atteindre l'écran. */
  gestes?: Geste;
}

/** Ratio de pixels différents (0 à 1) et nombre de lignes de texte manquantes + ajoutées. */
export interface Seuils {
  pixels: number;
  texte: number;
}

export interface Ecran {
  id: string;
  titre: string;
  /** `null` : l'écran se voit sans être connecté (connexion, mot de passe oublié). */
  compte: Compte | null;
  ancien: Cote;
  nouveau: Cote;
  seuils: Partial<Record<Taille, Seuils>>;
  /** Sélecteurs masqués des deux côtés : ce qui change d'une seconde à l'autre (« il y a 3 min »). */
  masques?: readonly string[];
  aFaire?: string;
}

/** Un onglet de l'ancienne application, avec l'état qu'il lit (sous-vue, filtre). */
function onglet(id: string, etat: Record<string, unknown> = {}): Geste {
  return async (page) => {
    await page.evaluate(
      ([o, e]) => {
        const w = window as unknown as { state: Record<string, unknown>; setTab: (t: string) => void; renderTab: () => void };
        Object.assign(w.state, e);
        if (w.state.tab === o) w.renderTab();
        else w.setTab(o);
      },
      [id, etat] as const
    );
  };
}

const motDePasseOublie: Geste = async (page) => {
  await page.getByRole("button", { name: /mot de passe oubli/i }).click({ timeout: 5_000 });
};

const ouvrirMenu: Geste = async (page) => {
  await page.click(".planning-menu-toggle", { timeout: 5_000 });
};

/** Un clic sur ce que désigne le sélecteur, le même des deux côtés : c'est tout l'intérêt d'avoir repris le HTML. */
function cliquer(...selecteurs: string[]): Geste {
  return async (page) => {
    for (const s of selecteurs) await page.click(s, { timeout: 5_000 });
  };
}

/** Les deux tailles, avec le même seuil : la plupart des écrans. */
function partout(pixels: number, texte: number): Partial<Record<Taille, Seuils>> {
  return { bureau: { pixels, texte }, mobile: { pixels, texte } };
}

/**
 * L'écart constaté sur chaque écran de module à la fin de la vague « socle »
 * (bureau seulement ; « Plus » sur téléphone) : pixels arrondis au centième
 * au-dessus (+0,5 point), texte + 3 lignes — la base locale est partagée, ses
 * données bougent. Ce sont des plafonds, pas des cibles : la vague suivante
 * les ramène vers zéro, écran par écran.
 */
const SEUILS_MODULES: Record<string, Partial<Record<Taille, Seuils>>> = {
  "bons-de-commande": { bureau: { pixels: 0.37, texte: 79 } },
  catalogue: { bureau: { pixels: 0.11, texte: 21 } },
  chantiers: { bureau: { pixels: 0.16, texte: 33 } },
  clients: { bureau: { pixels: 0.3, texte: 29 } },
  devis: { bureau: { pixels: 0.27, texte: 41 } },
  factures: { bureau: { pixels: 0.44, texte: 76 } },
  "factures-a-facturer": { bureau: { pixels: 0.09, texte: 40 } },
  "factures-avoirs": { bureau: { pixels: 0.14, texte: 34 } },
  "factures-reglements": { bureau: { pixels: 0.27, texte: 21 } },
  "factures-validation": { bureau: { pixels: 0.05, texte: 36 } },
  // Repris (D-ECR-PAR-02) : identique sur le jeu `jeux/parc-rh.sql`.
  materiel: { bureau: { pixels: 0.001, texte: 0 } },
  "pieces-en-commande": { bureau: { pixels: 0.17, texte: 31 } },
  planning: { bureau: { pixels: 0.55, texte: 46 } },
  rapports: { bureau: { pixels: 0.03, texte: 7 } },
  // Repris : le groupe « Accès » du rail (D-ECR-PAR-08) et la carte des jours fériés (D-ECR-PAR-10).
  reglages: { bureau: { pixels: 0.001, texte: 10 } },
  rh: { bureau: { pixels: 0.001, texte: 0 } },
  // Repris (D-ECR-PAR-13). Reste la ligne « Sans conducteur » et les comptes par la référence (D-STA-05),
  // qui décalent graphiques et tableau, la plage libre et les vues par métier / par client repliées.
  statistiques: { bureau: { pixels: 0.28, texte: 24 } },
  vehicules: { bureau: { pixels: 0.001, texte: 0 } },
};

const TEMPS_RELATIF = [".activity-time"] as const;

/**
 * Le tableau de bord de pilotage : ce qui change d'une seconde à l'autre, et le
 * classement des clients — groupé par FICHE ici, par nom écrit sur la facture
 * dans l'ancien (D-STA-05) : sur la même base, les deux listes n'ont ni les
 * mêmes lignes ni le même nombre. Le reste de l'écran se compare.
 */
const PILOTAGE = [...TEMPS_RELATIF, ".topclient-card"] as const;

/**
 * Ce qui reste d'écart DÉCIDÉ sur le pilotage : la première tuile (« Encaissé
 * ce mois (TTC) », D-STA-04, 2 lignes), le restant dû lu sur le solde de la
 * base (D-STA-11, 2 lignes) et la ligne « CA encaissé » que le résumé ne
 * répète plus (D-STA-11, 2 lignes).
 */
const ECART_DECIDE_PILOTAGE = 6;

export const ECRANS: readonly Ecran[] = [
  // ── Le cadre ─────────────────────────────────────────────────────────────
  {
    id: "connexion",
    titre: "Connexion",
    compte: null,
    ancien: { chemin: "/login.html" },
    nouveau: { chemin: "/connexion" },
    seuils: partout(0.001, 0),
  },
  {
    id: "mot-de-passe-oublie",
    titre: "Connexion › Mot de passe oublié (adresse vide)",
    compte: null,
    ancien: { chemin: "/login.html", gestes: motDePasseOublie },
    nouveau: { chemin: "/connexion", gestes: motDePasseOublie },
    seuils: partout(0.001, 0),
  },
  {
    id: "menu-ouvert",
    titre: "Cadre › menu latéral ouvert (administrateur)",
    compte: "admin",
    ancien: { chemin: "/", gestes: ouvrirMenu },
    nouveau: { chemin: "/", gestes: ouvrirMenu },
    seuils: { bureau: { pixels: 0.002, texte: ECART_DECIDE_PILOTAGE } },
    masques: PILOTAGE,
  },
  {
    id: "menu-utilisateur",
    titre: "Cadre › menu du nom ouvert (« Voir en tant que »)",
    compte: "admin",
    ancien: { chemin: "/", gestes: cliquer(".planning-menu-toggle", "#sidebar .user-menu-btn") },
    nouveau: { chemin: "/", gestes: cliquer(".planning-menu-toggle", "#sidebar .user-menu-btn") },
    // « Mon compte » : ouvert à tous les rôles depuis ce menu (AUTH-17, D-SOC-06), 1 ligne de plus.
    seuils: { bureau: { pixels: 0.008, texte: ECART_DECIDE_PILOTAGE + 2 } },
    // La version construite diffère forcément : deux constructions, deux commits.
    masques: [...PILOTAGE, ".user-menu-version"],
  },
  {
    id: "menu-societe",
    titre: "Cadre › sélecteur de société ouvert",
    compte: "admin",
    ancien: { chemin: "/", gestes: cliquer("#deskTopStrip .societe-btn") },
    nouveau: { chemin: "/", gestes: cliquer("#deskTopStrip .societe-btn") },
    seuils: { bureau: { pixels: 0.002, texte: ECART_DECIDE_PILOTAGE } },
    masques: PILOTAGE,
  },
  {
    id: "cloche",
    titre: "Cadre › cloche des notifications ouverte",
    compte: "admin",
    ancien: { chemin: "/", gestes: cliquer("#deskTopStrip .notif-bell-btn") },
    nouveau: { chemin: "/", gestes: cliquer("#deskTopStrip .notif-bell-btn") },
    seuils: { bureau: { pixels: 0.002, texte: ECART_DECIDE_PILOTAGE } },
    masques: PILOTAGE,
  },
  {
    id: "plus",
    titre: "Cadre › « Plus » de la barre du bas (téléphone)",
    compte: "admin",
    ancien: { chemin: "/", gestes: onglet("plus", { plusTab: "clients" }) },
    nouveau: { chemin: "/plus" },
    seuils: { mobile: { pixels: 0.43, texte: 29 } },
    aFaire: "Le cadre est repris ; la liste des clients dessous est un écran de module.",
  },
  // ── Les trois tableaux de bord ───────────────────────────────────────────
  {
    id: "tableau-de-bord-pilotage",
    titre: "Tableau de bord › pilotage (administrateur)",
    compte: "admin",
    ancien: { chemin: "/" },
    nouveau: { chemin: "/" },
    seuils: { bureau: { pixels: 0.002, texte: ECART_DECIDE_PILOTAGE }, mobile: { pixels: 0.004, texte: ECART_DECIDE_PILOTAGE } },
    masques: PILOTAGE,
  },
  {
    id: "tableau-de-bord-conducteur",
    titre: "Tableau de bord › conducteur de travaux",
    compte: "conducteur",
    ancien: { chemin: "/" },
    nouveau: { chemin: "/" },
    seuils: partout(0.001, 0),
  },
  {
    id: "tableau-de-bord-terrain",
    titre: "Tableau de bord › terrain (technicien)",
    compte: "technicien",
    ancien: { chemin: "/" },
    nouveau: { chemin: "/" },
    // Le compte d'essai n'a pas d'équipe : les deux montrent alors tout (D-VIS-09).
    seuils: partout(0.001, 0),
  },
  // ── Les écrans des modules (vague suivante) ─────────────────────────────
  ...ecransModules(),
  ...ecransParcRh({ onglet, cliquer, partout }),
];

interface Module {
  id: string;
  titre: string;
  onglet: string;
  etat?: Record<string, unknown>;
  route: string;
}

/** Les listes principales, telles que le menu les ouvre. Seuils : l'écart constaté (cliquet). */
function ecransModules(): Ecran[] {
  const modules: Module[] = [
    { id: "bons-de-commande", titre: "Bons de commande", onglet: "bonsCommande", route: "/commandes" },
    { id: "devis", titre: "Devis", onglet: "devis", route: "/devis" },
    { id: "factures", titre: "Factures › liste", onglet: "factures", etat: { facturesView: "liste" }, route: "/factures" },
    { id: "factures-avoirs", titre: "Factures › Avoirs", onglet: "factures", etat: { facturesView: "avoirs" }, route: "/factures/avoirs" },
    { id: "factures-validation", titre: "Factures › Validation", onglet: "factures", etat: { facturesView: "validation" }, route: "/facturation/validation" },
    { id: "factures-a-facturer", titre: "Factures › À facturer", onglet: "factures", etat: { facturesView: "afacturer" }, route: "/facturation/a-facturer" },
    { id: "factures-reglements", titre: "Factures › Règlements", onglet: "factures", etat: { facturesView: "reglements" }, route: "/factures/reglements" },
    { id: "rapports", titre: "Rapports", onglet: "interventions", route: "/rapports" },
    { id: "planning", titre: "Planning", onglet: "planning", route: "/planning" },
    { id: "chantiers", titre: "Chantiers", onglet: "chantiers", route: "/chantiers" },
    { id: "clients", titre: "Clients", onglet: "clients", route: "/clients" },
    { id: "catalogue", titre: "Catalogue", onglet: "catalogue", route: "/articles" },
    { id: "rh", titre: "RH", onglet: "rh", route: "/rh" },
    { id: "vehicules", titre: "Véhicules", onglet: "vehicules", route: "/vehicules" },
    { id: "materiel", titre: "Matériel", onglet: "materiel", route: "/materiel" },
    { id: "pieces-en-commande", titre: "Pièces en commande", onglet: "piecesCommande", route: "/pieces" },
    { id: "statistiques", titre: "Statistiques", onglet: "statistiques", route: "/statistiques" },
    { id: "reglages", titre: "Réglages", onglet: "parametres", route: "/reglages" },
  ];
  return modules.map((m) => ({
    id: m.id,
    titre: m.titre,
    compte: "admin",
    ancien: { chemin: "/", gestes: onglet(m.onglet, m.etat) },
    nouveau: { chemin: m.route },
    seuils: SEUILS_MODULES[m.id] ?? { bureau: { pixels: 1, texte: 10_000 } },
    aFaire: "Écran de module : repris à la vague suivante.",
  }));
}
