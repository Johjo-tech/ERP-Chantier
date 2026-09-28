import { join } from "node:path";
import type { Page } from "@playwright/test";
import { cliquer, onglet, partout, type Ecran, type Seuils, type Taille } from "./ecrans";

/**
 * Chantiers, clients et catalogue : chaque écran et ses états, des deux côtés.
 *
 * Même sélecteur des deux côtés dès que le HTML repris porte les mêmes classes
 * (`cliquer`) ; l'ancien s'atteint par son onglet et ses gestes, le nouveau par
 * sa route. Les seuils sont des cliquets (README).
 */

type Geste = (page: Page) => Promise<void>;

/** Les chantiers du jeu d'essai (`supabase/seed-web.sql`), ouverts par leur identifiant des deux côtés. */
const CHANTIER_C = "a3000000-0000-0000-0000-000000000001";
const CHANTIER_DURAND = "a3000000-0000-0000-0000-000000000002";

/** Enchaîne des gestes : l'onglet de l'ancien, puis un clic. */
function puis(...gestes: Geste[]): Geste {
  return async (page) => {
    for (const g of gestes) await g(page);
  };
}

/** Durée sans changement du texte de la page au-delà de laquelle le redessin est tenu pour fini. */
const CALME_MS = 800;
const PAS_MS = 100;
const ATTENTE_MAX_MS = 8_000;
/** Saisies tentées avant de conclure que l'écran efface le champ pour de bon (ce serait un défaut, pas une course). */
const SAISIES_MAX = 3;

async function attendreTexteStable(page: Page): Promise<void> {
  let precedent = "";
  let calme = 0;
  for (let ecoule = 0; ecoule < ATTENTE_MAX_MS; ecoule += PAS_MS) {
    const texte = await page.evaluate(() => document.body.innerText);
    calme = texte === precedent ? calme + PAS_MS : 0;
    if (calme >= CALME_MS) return;
    precedent = texte;
    await page.waitForTimeout(PAS_MS);
  }
  console.warn(`[visuel] le texte de la page change encore après ${ATTENTE_MAX_MS} ms, capture quand même`);
}

/** Saisit un texte dans le champ désigné — le même sélecteur des deux côtés. */
function saisir(selecteur: string, texte: string): Geste {
  return async (page) => {
    // L'ancien catalogue charge sa page après s'être dessiné, puis redessine sa zone ; une saisie
    // tombée avant ce redessin était effacée (champ vide, liste entière : « recherche sans
    // résultat » sur téléphone, une passe sur deux). On attend la fin du dessin, et on ressaisit
    // tant que le champ n'a pas gardé le texte.
    await attendreTexteStable(page);
    for (let essai = 1; essai <= SAISIES_MAX; essai++) {
      await page.fill(selecteur, texte, { timeout: 5_000 });
      // La recherche attend que la main s'arrête (250 ms), des deux côtés ; sous charge, le
      // redessin arrive plus tard qu'une attente fixe : on attend que le texte de la page cesse de changer.
      await attendreTexteStable(page);
      if ((await page.locator(selecteur).first().inputValue()) === texte) break;
      if (essai === SAISIES_MAX) throw new Error(`[visuel] « ${texte} » effacé de ${selecteur} ${SAISIES_MAX} fois de suite`);
    }
    // L'ancien redessinait la zone et perdait le focus ; le nouveau le garde (D-ECR-CHA-05) : on compare sans.
    await page.locator(selecteur).first().blur();
  };
}

/*
 * DEF-REP-05, D-REP-05 : le nom du client s'affiche sur chaque carte de chantier et dans le bandeau de
 * la fiche ; l'ancien lisait un champ `client` vide. Une ligne AJOUTÉE par carte (« OPAC du Rhône »,
 * « Mme Durand »), une ligne CHANGÉE dans le bandeau (« Réhabilitation · » → « Réhabilitation · OPAC du
 * Rhône » : une manquante, une ajoutée). Sur téléphone, les cartes s'allongent d'une ligne (10 %) et le
 * bandeau de la fiche passe sur deux lignes, ce qui descend toute la fiche de 15 px (15,2 %). Les seuils
 * de ces écrans sont MESURÉS sur base neuve (D-VIS3-02) : pixels arrondis au millième supérieur + 1 ‰,
 * texte exact ; chaque commentaire dit d'où viennent ses lignes.
 */
export function ecransChantiersClientsCatalogue(): Ecran[] {
  return ecransDuPerimetre();
}

