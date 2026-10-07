import type { Page } from "@playwright/test";
import { ecransChantiersClientsCatalogue } from "./ecrans-chantiers";
import { ecransFacturation } from "./ecrans-facturation";
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
export type Compte =
  | "admin"
  | "secretaire"
  | "conducteur"
  | "technicien"
  | "lecture"
  | "soustraitant";

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
        const w = window as unknown as {
          state: Record<string, unknown>;
          setTab: (t: string) => void;
          renderTab: () => void;
        };
        Object.assign(w.state, e);
        if (w.state.tab === o) w.renderTab();
        else w.setTab(o);
      },
      [id, etat] as const,
    );
  };
}

const motDePasseOublie: Geste = async (page) => {
  await page
    .getByRole("button", { name: /mot de passe oubli/i })
    .click({ timeout: 5_000 });
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
  // Repris (D-ECR-PAR-02) : identique sur le jeu `jeux/parc-rh.sql`.
  materiel: { bureau: { pixels: 0.001, texte: 0 } },
  // Repris : le groupe « Accès » du rail (D-ECR-PAR-08) et la carte des jours fériés (D-ECR-PAR-10).
  reglages: { bureau: { pixels: 0.001, texte: 10 } },
  rh: { bureau: { pixels: 0.001, texte: 0 } },
  // Repris (D-ECR-PAR-13). Écart ATTENDU depuis D-STA-B-01 (défauts corrigés) : une ligne par
  // référence de conducteur, « Sans conducteur » en plus, les graphies d'une même fiche réunies
  // (DEF-STA-08) ; chiffre d'affaires sans brouillon ni acompte (DEF-STA-01) ; retard sur les seuls
  // bons ouverts (DEF-STA-09), barre vide sans bon (DEF-STA-10), travaux supplémentaires réels
  // (DEF-STA-11), parts sans négatif (DEF-STA-17), bons par date de commande (DEF-STA-18). Mesuré sur
  // base neuve (D-VIS3-02) : 18 lignes — la ligne « Sans conducteur » (4 bons, 25 844,29 €) dans le
  // tableau, la répartition, le graphique des délais et les taux comparés, « Factures effectuées » à 4
  // (sans brouillon, DEF-STA-01) ; 10,9 % de pixels, les blocs s'élargissent d'une ligne.
  statistiques: { bureau: { pixels: 0.111, texte: 18 } },
  vehicules: { bureau: { pixels: 0.001, texte: 0 } },
};

const TEMPS_RELATIF = [".activity-time"] as const;

/**
 * Le tableau de bord de pilotage : seul ce qui change d'une seconde à l'autre
 * est masqué ; le reste se compare.
 */
const PILOTAGE = [...TEMPS_RELATIF] as const;

/**
 * Écart ATTENDU sur le pilotage depuis D-STA-B-01 (défauts corrigés), MESURÉ sur base neuve le 28/09
 * (D-VIS3-02) : 14 lignes de texte. La tuile « Encaissé ce mois (TTC) » et la ligne du résumé remplacent
 * « CA encaissé ce mois (HT) » (DEF-STA-02, 4 lignes) ; le restant dû sur le solde de la base (DEF-STA-03,
 * 2) ; le classement par fiche client — « OPAC du Rhône » et son montant là où l'ancien classait deux
 * étiquettes « PDF PARITÉ » et le rappel « rien en 2025 » (DEF-STA-07, 8). Pixels mesurés : 0,07 % (bureau),
 * 0,27 % (téléphone, montants plus larges). Tolérance : 2 lignes, les montants « ce mois » suivent la date.
 */
const ECART_DECIDE_PILOTAGE = 16;
const PIXELS_DECIDES_PILOTAGE = 0.002;

