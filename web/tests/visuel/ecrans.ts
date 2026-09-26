import type { Page } from "@playwright/test";
import { ecransChantiersClientsCatalogue } from "./ecrans-chantiers";

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
export function onglet(id: string, etat: Record<string, unknown> = {}): Geste {
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
export function cliquer(...selecteurs: string[]): Geste {
  return async (page) => {
    for (const s of selecteurs) await page.click(s, { timeout: 5_000 });
  };
}

/** Les deux tailles, avec le même seuil : la plupart des écrans. */
export function partout(pixels: number, texte: number): Partial<Record<Taille, Seuils>> {
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
  devis: { bureau: { pixels: 0.27, texte: 41 } },
  factures: { bureau: { pixels: 0.44, texte: 76 } },
  "factures-a-facturer": { bureau: { pixels: 0.09, texte: 40 } },
  "factures-avoirs": { bureau: { pixels: 0.14, texte: 34 } },
  "factures-reglements": { bureau: { pixels: 0.27, texte: 21 } },
  "factures-validation": { bureau: { pixels: 0.05, texte: 36 } },
  materiel: { bureau: { pixels: 0.02, texte: 6 } },
  planning: { bureau: { pixels: 0.55, texte: 46 } },
  rapports: { bureau: { pixels: 0.03, texte: 7 } },
  reglages: { bureau: { pixels: 0.51, texte: 86 } },
  rh: { bureau: { pixels: 0.08, texte: 4 } },
  statistiques: { bureau: { pixels: 0.33, texte: 50 } },
  vehicules: { bureau: { pixels: 0.03, texte: 5 } },
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
    seuils: { mobile: { pixels: 0.001, texte: 0 } },
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
  // ── Bons de commande et pièces (vague « écrans identiques », D-ECR-BC) ──
  ...ecransCommandes(),
  // ── Chantiers, clients, catalogue (repris : ecrans-chantiers.ts) ────────
  ...ecransChantiersClientsCatalogue(),
  // ── Les écrans des modules (vague suivante) ─────────────────────────────
  ...ecransModules(),
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
    { id: "devis", titre: "Devis", onglet: "devis", route: "/devis" },
    { id: "factures", titre: "Factures › liste", onglet: "factures", etat: { facturesView: "liste" }, route: "/factures" },
    { id: "factures-avoirs", titre: "Factures › Avoirs", onglet: "factures", etat: { facturesView: "avoirs" }, route: "/factures/avoirs" },
    { id: "factures-validation", titre: "Factures › Validation", onglet: "factures", etat: { facturesView: "validation" }, route: "/facturation/validation" },
    { id: "factures-a-facturer", titre: "Factures › À facturer", onglet: "factures", etat: { facturesView: "afacturer" }, route: "/facturation/a-facturer" },
    { id: "factures-reglements", titre: "Factures › Règlements", onglet: "factures", etat: { facturesView: "reglements" }, route: "/factures/reglements" },
    { id: "rapports", titre: "Rapports", onglet: "interventions", route: "/rapports" },
    { id: "planning", titre: "Planning", onglet: "planning", route: "/planning" },
    { id: "rh", titre: "RH", onglet: "rh", route: "/rh" },
    { id: "vehicules", titre: "Véhicules", onglet: "vehicules", route: "/vehicules" },
    { id: "materiel", titre: "Matériel", onglet: "materiel", route: "/materiel" },
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

/** Amener un élément en haut de la fenêtre, des deux côtés : la capture ne voit que la fenêtre. */
function defiler(selecteur: string): Geste {
  return async (page) => {
    await page.locator(selecteur).first().evaluate((e) => e.scrollIntoView({ block: "start" }));
  };
}

/** Confier un document à un sélecteur de fichier, des deux côtés (un PDF minimal : la lecture en échoue). */
function deposer(selecteur: string): Geste {
  return async (page) => {
    await page.setInputFiles(selecteur, { name: "bon-client.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") });
  };
}

/** Laisser finir un défilement doux (`openForm` défile 50 ms après l'ouverture) avant le geste suivant. */
function attendre(ms: number): Geste {
  return async (page) => {
    await page.waitForTimeout(ms);
  };
}

function enchainer(...gestes: Geste[]): Geste {
  return async (page) => {
    for (const g of gestes) await g(page);
  };
}


/**
 * Les écrans du module « commandes » repris à l'identique (D-ECR-BC-01…). La
 * carte d'un bon a les mêmes identifiants des deux côtés : le même geste la
 * déplie. Les états filtrés passent par l'état de l'ancien et par l'adresse
 * de la nouvelle.
 */
function ecransCommandes(): Ecran[] {
  // Le bon facturé du jeu d'essai (CMD-OPAC-7781) et le bon en attente de son numéro.
  const BON_FACTURE = "#bonCommande-card-a5000000-0000-0000-0000-000000000001";
  const BON_EN_ATTENTE = "#bonCommande-card-a5000000-0000-0000-0000-000000000002";
  // Ce qui reste d'écart sous la fenêtre, DÉCIDÉ : l'éditeur de lignes est le composant partagé des
  // documents (`documents/EditeurLignes`, repris avec les devis — 16 lignes pour une ligne de travaux, 23 pour deux),
  // et le panneau « Circuit du bon » sous le formulaire (D-BC-03, D-ECR-BC-06 — 25 lignes).
  const LIGNES_PARTAGEES = 16;
  const CIRCUIT = 25;
  const BON_PIECE = "#bonCommande-card-c9000000-0000-0000-0000-000000000001";
  const SAV = "#bonCommande-card-c9000000-0000-0000-0000-000000000003";
  const pieces = (id: string, titre: string, gestes?: Geste): Ecran => ({
    id,
    titre,
    compte: "admin",
    ancien: { chemin: "/", gestes: gestes ? enchainer(onglet("piecesCommande"), gestes) : onglet("piecesCommande") },
    nouveau: { chemin: "/pieces", ...(gestes ? { gestes } : {}) },
    seuils: partout(0.001, 0),
  });
  const liste = (id: string, titre: string, etat: Record<string, unknown>, route: string, gestes?: Geste, seuils = partout(0.001, 0)): Ecran => ({
    id,
    titre,
    compte: "admin",
    ancien: { chemin: "/", gestes: gestes ? enchainer(onglet("bonsCommande", etat), gestes) : onglet("bonsCommande", etat) },
    nouveau: { chemin: route, ...(gestes ? { gestes } : {}) },
    seuils,
  });
  return [
    // L'ancien lit les bons sans tri (l'ordre physique de la vue) ; web/ les range par date puis numéro (D-ECR-BC-09).
    // Quand la base porte des bons de même date créés dans le désordre, les cartes du haut s'échangent : même texte, pixels décalés.
    liste("bons-de-commande", "Bons de commande › liste", {}, "/commandes", undefined, { bureau: { pixels: 0.05, texte: 0 }, mobile: { pixels: 0.005, texte: 0 } }),
    liste("bons-de-commande-carte-ouverte", "Bons de commande › carte dépliée (bon facturé)", {}, "/commandes", enchainer(cliquer(`${BON_FACTURE} .bc-chevron`), defiler(BON_FACTURE))),
    liste("bons-de-commande-en-attente", "Bons de commande › filtre « En attente de bon de commande », carte dépliée", { bonCommandeCreationTypeFilter: "attenteBC" }, "/commandes?mode=attente_bc", cliquer(`${BON_EN_ATTENTE} .bc-chevron`)),
    liste("bons-de-commande-sans-resultat", "Bons de commande › recherche sans résultat", { bonCommandeSearch: "zzzz-introuvable" }, "/commandes?recherche=zzzz-introuvable"),
    // Le jeu tests/visuel/jeux/commandes.sql : une pièce à commander (contacts, logement occupé), une commandée chez Cedeo, un SAV.
    liste("bons-de-commande-carte-contacts", "Bons de commande › carte dépliée (contacts, locataire, pièce)", {}, "/commandes", enchainer(cliquer(`${BON_PIECE} .bc-chevron`), defiler(BON_PIECE))),
    liste("bons-de-commande-sav", "Bons de commande › SAV déplié", {}, "/commandes", enchainer(cliquer(`${SAV} .bc-chevron`), defiler(SAV))),
    // Le formulaire : le même bouton l'ouvre des deux côtés ; la modification passe par « Modifier » sur la carte.
    liste("bons-de-commande-nouveau", "Bons de commande › nouveau bon (formulaire)", {}, "/commandes", enchainer(cliquer(".page-head .btn.primary"), attendre(800)), partout(0.001, LIGNES_PARTAGEES)),
    liste("bons-de-commande-nouveau-sans-bc", "Bons de commande › nouveau bon, « Sans bon de commande »", {}, "/commandes", enchainer(cliquer(".page-head .btn.primary"), attendre(800), cliquer(".plus-subnav-btn:nth-child(2)")), partout(0.001, LIGNES_PARTAGEES)),
    liste("bons-de-commande-modifier", "Bons de commande › modifier un bon (Sans BC)", {}, "/commandes", enchainer(cliquer("#bonCommande-card-a5000000-0000-0000-0000-000000000003 .bc-actions-bas .btn:nth-child(2)"), attendre(800)), partout(0.001, LIGNES_PARTAGEES + CIRCUIT)),
    liste("bons-de-commande-consulter", "Bons de commande › consulter un bon facturé (verrou)", {}, "/commandes", enchainer(defiler(BON_FACTURE), cliquer(`${BON_FACTURE} .bc-actions-bas .btn:first-child`), attendre(800)), partout(0.001, 23 + CIRCUIT)),
    // La lecture automatique, lancée depuis la liste : sans service de lecture en local, elle échoue des deux côtés.
    liste("bons-de-commande-lecture-echec", "Bons de commande › importer un BC : issue d'une lecture qui échoue", {}, "/commandes", enchainer(deposer(".page-head label.btn input[type=file]"), attendre(3000)), { bureau: { pixels: 0.05, texte: 4 }, mobile: { pixels: 0.04, texte: 4 } }),
    // Seul écart : le motif du refus — l'ancien affichait « Edge Function returned a non-2xx status code »,
    // la lecture de web/ le dit en français (D-ECR-BC-10) ; 2 lignes (écran et toast), de chaque côté.
    pieces("pieces-en-commande", "Pièces en commande"),
    pieces("pieces-dossier-ouvert", "Pièces en commande › dossier fournisseur ouvert", cliquer(".dossier-header")),
    // Téléphone : le champ date de la commande diffère d'un pixel sur son bord droit (rendu natif du sélecteur de date).
    { ...pieces("pieces-carte-ouverte", "Pièces en commande › carte dépliée (commander, pièce arrivée)", cliquer(`${BON_PIECE} .bc-chevron`)), seuils: { bureau: { pixels: 0.001, texte: 0 }, mobile: { pixels: 0.002, texte: 0 } } },
  ];
}