function ecransDuPerimetre(): Ecran[] {
  return [
    // ── Catalogue ───────────────────────────────────────────────────────────
    {
      id: "catalogue",
      titre: "Catalogue › liste",
      compte: "admin",
      ancien: { chemin: "/", gestes: onglet("catalogue") },
      nouveau: { chemin: "/articles" },
      seuils: partout(0.001, 0),
    },
    {
      id: "catalogue-recherche-vide",
      titre: "Catalogue › recherche sans résultat",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("catalogue"), saisir("#catalogueZone input[type=text]", "zzzz")) },
      nouveau: { chemin: "/articles", gestes: saisir("#catalogueZone input[type=text]", "zzzz") },
      seuils: partout(0.001, 0),
    },
    {
      id: "catalogue-nouvel-article",
      titre: "Catalogue › nouvel article",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("catalogue"), cliquer(".page-head .btn.primary")) },
      nouveau: { chemin: "/articles", gestes: cliquer(".page-head .btn.primary") },
      // DEF-REP-03, D-REP-03 : la fiche gagne un champ « Métier » (sélecteur) après « Type » et « Unité ».
      // Mesuré (D-VIS3-02) : 10 lignes ajoutées — « Métier », « — » et les huit métiers de la société, que
      // `innerText` lit dans les options — ; les champs suivants descendent d'un rang et « Géré en stock »
      // passe sous « TVA » (5,8 % bureau ; sur téléphone la fiche déborde de l'écran : 0,25 %).
      seuils: { bureau: { pixels: 0.06, texte: 10 }, mobile: { pixels: 0.004, texte: 10 } },
    },
    {
      id: "catalogue-modifier-article",
      titre: "Catalogue › modifier un article",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("catalogue"), cliquer("#catalogueZone td .btn.small")) },
      nouveau: { chemin: "/articles", gestes: cliquer("#catalogueZone td .btn.small") },
      // DEF-REP-03, D-REP-03 : comme « nouvel article », plus une option : le métier enregistré de l'article
      // (« electricite », graphie du jeu d'essai hors de la liste) est proposé pour ne pas être perdu à
      // l'enregistrement. Mesuré : 11 lignes, 5,8 % (bureau), 0,36 % (téléphone).
      seuils: { bureau: { pixels: 0.06, texte: 11 }, mobile: { pixels: 0.005, texte: 11 } },
    },
    {
      id: "catalogue-import",
      titre: "Catalogue › importer un fichier",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("catalogue"), cliquer(".page-head .btn:not(.primary)")) },
      nouveau: { chemin: "/articles", gestes: cliquer(".page-head .btn:not(.primary)") },
      seuils: partout(0.001, 0),
    },
    {
      id: "catalogue-lecture",
      titre: "Catalogue › liste (lecture seule)",
      compte: "lecture",
      ancien: { chemin: "/", gestes: onglet("catalogue") },
      nouveau: { chemin: "/articles" },
      seuils: partout(0.001, 0),
    },
    // ── Clients ─────────────────────────────────────────────────────────────
    {
      id: "clients",
      titre: "Clients › liste",
      compte: "admin",
      ancien: { chemin: "/", gestes: onglet("clients") },
      nouveau: { chemin: "/clients" },
      seuils: partout(0.001, 0),
    },
    {
      id: "clients-recherche",
      titre: "Clients › recherche (« 1 sur 3 »)",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("clients"), saisir("#recherche-client", "opac")) },
      nouveau: { chemin: "/clients", gestes: saisir("#recherche-client", "opac") },
      seuils: partout(0.001, 0),
    },
    {
      id: "clients-recherche-vide",
      titre: "Clients › recherche sans résultat",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("clients"), saisir("#recherche-client", "zzzz")) },
      nouveau: { chemin: "/clients", gestes: saisir("#recherche-client", "zzzz") },
      seuils: partout(0.001, 0),
    },
    {
      id: "clients-nouveau",
      titre: "Clients › nouveau client",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("clients"), cliquer(".page-head .btn.primary")) },
      nouveau: { chemin: "/clients", gestes: cliquer(".page-head .btn.primary") },
      seuils: partout(0.001, 0),
    },
    {
      id: "clients-modifier",
      titre: "Clients › modifier un client",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("clients"), cliquer("#liste-client .btn.small.primary")) },
      nouveau: { chemin: "/clients", gestes: cliquer("#liste-client .btn.small.primary") },
      seuils: partout(0.001, 0),
    },
    {
      id: "clients-interlocuteur",
      titre: "Clients › nouvel interlocuteur (dans la carte)",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("clients"), cliquer("#liste-client .card .btn.small:not(.primary):not(.danger)")) },
      nouveau: { chemin: "/clients", gestes: cliquer("#liste-client .card .btn.small:not(.primary):not(.danger)") },
      seuils: partout(0.001, 0),
    },
    {
      id: "clients-import",
      titre: "Clients › importer un fichier",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("clients"), cliquer(".page-head .btn:not(.primary)")) },
      nouveau: { chemin: "/clients", gestes: cliquer(".page-head .btn:not(.primary)") },
      // La phrase d'aide ne promet plus l'annuaire, que l'import n'interroge pas (D-EFA-06) : 1 ligne remplacée.
      seuils: { bureau: { pixels: 0.005, texte: 2 }, mobile: { pixels: 0.052, texte: 2 } },
    },
    {
      id: "clients-lecture",
      titre: "Clients › liste (lecture seule)",
      compte: "lecture",
      ancien: { chemin: "/", gestes: onglet("clients") },
      nouveau: { chemin: "/clients" },
      // L'ancien montrait à la lecture des boutons que la base refuse ; ils sont masqués (D-ECR-CHA-06) : 10 lignes.
      seuils: { bureau: { pixels: 0.195, texte: 10 }, mobile: { pixels: 0.466, texte: 10 } },
    },
    {
      id: "plus-nouveau-client",
      titre: "Plus › Clients › nouveau client (téléphone)",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("plus", { plusTab: "clients" }), cliquer(".page-head .btn.primary")) },
      nouveau: { chemin: "/plus", gestes: cliquer(".page-head .btn.primary") },
      seuils: { mobile: { pixels: 0.001, texte: 0 } },
    },
    // ── Chantiers ───────────────────────────────────────────────────────────
    {
      id: "chantiers",
      titre: "Chantiers › liste",
      compte: "admin",
      ancien: { chemin: "/", gestes: onglet("chantiers") },
      nouveau: { chemin: "/chantiers" },
      // Le nom du client sur les deux cartes (DEF-REP-05) : 2 lignes ajoutées ; 2,8 % (bureau), 10,1 % (téléphone).
      seuils: { bureau: { pixels: 0.03, texte: 2 }, mobile: { pixels: 0.102, texte: 2 } },
    },
    {
      id: "chantiers-nouveau",
      titre: "Chantiers › nouveau chantier",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("chantiers"), cliquer(".page-head .btn.primary")) },
      nouveau: { chemin: "/chantiers", gestes: cliquer(".page-head .btn.primary") },
      // Sous le formulaire, le nom du client sur les deux cartes (DEF-REP-05) : 2 lignes ajoutées.
      seuils: partout(0.001, 2),
    },
    {
      id: "chantiers-recherche-vide",
      titre: "Chantiers › recherche sans résultat",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("chantiers"), saisir("#chantierSearchInput", "zzzz")) },
      nouveau: { chemin: "/chantiers", gestes: saisir("#chantierSearchInput", "zzzz") },
      seuils: partout(0.001, 0),
    },
    {
      id: "chantier-fiche",
      titre: "Chantiers › fiche (Réhabilitation bât. C)",
      compte: "admin",
      ancien: { chemin: "/", gestes: onglet("chantiers", { viewingChantier: CHANTIER_C }) },
      nouveau: { chemin: `/chantiers/${CHANTIER_C}` },
      // « Reprendre un devis » (D-CHA-06, 5 lignes) et la section Intervenants (D-ECR-CHA-09, 11 lignes), sous la
      // ligne de flottaison ; le bandeau porte le nom du client (DEF-REP-05, 2 lignes) et, sur téléphone, passe
      // sur deux lignes (15,2 %).
      seuils: { bureau: { pixels: 0.001, texte: 18 }, mobile: { pixels: 0.153, texte: 18 } },
    },
    {
      id: "chantier-modifier",
      titre: "Chantiers › fiche › Modifier les infos",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("chantiers", { viewingChantier: CHANTIER_C }), cliquer(".page-head > .btn")) },
      nouveau: { chemin: `/chantiers/${CHANTIER_C}`, gestes: cliquer(".page-head > .btn") },
      // Le client choisi dans la liste, que l'ancien ne retrouve pas (D-ECR-CHA-07).
      seuils: { bureau: { pixels: 0.001, texte: 0 }, mobile: { pixels: 0.003, texte: 0 } },
    },
    {
      id: "chantier-fiche-dpgf",
      titre: "Chantiers › fiche avec DPGF (Salle de bains Durand)",
      compte: "admin",
      ancien: { chemin: "/", gestes: onglet("chantiers", { viewingChantier: CHANTIER_DURAND }) },
      nouveau: { chemin: `/chantiers/${CHANTIER_DURAND}` },
      // Comme la fiche C (D-CHA-06, D-ECR-CHA-09, DEF-REP-05) : 18 lignes. Le DPGF de Durand se lit désormais des
      // deux côtés (mesuré : aucune ligne d'écart). « Mme Durand » tient sur la ligne du bandeau : 0,13 % sur téléphone.
      seuils: { bureau: { pixels: 0.001, texte: 18 }, mobile: { pixels: 0.003, texte: 18 } },
    },
    ...ecransParRole(),
    ...ecransImports(),
    ...ecransModales(),
  ];
}