/**
 * DEF-REP-10, D-REP-10 : la carte d'un bon ne porte plus la pastille grise `statut` (« en attente »,
 * « en cours », figée depuis la création) ; l'ancien l'affichait sur chaque carte, à côté de l'étape du
 * circuit. Chaque pastille absente est UNE ligne manquante : la liste des bons en montre 7 (1 « EN
 * COURS », 6 « EN ATTENTE »), aussi sous la fenêtre d'un bon ; les pièces en commande 2 ou 3 ; le filtre
 * « en attente de BC » 1. Sans elle, le montant tient souvent sur la ligne des contacts : la carte
 * raccourcit et tout ce qui la suit remonte — jusqu'à 22 % de pixels sur téléphone. Seuils MESURÉS par
 * écran (D-VIS3-02) : pixels arrondis au millième supérieur + 1 ‰, texte exact.
 */
const PASTILLES_LISTE = 7;

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
    seuils: { bureau: { pixels: PIXELS_DECIDES_PILOTAGE, texte: ECART_DECIDE_PILOTAGE } },
    masques: PILOTAGE,
  },
  {
    id: "menu-utilisateur",
    titre: "Cadre › menu du nom ouvert (« Voir en tant que »)",
    compte: "admin",
    ancien: {
      chemin: "/",
      gestes: cliquer(".planning-menu-toggle", "#sidebar .user-menu-btn"),
    },
    nouveau: {
      chemin: "/",
      gestes: cliquer(".planning-menu-toggle", "#sidebar .user-menu-btn"),
    },
    // « Mon compte » : ouvert à tous les rôles depuis ce menu (AUTH-17, D-SOC-06), 2 lignes de plus
    // (« Mon compteSe déconnecter » remplace « Se déconnecter »). Pixels mesurés : 0,58 %, le menu déplié.
    seuils: { bureau: { pixels: 0.007, texte: ECART_DECIDE_PILOTAGE + 2 } },
    // La version construite diffère forcément : deux constructions, deux commits.
    masques: [...PILOTAGE, ".user-menu-version"],
  },
  {
    id: "menu-societe",
    titre: "Cadre › sélecteur de société ouvert",
    compte: "admin",
    ancien: { chemin: "/", gestes: cliquer("#deskTopStrip .societe-btn") },
    nouveau: { chemin: "/", gestes: cliquer("#deskTopStrip .societe-btn") },
    seuils: { bureau: { pixels: PIXELS_DECIDES_PILOTAGE, texte: ECART_DECIDE_PILOTAGE } },
    masques: PILOTAGE,
  },
  {
    id: "cloche",
    titre: "Cadre › cloche des notifications ouverte",
    compte: "admin",
    ancien: { chemin: "/", gestes: cliquer("#deskTopStrip .notif-bell-btn") },
    nouveau: { chemin: "/", gestes: cliquer("#deskTopStrip .notif-bell-btn") },
    seuils: { bureau: { pixels: PIXELS_DECIDES_PILOTAGE, texte: ECART_DECIDE_PILOTAGE } },
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
  // ── Les quatre tableaux de bord ──────────────────────────────────────────
  {
    id: "tableau-de-bord-pilotage",
    titre: "Tableau de bord › pilotage (administrateur)",
    compte: "admin",
    ancien: { chemin: "/" },
    nouveau: { chemin: "/" },
    seuils: {
      bureau: { pixels: PIXELS_DECIDES_PILOTAGE, texte: ECART_DECIDE_PILOTAGE },
      mobile: { pixels: 0.004, texte: ECART_DECIDE_PILOTAGE },
    },
    masques: PILOTAGE,
  },
  {
    id: "tableau-de-bord-conducteur",
    titre: "Tableau de bord › conducteur de travaux",
    compte: "conducteur",
    ancien: { chemin: "/" },
    nouveau: { chemin: "/" },
    // Correction DEF-STA-12 (D-STA-B-01) : un bon à trois tentatives sans rendez-vous s'annonce
    // « injoignable ». Le jeu d'essai n'en a pas : mesuré identique (0 ligne, 0 %), D-VIS3-02 ; une ligne
    // de tolérance, la tuile « À traiter » suit la date.
    seuils: partout(0.001, 1),
  },
  {
    id: "tableau-de-bord-terrain",
    titre: "Tableau de bord › terrain (technicien)",
    compte: "technicien",
    ancien: { chemin: "/" },
    nouveau: { chemin: "/" },
    // Le compte d'essai n'a pas d'équipe : les deux montrent alors tout (D-VIS-09). Correction DEF-STA-13
    // (D-STA-B-01) : les interventions se comptent en cartes du planning, journées supplémentaires
    // comprises. Le jeu d'essai n'en pose pas : mesuré identique (0 ligne, 0 %), D-VIS3-02 ; deux lignes
    // de tolérance, les tuiles du jour suivent la date.
    seuils: partout(0.001, 2),
  },
  {
    id: "tableau-de-bord-sous-traitant",
    titre: "Tableau de bord › sous-traitant",
    compte: "soustraitant",
    ancien: { chemin: "/" },
    nouveau: { chemin: "/" },
    // Écart ATTENDU (D-STA-B-01) : reconnu par son compte, salué au nom de son entreprise, sans le
    // bandeau « Réglages » (DEF-STA-19) ; sa journée — quatre tuiles et « Aujourd'hui » — remplace
    // les trois tuiles de factures et de devis de sous-traitant (DEF-STA-14). Écran refait : 5 lignes
    // manquantes, 8 ajoutées, mesuré sur base neuve (D-VIS3-02) ; pixels 23 % (bureau), 40,4 % (téléphone,
    // quatre tuiles empilées au lieu de trois). Tolérance : 2 lignes, « Aujourd'hui » suit la date.
    seuils: { bureau: { pixels: 0.231, texte: 15 }, mobile: { pixels: 0.405, texte: 15 } },
  },
  // ── Bons de commande et pièces (vague « écrans identiques », D-ECR-BC) ──
  ...ecransCommandes(),
  // ── Chantiers, clients, catalogue (repris : ecrans-chantiers.ts) ────────
  ...ecransChantiersClientsCatalogue(),
  // ── Planning et rapports (vague « écrans identiques ») ──────────────────
  ...ecransPlanning(),
  // ── Les écrans des modules (vague suivante) ─────────────────────────────
  ...ecransModules(),
  // ── Facturation et devis, repris (D-ECR-FAC) ────────────────────────────
  ...ecransFacturation(),
  ...ecransParcRh({ onglet, cliquer, partout }),
];

/**
 * Le planning et les rapports, repris à l'identique. Écarts restants, tous
 * décidés : « Non planifiés » sans les bons au circuit clos (D-PLN-04 — les
 * vignettes des bons facturés de la base d'essai, et leur compte) ; la ligne
 * « 🏠 Locataire · ☎ » que l'ancien ne recevait jamais (D-PLN-10) ; la date de
 * réception d'une pièce lisible (D-ECR-PLN-05). La base d'essai est partagée :
 * quelques lignes de marge.
 */
/**
 * Ouvre l'assistant de rapport dans l'ANCIEN, puis laisse finir son défilement doux : `openForm`
 * lance un `scrollIntoView({ behavior: "smooth" })` 50 ms après l'ouverture. Un clic d'étape tombé
 * pendant ce défilement l'interrompait à mi-course — la page s'arrêtait 27 px plus bas une passe
 * sur deux (étapes Photos et Rapport), sans aucun écart de rendu.
 */
async function ouvrirAssistantAncien(page: Page): Promise<void> {
  await cliquer(".page-head .btn.primary")(page);
  await attendre(DEFILEMENT_DOUX_MS)(page);
}

/** Plus long que le défilement doux de Chromium sur une page (≈ 500 ms), marge comprise. */
const DEFILEMENT_DOUX_MS = 800;