const FICHIERS = join(import.meta.dirname, "fichiers");

/** Choisit un fichier d'essai (`tests/visuel/fichiers/`) dans le champ désigné, puis laisse l'aperçu se dessiner. */
function deposer(selecteur: string, fichier: string): Geste {
  return async (page) => {
    await page.locator(selecteur).first().setInputFiles(join(FICHIERS, fichier), { timeout: 5_000 });
    await page.waitForTimeout(1_500);
  };
}

/**
 * Les aperçus d'import et la modale de correspondance du DPGF, avec les mêmes
 * fichiers d'essai des deux côtés. Rien n'est écrit : on s'arrête avant
 * « Importer ». La modale « Planifier » et le détail d'une tâche ne se
 * comparent pas : l'ancien ne lit ni lignes de DPGF ni tâches (D-ECR-CHA-11),
 * il n'a donc pas de bouton pour les ouvrir ; les confirmations sont des boîtes
 * du navigateur, hors capture — leur texte est vérifié par les tests unitaires.
 */
function ecransImports(): Ecran[] {
  const catalogue = puis(cliquer(".page-head .btn:not(.primary)"), deposer("#catalogueZone input[type=file]", "catalogue-visuel.csv"));
  const clients = puis(cliquer(".page-head .btn:not(.primary)"), deposer(".form-panel input[type=file]", "clients-visuel.csv"));
  const dpgf = deposer(".dpgf-import-banner input[type=file]", "dpgf-visuel.csv");
  return [
    {
      id: "catalogue-import-apercu",
      titre: "Catalogue › import › aperçu d'un fichier",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("catalogue"), catalogue) },
      nouveau: { chemin: "/articles", gestes: catalogue },
      // « à mettre à jour » se lit une fraction de seconde plus tard (codes existants demandés à la base) : quelques pixels.
      seuils: { bureau: { pixels: 0.002, texte: 0 }, mobile: { pixels: 0.003, texte: 0 } },
    },
    {
      id: "clients-import-apercu",
      titre: "Clients › import › aperçu d'un fichier",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("clients"), clients) },
      nouveau: { chemin: "/clients", gestes: clients },
      // « Annuaire : non interrogé. » à la place du décompte de l'annuaire, que l'import n'appelle pas (D-EFA-06) : 1 ligne remplacée.
      seuils: { bureau: { pixels: 0.002, texte: 2 }, mobile: { pixels: 0.004, texte: 2 } },
    },
    {
      id: "chantier-import-dpgf",
      titre: "Chantiers › fiche › Importer le DPGF (correspondance des colonnes)",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("chantiers", { viewingChantier: CHANTIER_C }), dpgf) },
      nouveau: { chemin: `/chantiers/${CHANTIER_C}`, gestes: dpgf },
      // La modale est identique ; restent, sous elle, « Reprendre un devis » (D-CHA-06), Intervenants (D-ECR-CHA-09)
      // et le nom du client dans le bandeau (DEF-REP-05, 2 lignes : l'écran manquait à la marge « nom du client »
      // et échouait). Sur un DPGF non vide, la modale annonce en plus les lignes remplacées et conservées
      // (DEF-COR-06, voulu) ; le chantier C n'en a pas : la phrase n'y paraît pas.
      seuils: partout(0.001, 18),
    },
  ];
}


/** Les rôles autres qu'administrateur et lecture, sur les écrans de ce périmètre qu'ils atteignent. */
type RoleCompare = "conducteur" | "technicien" | "soustraitant" | "secretaire";

/**
 * Chaque rôle sur la liste des chantiers, une fiche, les clients et le
 * catalogue. Seuils : l'écart mesuré (cliquet), chaque ligne commentée par sa
 * décision dans `SEUILS_ROLES`.
 */
function ecransParRole(): Ecran[] {
  const roles: RoleCompare[] = ["conducteur", "technicien", "soustraitant", "secretaire"];
  const ecrans: { id: string; titre: string; ancien: Geste; nouveau: string }[] = [
    { id: "chantiers", titre: "Chantiers › liste", ancien: onglet("chantiers"), nouveau: "/chantiers" },
    { id: "chantier-fiche", titre: "Chantiers › fiche", ancien: onglet("chantiers", { viewingChantier: CHANTIER_C }), nouveau: `/chantiers/${CHANTIER_C}` },
    { id: "chantier-fiche-durand", titre: "Chantiers › fiche Durand", ancien: onglet("chantiers", { viewingChantier: CHANTIER_DURAND }), nouveau: `/chantiers/${CHANTIER_DURAND}` },
    { id: "clients", titre: "Clients › liste", ancien: onglet("clients"), nouveau: "/clients" },
    { id: "catalogue", titre: "Catalogue › liste", ancien: onglet("catalogue"), nouveau: "/articles" },
  ];
  return roles.flatMap((role) =>
    ecrans
      .filter((e) => SEUILS_ROLES[`${e.id}--${role}`] !== null)
      .map((e) => ({
        id: `${e.id}--${role}`,
        titre: `${e.titre} (${role})`,
        compte: role,
        ancien: { chemin: "/", gestes: e.ancien },
        nouveau: { chemin: e.nouveau },
        seuils: SEUILS_ROLES[`${e.id}--${role}`] ?? { bureau: { pixels: 1, texte: 10_000 }, mobile: { pixels: 1, texte: 10_000 } },
      }))
  );
}