function ecransPlanning(): Ecran[] {
  // Mesuré sur base neuve (D-VIS3-02) : 12 lignes sur chaque écran du planning administrateur ; deux de
  // tolérance, les cartes du jeu sont posées relativement à la semaine courante.
  const ECART_DECIDE_PLANNING = 14;
  const sousOnglet = (n: number) => cliquer(`.plus-subnav-btn:nth-child(${n})`);
  return [
    {
      id: "planning",
      titre: "Planning › Planning Technicien (administrateur)",
      compte: "admin",
      ancien: {
        chemin: "/",
        gestes: onglet("planning", { planningView: "technicien" }),
      },
      nouveau: { chemin: "/planning" },
      seuils: {
        bureau: { pixels: 0.002, texte: ECART_DECIDE_PLANNING },
        mobile: { pixels: 0.002, texte: ECART_DECIDE_PLANNING },
      },
    },
    {
      id: "planning-filtres",
      titre: "Planning › panneau de filtres de « Non planifiés »",
      compte: "admin",
      ancien: {
        chemin: "/",
        gestes: async (page) => {
          await onglet("planning", { planningView: "technicien" })(page);
          await cliquer(".planning-filter-icon-btn")(page);
        },
      },
      nouveau: {
        chemin: "/planning",
        gestes: cliquer(".planning-filter-icon-btn"),
      },
      seuils: { bureau: { pixels: 0.002, texte: ECART_DECIDE_PLANNING } },
    },
    {
      // La carte « PLN-VISUEL-1 » du jeu tests/visuel/jeux/planning.sql, posée mardi de la semaine courante.
      id: "planning-fiche",
      titre: "Planning › fiche d'intervention d'une carte posée",
      compte: "admin",
      ancien: {
        chemin: "/",
        gestes: async (page) => {
          await onglet("planning", { planningView: "technicien" })(page);
          await cliquer(".planning-card-scheduled .planning-card-title")(page);
        },
      },
      nouveau: {
        chemin: "/planning",
        gestes: cliquer(".planning-card-scheduled .planning-card-title"),
      },
      seuils: { bureau: { pixels: 0.002, texte: ECART_DECIDE_PLANNING } },
    },
    {
      id: "planning-fiche-technicien",
      titre: "Planning › fiche d'intervention vue du technicien",
      compte: "technicien",
      ancien: {
        chemin: "/",
        gestes: async (page) => {
          await onglet("planning")(page);
          await cliquer(".planning-card-scheduled .planning-card-title")(page);
        },
      },
      nouveau: {
        chemin: "/planning",
        gestes: cliquer(".planning-card-scheduled .planning-card-title"),
      },
      // Les gestes de contact réservés à qui modifie le bon (D-PLN-13) : la fiche remonte d'une ligne.
      seuils: { bureau: { pixels: 0.11, texte: 20 } },
    },
    {
      id: "planning-ajout-date",
      titre: "Planning › « + Autre date » d'une carte posée",
      compte: "admin",
      ancien: {
        chemin: "/",
        gestes: async (page) => {
          await onglet("planning", { planningView: "technicien" })(page);
          await cliquer(".planning-card-scheduled .planning-extra-dates .btn")(
            page,
          );
        },
      },
      nouveau: {
        chemin: "/planning",
        gestes: cliquer(".planning-card-scheduled .planning-extra-dates .btn"),
      },
      seuils: { bureau: { pixels: 0.002, texte: ECART_DECIDE_PLANNING } },
    },
    {
      id: "planning-rappel",
      titre: "Planning › « Programmer un rappel » d'une carte à planifier",
      compte: "admin",
      ancien: {
        chemin: "/",
        gestes: async (page) => {
          await onglet("planning", { planningView: "technicien" })(page);
          await cliquer(".planning-unsched-list .btn-contact-rappel")(page);
        },
      },
      nouveau: {
        chemin: "/planning",
        gestes: cliquer(".planning-unsched-list .btn-contact-rappel"),
      },
      seuils: { bureau: { pixels: 0.002, texte: ECART_DECIDE_PLANNING } },
    },
    {
      id: "planning-sous-traitant",
      titre: "Planning › Planning Sous-traitant",
      compte: "admin",
      ancien: {
        chemin: "/",
        gestes: onglet("planning", { planningView: "soustraitant" }),
      },
      nouveau: { chemin: "/planning", gestes: sousOnglet(2) },
      // Deux lignes de plus que les autres vues (mesuré : 14) — les sous-traitants de la colonne.
      seuils: { bureau: { pixels: 0.002, texte: ECART_DECIDE_PLANNING + 2 } },
    },
    {
      id: "planning-attente",
      titre: "Planning › En attente technicien",
      compte: "admin",
      ancien: {
        chemin: "/",
        gestes: onglet("planning", { planningView: "attente" }),
      },
      nouveau: { chemin: "/planning", gestes: sousOnglet(3) },
      seuils: { bureau: { pixels: 0.01, texte: 4 } },
    },
    {
      id: "planning-attente-st",
      titre: "Planning › En attente sous-traitant",
      compte: "admin",
      ancien: {
        chemin: "/",
        gestes: onglet("planning", { planningView: "attenteST" }),
      },
      nouveau: { chemin: "/planning", gestes: sousOnglet(4) },
      seuils: { bureau: { pixels: 0.01, texte: 4 } },
    },
    {
      id: "planning-technicien",
      titre: "Planning › vue du technicien",
      compte: "technicien",
      ancien: { chemin: "/", gestes: onglet("planning") },
      nouveau: { chemin: "/planning" },
      // Les réglages d'une carte sont masqués à qui ne planifie pas (D-ECR-PLN-03) : l'ancien les rognait, sans plus.
      seuils: { bureau: { pixels: 0.002, texte: 18 } },
    },
    {
      id: "planning-soustraitant",
      titre: "Planning › « Mon planning » du sous-traitant",
      compte: "soustraitant",
      ancien: { chemin: "/", gestes: onglet("planning") },
      nouveau: { chemin: "/planning" },
      seuils: { bureau: { pixels: 0.002, texte: 4 } },
    },
    {
      id: "rapport-nouveau",
      titre: "Rapports › assistant, étape Infos",
      compte: "admin",
      ancien: {
        chemin: "/",
        gestes: async (page) => {
          await onglet("interventions")(page);
          await ouvrirAssistantAncien(page);
        },
      },
      nouveau: { chemin: "/rapports/nouveau" },
      // Identique une fois le défilement de l'ancien fini (D-VIS3-03) : mesuré 0,01 %, 0 ligne.
      seuils: { bureau: { pixels: 0.001, texte: 0 } },
    },
    {
      id: "rapport-nouveau-controles",
      titre: "Rapports › assistant, étape Contrôles (sans type)",
      compte: "admin",
      ancien: {
        chemin: "/",
        gestes: async (page) => {
          await onglet("interventions")(page);
          await ouvrirAssistantAncien(page);
          await cliquer(".step-item:nth-child(3)")(page);
        },
      },
      nouveau: {
        chemin: "/rapports/nouveau",
        gestes: cliquer(".step-item:nth-child(3)"),
      },
      seuils: { bureau: { pixels: 0.001, texte: 0 } },
    },
    {
      id: "rapport-nouveau-photos",
      titre: "Rapports › assistant, étape Photos",
      compte: "admin",
      ancien: {
        chemin: "/",
        gestes: async (page) => {
          await onglet("interventions")(page);
          await ouvrirAssistantAncien(page);
          await cliquer(".step-item:nth-child(5)")(page);
        },
      },
      nouveau: {
        chemin: "/rapports/nouveau",
        gestes: cliquer(".step-item:nth-child(5)"),
      },
      seuils: { bureau: { pixels: 0.001, texte: 0 } },
    },
    {
      id: "rapport-nouveau-rapport",
      titre: "Rapports › assistant, étape Rapport",
      compte: "admin",
      ancien: {
        chemin: "/",
        gestes: async (page) => {
          await onglet("interventions")(page);
          await ouvrirAssistantAncien(page);
          await cliquer(".step-item:nth-child(7)")(page);
        },
      },
      nouveau: {
        chemin: "/rapports/nouveau",
        gestes: cliquer(".step-item:nth-child(7)"),
      },
      seuils: { bureau: { pixels: 0.001, texte: 0 } },
    },
    {
      id: "rapports",
      titre: "Rapports / recherche de fuite › liste",
      compte: "admin",
      ancien: { chemin: "/", gestes: onglet("interventions") },
      nouveau: { chemin: "/rapports" },
      // Écart attendu, DEF-ECR-01 (corrigé, D-COR2-01) : le rapport sans statut du jeu des PDF
      // (INT-2026-000001) porte « EN COURS » dans web/, une pastille grise VIDE dans l'ancien — une
      // pastille plus large, qui pousse « LOGEMENT OCCUPÉ » à sa gauche, et une ligne de texte changée.
      // Le reste de l'écran reste tenu au seuil d'avant (0,001 ; 0 ligne).
      seuils: { bureau: { pixels: 0.004, texte: 2 }, mobile: { pixels: 0.012, texte: 2 } },
    },
  ];
}

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
  // et le panneau « Circuit du bon » sous le formulaire (D-BC-03, D-ECR-BC-06 — 22 lignes, habit de la carte dépliée de l’ancien).
  const LIGNES_PARTAGEES = 16;
  const CIRCUIT = 22;
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
    // Sur base neuve l'ordre coïncide ; restent les pastilles (1,9 % bureau, 0 % téléphone).
    liste("bons-de-commande", "Bons de commande › liste", {}, "/commandes", undefined, { bureau: { pixels: 0.021, texte: PASTILLES_LISTE }, mobile: { pixels: 0.001, texte: PASTILLES_LISTE } }),
    // Pastilles ; la carte dépliée raccourcit (téléphone : 22,3 %).
    liste("bons-de-commande-carte-ouverte", "Bons de commande › carte dépliée (bon facturé)", {}, "/commandes", enchainer(cliquer(`${BON_FACTURE} .bc-chevron`), defiler(BON_FACTURE)), { bureau: { pixels: 0.027, texte: PASTILLES_LISTE }, mobile: { pixels: 0.225, texte: PASTILLES_LISTE } }),
    // Une seule carte, une pastille (0,46 % bureau).
    liste("bons-de-commande-en-attente", "Bons de commande › filtre « En attente de bon de commande », carte dépliée", { bonCommandeCreationTypeFilter: "attenteBC" }, "/commandes?mode=attente_bc", cliquer(`${BON_EN_ATTENTE} .bc-chevron`), { bureau: { pixels: 0.006, texte: 1 }, mobile: { pixels: 0.001, texte: 1 } }),
    liste("bons-de-commande-sans-resultat", "Bons de commande › recherche sans résultat", { bonCommandeSearch: "zzzz-introuvable" }, "/commandes?recherche=zzzz-introuvable"),
    // Le jeu tests/visuel/jeux/commandes.sql : une pièce à commander (contacts, logement occupé), une commandée chez Cedeo, un SAV.
    liste("bons-de-commande-carte-contacts", "Bons de commande › carte dépliée (contacts, locataire, pièce)", {}, "/commandes", enchainer(cliquer(`${BON_PIECE} .bc-chevron`), defiler(BON_PIECE)), { bureau: { pixels: 0.024, texte: PASTILLES_LISTE }, mobile: { pixels: 0.002, texte: PASTILLES_LISTE } }),
    liste("bons-de-commande-sav", "Bons de commande › SAV déplié", {}, "/commandes", enchainer(cliquer(`${SAV} .bc-chevron`), defiler(SAV)), { bureau: { pixels: 0.028, texte: PASTILLES_LISTE }, mobile: { pixels: 0.19, texte: PASTILLES_LISTE } }),
    // Le formulaire : le même bouton l'ouvre des deux côtés ; la modification passe par « Modifier » sur la carte.
    // La fenêtre couvre la liste : pas de pastille visible.
    liste("bons-de-commande-nouveau", "Bons de commande › nouveau bon (formulaire)", {}, "/commandes", enchainer(cliquer(".page-head .btn.primary"), attendre(800)), partout(0.001, LIGNES_PARTAGEES)),
    liste("bons-de-commande-nouveau-sans-bc", "Bons de commande › nouveau bon, « Sans bon de commande »", {}, "/commandes", enchainer(cliquer(".page-head .btn.primary"), attendre(800), cliquer(".plus-subnav-btn:nth-child(2)")), partout(0.001, LIGNES_PARTAGEES)),
    liste("bons-de-commande-modifier", "Bons de commande › modifier un bon (Sans BC)", {}, "/commandes", enchainer(cliquer("#bonCommande-card-a5000000-0000-0000-0000-000000000003 .bc-actions-bas .btn:nth-child(2)"), attendre(800)), partout(0.001, LIGNES_PARTAGEES + CIRCUIT)),
    // Pastilles de la liste sous la fenêtre, et la TVA des deux lignes de la pièce « 10 % » au lieu de
    // « 10% » (DEF-REP-04 : 2 manquantes, 2 ajoutées) ; insécable, elle ne passe plus à la ligne (D-VIS3-01).
    liste("bons-de-commande-consulter", "Bons de commande › consulter un bon facturé (verrou)", {}, "/commandes", enchainer(defiler(BON_FACTURE), cliquer(`${BON_FACTURE} .bc-actions-bas .btn:first-child`), attendre(800)), { bureau: { pixels: 0.003, texte: PASTILLES_LISTE + 4 }, mobile: { pixels: 0.002, texte: PASTILLES_LISTE + 4 } }),
    // La lecture automatique, lancée depuis la liste : sans service de lecture en local, elle échoue des deux côtés.
    // Seul écart : le motif du refus — l'ancien affichait « Edge Function returned a non-2xx status code »,
    // la lecture de web/ le dit en français (D-ECR-BC-10) ; 2 lignes (écran et toast), de chaque côté.
    // Pixels mesurés : 4,4 % (bureau), 3,4 % (téléphone) — le message et le toast.
    liste("bons-de-commande-lecture-echec", "Bons de commande › importer un BC : issue d'une lecture qui échoue", {}, "/commandes", enchainer(deposer(".page-head label.btn input[type=file]"), attendre(3000)), { bureau: { pixels: 0.046, texte: 4 }, mobile: { pixels: 0.036, texte: 4 } }),
    // La pré-facture, fenêtre ouverte depuis la carte (bon « Sans BC » de Mme Durand, une tâche à pointer) :
    // pastilles de la liste dessous, et la TVA de sa ligne « 10 % » (DEF-REP-04, 2 lignes).
    liste("bons-de-commande-prefacture", "Bons de commande › pré-facture (fenêtre)", {}, "/commandes", enchainer(cliquer("#bonCommande-card-a5000000-0000-0000-0000-000000000003 .bc-actions-bas .btn.primary"), attendre(1500)), { bureau: { pixels: 0.004, texte: PASTILLES_LISTE + 2 }, mobile: { pixels: 0.002, texte: PASTILLES_LISTE + 2 } }),
    // Deux cartes à commander, deux pastilles ; sur téléphone, les cartes raccourcissent (12 %).
    { ...pieces("pieces-en-commande", "Pièces en commande"), seuils: { bureau: { pixels: 0.014, texte: 2 }, mobile: { pixels: 0.121, texte: 2 } } },
    // Trois cartes visibles une fois le dossier Cedeo ouvert.
    { ...pieces("pieces-dossier-ouvert", "Pièces en commande › dossier fournisseur ouvert", cliquer(".dossier-header")), seuils: { bureau: { pixels: 0.02, texte: 3 }, mobile: { pixels: 0.065, texte: 3 } } },
    // Téléphone : le champ date de la commande diffère aussi d'un pixel sur son bord droit (rendu natif du sélecteur de date).
    { ...pieces("pieces-carte-ouverte", "Pièces en commande › carte dépliée (commander, pièce arrivée)", cliquer(`${BON_PIECE} .bc-chevron`)), seuils: { bureau: { pixels: 0.017, texte: 2 }, mobile: { pixels: 0.114, texte: 2 } } },
  ];
}