/**
 * Seuils par écran et par rôle. `null` : écran hors d'atteinte du rôle dans
 * les DEUX applications (menu absent, et la nouvelle refuse la route) — rien à
 * comparer.
 */
const SEUILS_ROLES: Record<string, Partial<Record<Taille, Seuils>> | null | undefined> = {
  // Le terrain n'a ni clients ni catalogue au menu de l'ancien ; la nouvelle refuse la route (ART-40, RLS).
  "clients--technicien": null,
  "clients--soustraitant": null,
  "catalogue--technicien": null,
  "catalogue--soustraitant": null,
  // Le sous-traitant n'est affecté qu'à Durand : sa fiche C ramène à la liste des deux côtés, on compare Durand.
  "chantier-fiche--soustraitant": null,
  "chantier-fiche-durand--conducteur": null,
  "chantier-fiche-durand--technicien": null,
  "chantier-fiche-durand--secretaire": null,
  // Les boutons et sections que la base refuse à ce rôle sont masqués ; l'ancien les montrait (D-ECR-CHA-06).
  // Mesurés sur base neuve (D-VIS3-02) ; chaque liste porte en plus le nom du client de ses cartes (DEF-REP-05).
  "chantiers--conducteur": { bureau: { pixels: 0.03, texte: 2 }, mobile: { pixels: 0.102, texte: 2 } }, // deux noms de client
  "chantiers--technicien": { bureau: { pixels: 0.022, texte: 2 }, mobile: { pixels: 0.072, texte: 2 } }, // « + Nouveau chantier » (D-ECR-CHA-06), un nom
  "chantiers--soustraitant": { bureau: { pixels: 0.022, texte: 2 }, mobile: { pixels: 0.072, texte: 2 } }, // idem
  "chantiers--secretaire": { bureau: { pixels: 0.03, texte: 3 }, mobile: { pixels: 0.097, texte: 3 } }, // « + Nouveau chantier », deux noms
  "chantier-fiche--conducteur": { bureau: { pixels: 0.001, texte: 19 }, mobile: { pixels: 0.153, texte: 19 } }, // « Facturer la sélection » (factures/créer), D-CHA-06, D-ECR-CHA-09, bandeau
  "chantier-fiche--technicien": { bureau: { pixels: 0.207, texte: 52 }, mobile: { pixels: 0.418, texte: 52 } }, // D-ECR-CHA-06, D-ECR-CHA-09, bandeau
  "chantier-fiche--secretaire": { bureau: { pixels: 0.214, texte: 55 }, mobile: { pixels: 0.421, texte: 55 } }, // D-ECR-CHA-06, D-ECR-CHA-09, bandeau
  "chantier-fiche-durand--soustraitant": { bureau: { pixels: 0.202, texte: 61 }, mobile: { pixels: 0.414, texte: 61 } }, // D-ECR-CHA-06, D-ECR-CHA-09, bandeau
  "clients--conducteur": { bureau: { pixels: 0.195, texte: 10 }, mobile: { pixels: 0.466, texte: 10 } }, // D-ECR-CHA-06
  "clients--secretaire": partout(0.001, 0),
  "catalogue--conducteur": partout(0.001, 0),
  "catalogue--secretaire": partout(0.001, 0),
};


/** Le chantier du jeu `jeux/chantiers.sql` : une ligne de DPGF avec métier, une tâche de to-do. */
const CHANTIER_MODALES = "c4000000-0000-0000-0000-000000000001";

/**
 * Ouvre, dans l'ANCIEN, la fiche du chantier des modales après lui avoir posé
 * dans son état la ligne de DPGF et la tâche du jeu d'essai — celles que sa
 * lecture groupée des filles ne ramène pas sur cette base (D-ECR-CHA-11). Mêmes
 * valeurs que `jeux/chantiers.sql`, aux noms de champs de l'ancien écran.
 */
const ficheModalesAncien: Geste = async (page) => {
  await page.evaluate((id) => {
    const w = window as unknown as { state: { chantiers: Record<string, unknown>[]; viewingChantier: string | null }; setTab: (t: string) => void };
    const c = w.state.chantiers.find((x) => x.id === id);
    if (!c) throw new Error(`chantier ${id} absent de l'ancien : jouer tests/visuel/jeux/chantiers.sql`);
    c.dpgfLignes = [
      { id: "c4100000-0000-0000-0000-000000000001", type: "ligne", designation: "VIS-CHA Lessivage des murs", qte: 10, prixUnitaire: 0, avancementCumule: 0, metier: "Peinture", tachesPlanifiees: [] },
    ];
    c.todoList = [{ id: "c4200000-0000-0000-0000-000000000001", texte: "VIS-CHA Bâcher la toiture", statut: "a_faire", fait: false }];
    w.state.viewingChantier = id;
    w.setTab("chantiers");
  }, CHANTIER_MODALES);
};

/**
 * Remonte la page sous une modale ouverte : le clic sur « 📅 Planifier » l'a
 * descendue au bas de la fiche, dont la hauteur diffère d'une section
 * (Intervenants, D-ECR-CHA-09). On compare la modale, sur le même fond.
 */
const enHaut: Geste = async (page) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
};

function ecransModales(): Ecran[] {
  const nouveau = `/chantiers/${CHANTIER_MODALES}`;
  return [
    {
      id: "chantier-fiche-remplie",
      titre: "Chantiers › fiche avec DPGF et to-do (VIS-CHA Modales)",
      compte: "admin",
      ancien: { chemin: "/", gestes: ficheModalesAncien },
      nouveau: { chemin: nouveau },
      // Identiques, modale comprise ; seule s'ajoute la section Intervenants, sous la ligne de flottaison (D-ECR-CHA-09, 12 lignes).
      seuils: partout(0.001, 12),
    },
    {
      id: "chantier-planifier",
      titre: "Chantiers › fiche › Planifier une quantité",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(ficheModalesAncien, cliquer(".dpgf-ligne-row .btn.small.primary"), enHaut) },
      nouveau: { chemin: nouveau, gestes: puis(cliquer(".dpgf-ligne-row .btn.small.primary"), enHaut) },
      // Identiques, modale comprise ; seule s'ajoute la section Intervenants, sous la ligne de flottaison (D-ECR-CHA-09, 12 lignes).
      seuils: partout(0.001, 12),
    },
    {
      id: "chantier-detail-tache",
      titre: "Chantiers › fiche › Détail de la tâche",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(ficheModalesAncien, cliquer(".todo-kanban-card")) },
      nouveau: { chemin: nouveau, gestes: cliquer(".todo-kanban-card") },
      // Identiques, modale comprise ; seule s'ajoute la section Intervenants, sous la ligne de flottaison (D-ECR-CHA-09, 12 lignes).
      seuils: partout(0.001, 12),
    },
  ];
}
