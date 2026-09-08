/**
 * Pont entre l'app HTML historique et le schéma relationnel Supabase.
 *
 * L'app manipule des objets JSON en camelCase, identifie ses sociétés par un
 * code court et embarque lignes et photos dans des tableaux. Le schéma est
 * relationnel : colonnes snake_case, clés étrangères uuid, tables filles.
 *
 * Ce module conserve la surface `stGet` / `stSet` / `stDelete` / `stListKeys`
 * attendue par le HTML et traduit dans les deux sens. Il remplace la table
 * fourre-tout `kv_store`.
 *
 * Deux colonnes du schéma rendent la bascule non destructive :
 * - `client_nom` porte le nom du client en clair, comme l'app le fait ;
 * - `legacy_id` conserve l'identifiant base36 d'origine, si bien que les
 *   références croisées de l'app (`devisId`, `bonCommandeId`…) restent valides
 *   sans réécriture.
 */

import {
  dyn,
  estUuid,
  getNextNumero,
  listByParents,
  supabase,
  todayISO,
} from "@/api/client";
import { colonnesDe, valeursEnum } from "@/api/columns";
import { fusionnerReglages } from "./reglages";
import * as queries from "@/api/queries";
import type { Json, TableName, TerrainData, TypeDocument, Uuid } from "@/api/types";

// ============ CONVERSION DE NOMS ============

/** Cas où la conversion mécanique camelCase → snake_case donnerait un faux nom. */
const SNAKE_OVERRIDES: Record<string, string> = {
  numeroBC: "numero_bc",
  sansBC: "sans_bc",
  enAttenteBC: "en_attente_bc",
};

const CAMEL_OVERRIDES: Record<string, string> = Object.fromEntries(
  Object.entries(SNAKE_OVERRIDES).map(([camel, snake]) => [snake, camel])
);

export function toSnake(key: string): string {
  return SNAKE_OVERRIDES[key] ?? key.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
}

export function toCamel(key: string): string {
  return (
    CAMEL_OVERRIDES[key] ?? key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
  );
}

/** Champs traités explicitement, jamais par la conversion mécanique. */
const CHAMPS_SPECIAUX = new Set([
  "id",
  "legacy_id",
  "societeId",
  "societe_id",
  "client",
  "client_nom",
  "lignes",
  "photos",
  "rapport",
  "constatations",
  "preconisations",
  "createdAt",
  "cree_le",
  "maj_le",
]);

// ============ LIGNES DE DOCUMENT ============

export interface LigneLegacy {
  type?: string;
  designation?: string;
  commentaire?: string;
  qte?: number;
  unite?: string;
  prixUnitaire?: number;
  tva?: number;
}

export function ligneVersDb(ligne: LigneLegacy, position: number) {
  return {
    type: (ligne.type as "ligne" | "chapitre" | "commentaire") ?? "ligne",
    designation: ligne.designation ?? "",
    commentaire: ligne.commentaire,
    quantite: ligne.qte,
    unite: ligne.unite,
    prix_unitaire: ligne.prixUnitaire,
    tva: ligne.tva,
    position,
  };
}

export function ligneVersLegacy(row: Record<string, unknown>): LigneLegacy {
  return {
    type: row.type as string,
    designation: row.designation as string,
    commentaire: row.commentaire as string | undefined,
    qte: row.quantite as number | undefined,
    unite: row.unite as string | undefined,
    prixUnitaire: row.prix_unitaire as number | undefined,
    tva: row.tva as number | undefined,
  };
}

// ============ REGISTRE DES COLLECTIONS ============

interface Collection {
  table: TableName;
  lignes?: { table: TableName; fk: string };
  photos?: { table: TableName; fk: string };
  /** Le document porte le nom du client en clair (colonne `client_nom`). */
  client?: boolean;
  /**
   * Champs que l'app nomme autrement que la base : `{ champApp: colonne }`.
   * Sans cette table, `metiersPerso` remonterait sans `nom` et les listes
   * déroulantes de métiers resteraient vides.
   */
  alias?: Record<string, string>;
  /**
   * Table fille non cloisonnée : la société se lit chez le parent.
   * `interlocuteurs` n'a pas de `societe_id`, mais l'app filtre dessus.
   */
  societeVia?: { table: TableName; fk: string };
}

/** Préfixe de clé kv_store → table réelle. */
const COLLECTIONS: Record<string, Collection> = {
  devis: {
    table: "devis",
    lignes: { table: "devis_lignes", fk: "devis_id" },
    client: true,
  },
  facture: {
    table: "factures",
    lignes: { table: "facture_lignes", fk: "facture_id" },
    client: true,
  },
  bonCommande: {
    table: "bons_commande",
    // Le SAV pointe vers son bon d'origine ; la colonne ne porte pas le même nom
    alias: { bonCommandeId: "bon_commande_parent_id" },
    lignes: { table: "bon_commande_lignes", fk: "bon_commande_id" },
    photos: { table: "bon_commande_photos", fk: "bon_commande_id" },
    client: true,
  },
  intervention: {
    table: "interventions",
    photos: { table: "intervention_photos", fk: "intervention_id" },
    client: true,
  },
  client: { table: "clients" },
  article: { table: "articles" },
  reglement: { table: "reglements" },
  interlocuteur: {
    table: "interlocuteurs",
    societeVia: { table: "clients", fk: "client_id" },
  },
  conducteur: { table: "conducteurs" },
  // L'app compose un libellé à partir de nom1/nom2/nom3 ; la table n'a qu'un
  // `nom`. Les deux autres n'ont pas de colonne et sont écartés.
  technicien: { table: "techniciens", alias: { nom1: "nom" } },
  metierPerso: { table: "metiers", alias: { nom: "libelle" } },
  sousTraitant: { table: "sous_traitants" },
  chantier: { table: "chantiers" },
  salarie: { table: "salaries" },
  vehicule: { table: "vehicules" },
  materiel: { table: "materiels" },
  document: { table: "documents_legaux" },
  fournisseurControle: { table: "fournisseurs_controle" },
};

// ============ SOCIÉTÉS ============

const societeParCode = new Map<string, Uuid>();
const codeParSocieteId = new Map<Uuid, string>();
let societesChargees = false;

async function chargerSocietes(): Promise<void> {
  if (societesChargees) return;

  const { data, error } = await supabase.from("societes").select("id, code");
  if (error) throw error;

  for (const s of data ?? []) {
    societeParCode.set(s.code, s.id);
    codeParSocieteId.set(s.id, s.code);
  }
  societesChargees = true;
}

/** Le HTML passe un code court (« kta ») là où la base attend un uuid. */
async function resolveSocieteId(code: string): Promise<Uuid> {
  await chargerSocietes();
  const id = societeParCode.get(code);
  if (!id) {
    throw new Error(
      `Société « ${code} » introuvable : aucune ligne de \`societes\` ne porte ce code.`
    );
  }
  return id;
}

async function codeSociete(societeId?: Uuid): Promise<string | undefined> {
  if (!societeId) return undefined;
  await chargerSocietes();
  return codeParSocieteId.get(societeId);
}

// ============ TRADUCTION ============

/** Champs de l'app sans colonne correspondante, déjà signalés une fois. */
const inconnusSignales = new Set<string>();

/**
 * L'app historique écrit `""` pour « non renseigné ». Postgres, lui, refuse la
 * chaîne vide sur une énumération, une date ou un numérique : on la traduit en
 * `null`, sauf sur les colonnes non nulles qui attendent bien du texte.
 */
/* Champs du circuit de validation : sans colonne, mais traduits en
   transitions par `appliquerWorkflow` — les signaler serait trompeur. */
const CHAMPS_TRADUITS = new Set([
  "sous_traitant",
  "dates_supplementaires",
  "piece_a_commander",
  "piece_a_commander_detail",
  "piece_a_commander_fournisseur",
  "piece_a_commander_date_commande",
  "technicien_commentaire",
  "technicien_dessin",
  "metiers_fait",
  "date_origine_fait",
  "valide_conducteur",
  "date_valide_conducteur",
  "valide_directeur",
  "date_valide_directeur",
]);

const VIDE_AUTORISE = new Set(["client_nom", "designation", "nom", "libelle"]);

function normaliser(table: string, colonne: string, v: unknown): unknown {
  if (typeof v === "string" && v.trim() === "" && !VIDE_AUTORISE.has(colonne)) {
    return null;
  }

  // Une valeur hors énumération ferait rejeter l'insertion entière (22P02) ;
  // on préfère perdre le champ. Cas connu : `interventions.metier`, limité à
  // trois valeurs alors que l'app gère des métiers libres.
  const admises = valeursEnum(table, colonne);
  if (admises && typeof v === "string" && !admises.includes(v)) {
    const signature = `${table}.${colonne}=${v}`;
    if (!inconnusSignales.has(signature)) {
      inconnusSignales.add(signature);
      console.warn(
        `Valeur hors énumération, ignorée : ${signature} (admis : ${admises.join(", ")})`
      );
    }
    return null;
  }

  return v;
}

/** Objet HTML (camelCase) → ligne Postgres (snake_case). */
async function versDb(
  prefixe: string,
  valeur: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const collection = COLLECTIONS[prefixe];
  const colonnes = colonnesDe(collection.table);
  const row: Record<string, unknown> = {};

  for (const [cle, v] of Object.entries(valeur)) {
    if (CHAMPS_SPECIAUX.has(cle)) continue;
    if (v === undefined) continue;

    const colonne = collection.alias?.[cle] ?? toSnake(cle);

    // Un champ sans colonne ferait rejeter l'insertion entière par PostgREST
    if (colonnes && !colonnes.has(colonne)) {
      const signature = `${collection.table}.${colonne}`;
      if (!inconnusSignales.has(signature) && !CHAMPS_TRADUITS.has(colonne)) {
        inconnusSignales.add(signature);
        console.warn(`Champ sans colonne, ignoré : ${signature}`);
      }
      continue;
    }

    row[colonne] = normaliser(collection.table, colonne, v);
  }

  /* Toutes les tables ne sont pas cloisonnées : `interlocuteurs` dépend de son
     client et n'a pas de `societe_id`. L'ajouter ferait rejeter l'insertion
     entière (PGRST204), d'où le même filtre que pour les autres champs. */
  const code = valeur.societeId as string | undefined;
  if (code && (!colonnes || colonnes.has("societe_id"))) {
    row.societe_id = await resolveSocieteId(code);
  }

  if (collection.client) row.client_nom = (valeur.client as string) ?? "";

  // Rapport d'intervention : objet imbriqué → deux colonnes
  const rapport = valeur.rapport as
    | { constatations?: string; preconisations?: string }
    | undefined;
  if (rapport) {
    row.constatations = rapport.constatations ?? "";
    row.preconisations = rapport.preconisations ?? "";
  }

  return row;
}

/** Ligne Postgres (snake_case) → objet HTML (camelCase). */
function versLegacy(
  prefixe: string,
  row: Record<string, unknown>,
  code?: string
): Record<string, unknown> {
  const collection = COLLECTIONS[prefixe];
  const valeur: Record<string, unknown> = {};

  const champParColonne = Object.fromEntries(
    Object.entries(collection.alias ?? {}).map(([champ, col]) => [col, champ])
  );

  for (const [cle, v] of Object.entries(row)) {
    if (CHAMPS_SPECIAUX.has(cle)) continue;
    valeur[champParColonne[cle] ?? toCamel(cle)] = v;
  }

  /* L'identifiant exposé est l'uuid, jamais `legacy_id`.
     Toutes les clés étrangères du schéma pointent vers des uuid : exposer
     l'identifiant hérité casserait chaque référence croisée
     (`interlocuteur.clientId`, `facture.devisId`, `devis.chantierId`…).
     `legacy_id` ne sert qu'à retrouver une ligne issue de kv_store. */
  valeur.id = row.id;
  if (row.legacy_id) valeur.legacyId = row.legacy_id;
  if (row.cree_le) valeur.createdAt = row.cree_le;
  if (code) valeur.societeId = code;

  if (collection.client) valeur.client = row.client_nom ?? "";

  if (prefixe === "intervention") {
    valeur.rapport = {
      constatations: (row.constatations as string) ?? "",
      preconisations: (row.preconisations as string) ?? "",
    };
  }

  return valeur;
}

// ============ CACHE DE COLLECTION ============

/**
 * `loadPrefix()` du HTML enchaîne `stListKeys` puis un `stGet` par clé. On
 * charge donc la collection entière au premier appel, et `stGet` sert depuis ce
 * cache — ce qui évite une requête par enregistrement.
 */
const cache = new Map<string, Record<string, unknown>>();
/** Clé applicative → uuid réel, nécessaire pour écrire les tables filles. */
const uuidParCle = new Map<string, Uuid>();

export function viderCache() {
  cache.clear();
  uuidParCle.clear();
  societeParCode.clear();
  codeParSocieteId.clear();
  societesChargees = false;
}

async function chargerCollection(prefixe: string): Promise<string[]> {
  const collection = COLLECTIONS[prefixe];
  if (!collection) return [];

  await chargerSocietes();

  // La RLS restreint déjà aux sociétés de l'utilisateur ; le HTML filtre
  // ensuite lui-même sur `societeId`. Pour une table fille, on remonte la
  // société du parent dans la même requête.
  const select = collection.societeVia
    ? `*, ${collection.societeVia.table}(societe_id)`
    : "*";
  const { data, error } = await dyn().from(collection.table).select(select);
  if (error) {
    console.error(`Chargement de ${collection.table} impossible:`, error);
    return [];
  }

  const cles: string[] = [];
  const uuidParPrefixe = new Map<Uuid, string>();

  for (const brut of (data ?? []) as Record<string, unknown>[]) {
    let societeId = brut.societe_id as Uuid | undefined;
    if (collection.societeVia) {
      const parent = brut[collection.societeVia.table] as
        | { societe_id?: Uuid }
        | null;
      societeId = parent?.societe_id;
      delete brut[collection.societeVia.table];
    }

    const valeur = versLegacy(prefixe, brut, await codeSociete(societeId));
    if (collection.lignes) valeur.lignes = [];
    if (collection.photos) valeur.photos = [];

    const cle = `${prefixe}:${valeur.id}`;
    cache.set(cle, valeur);
    uuidParCle.set(cle, brut.id as Uuid);
    uuidParPrefixe.set(brut.id as Uuid, cle);
    cles.push(cle);
  }

  if (collection.lignes && cles.length) {
    await attacher(collection.lignes, uuidParPrefixe, "lignes", ligneVersLegacy);
  }
  if (collection.photos && cles.length) {
    await attacher(
      collection.photos,
      uuidParPrefixe,
      "photos",
      (row) => row.chemin as string
    );
  }

  if (prefixe === "bonCommande" && cles.length) {
    const bcsParUuid = new Map<Uuid, Record<string, unknown>>();
    for (const [uuid, cle] of uuidParPrefixe) {
      const valeur = cache.get(cle);
      if (valeur) bcsParUuid.set(uuid, valeur as Record<string, unknown>);
    }
    await reconstituerWorkflow(bcsParUuid);
  }

  return cles;
}

/* ---------- Circuit de validation ----------
 * L'application historique porte son circuit sur `valideConducteur`,
 * `valideDirecteur` et `metiersFait`, posés sur l'objet bon de commande.
 * Ces champs vivaient dans le JSON de kv_store ; aucune colonne ne leur
 * correspond dans le schéma relationnel, ils étaient donc perdus à chaque
 * enregistrement — le stepper repartait indéfiniment à l'étape 1.
 *
 * La base porte le même circuit sous une autre forme : `planning_taches`
 * (une tâche par métier, statut planifiee → realisee → validee) et
 * `bons_commande.statut_workflow`. On traduit dans les deux sens plutôt que
 * d'ajouter des colonnes qui feraient doublon.
 *
 *   metiersFait[m]     ⟷  la tâche du métier m est réalisée ou validée
 *   valideConducteur   ⟷  toutes les tâches du bon sont validées
 *   valideDirecteur    ⟷  statut_workflow vaut « chiffre » ou « facture »
 */

interface TacheBC {
  id: Uuid;
  bon_commande_id: Uuid | null;
  metier: string | null;
  statut: string | null;
  validee_le: string | null;
  realisee_le: string | null;
  commentaire: string | null;
  croquis: string | null;
  piece_a_commander: boolean | null;
  piece_description: string | null;
  piece_fournisseur: string | null;
  piece_date_commande: string | null;
  sous_traitant_id: Uuid | null;
  date_tache: string | null;
}

/** Noms des sous-traitants, indexés par uuid. L'app les désigne par leur nom. */
let sousTraitantsParUuid: Map<Uuid, string> | null = null;

async function annuaireSousTraitants(): Promise<Map<Uuid, string>> {
  if (sousTraitantsParUuid) return sousTraitantsParUuid;
  const { data, error } = await dyn().from("sous_traitants").select("id, nom");
  if (error) {
    console.error("Annuaire des sous-traitants indisponible", error);
    return new Map();
  }
  sousTraitantsParUuid = new Map(
    ((data ?? []) as { id: Uuid; nom: string }[]).map((s) => [s.id, s.nom])
  );
  return sousTraitantsParUuid;
}

async function uuidSousTraitant(nom: string): Promise<Uuid | null> {
  const annuaire = await annuaireSousTraitants();
  for (const [uuid, n] of annuaire) if (n === nom) return uuid;
  return null;
}

/** Colonnes du circuit, lues d'un bloc pour toute la collection. */
const CHAMPS_TACHE =
  "id, bon_commande_id, metier, statut, validee_le, realisee_le, commentaire," +
  " croquis, piece_a_commander, piece_description, piece_fournisseur," +
  " piece_date_commande, sous_traitant_id, date_tache";

/** Complète les bons de commande chargés avec l'état réel du circuit. */
async function reconstituerWorkflow(
  bcsParUuid: Map<Uuid, Record<string, unknown>>
): Promise<void> {
  const ids = [...bcsParUuid.keys()];
  if (!ids.length) return;

  const { data, error } = await dyn()
    .from("planning_taches")
    .select(CHAMPS_TACHE)
    .in("bon_commande_id", ids);

  if (error) {
    console.error("Circuit de validation indisponible", error);
    return;
  }

  const annuaireST = await annuaireSousTraitants();
  const parBC = new Map<Uuid, TacheBC[]>();
  for (const t of (data ?? []) as TacheBC[]) {
    if (!t.bon_commande_id) continue;
    const liste = parBC.get(t.bon_commande_id);
    if (liste) liste.push(t);
    else parBC.set(t.bon_commande_id, [t]);
  }

  for (const [uuid, bc] of bcsParUuid) {
    const taches = parBC.get(uuid) ?? [];
    const faite = (t: TacheBC) => t.statut === "realisee" || t.statut === "validee";

    const metiersFait: Record<string, boolean> = {};
    for (const t of taches) {
      if (t.metier) metiersFait[t.metier] = faite(t);
    }
    bc.metiersFait = metiersFait;

    // Sans tâche rattachée, le bon n'a simplement pas encore été planifié
    bc.dateOrigineFait = taches.length > 0 && taches.every(faite);

    const toutesValidees =
      taches.length > 0 && taches.every((t) => t.statut === "validee");
    bc.valideConducteur = toutesValidees;
    bc.dateValideConducteur = toutesValidees
      ? taches.map((t) => t.validee_le).filter(Boolean).sort().pop() ?? null
      : null;

    const etat = bc.statutWorkflow as string | undefined;
    bc.valideDirecteur = etat === "chiffre" || etat === "facture";

    /* Constats du terrain : l'app les porte sur le bon, la base sur la tâche.
       Une pièce signalée sur n'importe quelle tâche concerne le bon entier. */
    const avecPiece = taches.find((t) => t.piece_a_commander);
    bc.pieceACommander = !!avecPiece;
    bc.pieceACommanderDetail = avecPiece?.piece_description ?? "";
    bc.pieceACommanderFournisseur = avecPiece?.piece_fournisseur ?? "";
    bc.pieceACommanderDateCommande = avecPiece?.piece_date_commande ?? "";

    const avecCommentaire = taches.find((t) => t.commentaire);
    bc.technicienCommentaire = avecCommentaire?.commentaire ?? "";
    bc.technicienDessin = taches.find((t) => t.croquis)?.croquis ?? null;

    /* Le planning sous-traitant filtre sur un nom ; la base référence un uuid. */
    const avecST = taches.find((t) => t.sous_traitant_id);
    bc.sousTraitant = avecST?.sous_traitant_id
      ? annuaireST.get(avecST.sous_traitant_id) ?? ""
      : "";

    /* Une date supplémentaire est une tâche de plus sur une autre journée. */
    const dateOrigine = bc.datePlanifiee as string | undefined;
    const autresDates = [
      ...new Set(
        taches
          .map((t) => t.date_tache)
          .filter((d): d is string => !!d && d !== dateOrigine)
      ),
    ].sort();
    bc.datesSupplementaires = autresDates.map((date) => ({
      date,
      heure: "08:00",
      duree: 1,
      fait: taches
        .filter((t) => t.date_tache === date)
        .every((t) => t.statut === "realisee" || t.statut === "validee"),
    }));
  }
}

/**
 * Traduit les changements du circuit historique en transitions réelles.
 *
 * L'écran coche `metiersFait`, puis pousse `valideConducteur` et
 * `valideDirecteur`. Chacun correspond à une transition que la base sait
 * horodater et attribuer : on la déclenche au lieu de tenter d'écrire des
 * champs qui n'ont pas de colonne.
 *
 * On compare à l'état précédent : sans ça, chaque enregistrement du bon
 * rejouerait des transitions déjà franchies.
 */
async function appliquerWorkflow(
  bcUuid: Uuid,
  cle: string,
  valeur: Record<string, unknown>
): Promise<void> {
  const avant = (cache.get(cle) ?? {}) as Record<string, unknown>;

  const metiersAvant = (avant.metiersFait as Record<string, boolean>) ?? {};
  const metiersApres = (valeur.metiersFait as Record<string, boolean>) ?? {};
  const conducteurFranchi = !avant.valideConducteur && !!valeur.valideConducteur;
  const directeurFranchi = !avant.valideDirecteur && !!valeur.valideDirecteur;

  const metiersCoches = Object.keys(metiersApres).filter(
    (m) => metiersApres[m] && !metiersAvant[m]
  );
  const dateFranchie = !avant.dateOrigineFait && !!valeur.dateOrigineFait;

  /* Constats du terrain : pièce à commander, commentaire, croquis. */
  const CHAMPS_TERRAIN = [
    "pieceACommander",
    "pieceACommanderDetail",
    "pieceACommanderFournisseur",
    "pieceACommanderDateCommande",
    "technicienCommentaire",
    "technicienDessin",
  ] as const;
  const terrainModifie = CHAMPS_TERRAIN.some(
    (c) => (avant[c] ?? "") !== (valeur[c] ?? "")
  );

  const stModifie = (avant.sousTraitant ?? "") !== (valeur.sousTraitant ?? "");

  /* Dates supplémentaires ajoutées depuis la vignette du planning. */
  const datesAvant = new Set(
    ((avant.datesSupplementaires as { date: string }[]) ?? []).map((d) => d.date)
  );
  const datesAjoutees = (
    (valeur.datesSupplementaires as { date: string }[]) ?? []
  )
    .map((d) => d.date)
    .filter((d) => d && !datesAvant.has(d));

  if (
    !metiersCoches.length &&
    !conducteurFranchi &&
    !directeurFranchi &&
    !dateFranchie &&
    !terrainModifie &&
    !stModifie &&
    !datesAjoutees.length
  ) {
    return;
  }

  const { data, error } = await dyn()
    .from("planning_taches")
    .select("id, metier, statut")
    .eq("bon_commande_id", bcUuid);

  if (error) {
    console.error("Circuit de validation : lecture des tâches impossible", error);
    return;
  }
  const taches = (data ?? []) as { id: Uuid; metier: string | null; statut: string | null }[];

  /* L'app historique ne crée pas de tâche : elle coche un métier sur le bon.
     On matérialise la tâche au premier pointage, faute de quoi le circuit
     n'aurait rien sur quoi s'appuyer. */
  const societeUuid = await resolveSocieteId(valeur.societeId as string);
  const libelleBase =
    (valeur.numeroBC as string) || (valeur.client as string) || "Intervention";
  const dateTache =
    (valeur.datePlanifiee as string) || (valeur.dateReception as string) || todayISO();

  async function tachePourMetier(metier: string | null): Promise<Uuid | null> {
    const existante = taches.find((t) => t.metier === metier);
    if (existante) return existante.id;
    if (!societeUuid) return null;

    const creee = await queries.planifierTache(societeUuid, {
      bon_commande_id: bcUuid,
      libelle: metier ? `${libelleBase} — ${metier}` : libelleBase,
      date_tache: dateTache,
      metier,
    });
    taches.push({ id: creee.id, metier, statut: creee.statut });
    return creee.id;
  }

  try {
    for (const metier of metiersCoches) {
      const tacheId = await tachePourMetier(metier);
      const tache = taches.find((t) => t.id === tacheId);
      // Une tâche déjà validée est close : la rouvrir effacerait l'arbitrage
      if (tacheId && tache?.statut !== "realisee" && tache?.statut !== "validee") {
        await queries.marquerRealisee(tacheId);
        if (tache) tache.statut = "realisee";
      }
    }

    /* « Cette date est terminée » vaut pointage de tout ce qui reste ouvert. */
    if (dateFranchie) {
      const metiers = (valeur.metiers as string[])?.length
        ? (valeur.metiers as string[])
        : [(valeur.metier as string) || null];
      for (const metier of metiers) {
        const tacheId = await tachePourMetier(metier);
        const tache = taches.find((t) => t.id === tacheId);
        if (tacheId && tache?.statut !== "realisee" && tache?.statut !== "validee") {
          await queries.marquerRealisee(tacheId);
          if (tache) tache.statut = "realisee";
        }
      }
    }

    if (conducteurFranchi) {
      for (const t of taches.filter((x) => x.statut === "realisee")) {
        await queries.validerTache(t.id, true);
      }
    }

    /* Les constats vont sur la tâche du bon. La pièce est signalée pour
       l'ensemble : on la porte sur la première tâche, qui suffit à la faire
       remonter dans « Pièces en commande ». */
    if (terrainModifie) {
      const cible =
        taches[0]?.id ??
        (await tachePourMetier(
          (valeur.metiers as string[])?.[0] ?? (valeur.metier as string) ?? null
        ));

      if (cible) {
        const maj: Record<string, unknown> = {
          piece_a_commander: !!valeur.pieceACommander,
          piece_description: (valeur.pieceACommanderDetail as string) || null,
          piece_fournisseur: (valeur.pieceACommanderFournisseur as string) || null,
          piece_date_commande:
            (valeur.pieceACommanderDateCommande as string) || null,
        };
        const commentaire = valeur.technicienCommentaire as string | undefined;
        if (commentaire !== undefined) maj.commentaire = commentaire || null;
        const croquis = valeur.technicienDessin as string | null | undefined;
        if (croquis !== undefined) maj.croquis = croquis || null;

        await queries.updateTache(cible, maj);
      }
    }

    /* Assigner un sous-traitant vaut pour tout le bon : la vignette du
       planning en porte un seul, et la base le référence par uuid. */
    if (stModifie) {
      const nom = (valeur.sousTraitant as string) || "";
      const stId = nom ? await uuidSousTraitant(nom) : null;
      if (nom && !stId) {
        console.warn(`Sous-traitant inconnu, assignation ignorée : ${nom}`);
      } else {
        const cible = taches.length
          ? taches.map((t) => t.id)
          : [await tachePourMetier((valeur.metier as string) || null)].filter(
              (x): x is Uuid => !!x
            );
        for (const id of cible) {
          await queries.updateTache(id, { sous_traitant_id: stId });
        }
      }
    }

    /* Une date supplémentaire devient une tâche sur cette journée-là. */
    if (datesAjoutees.length && societeUuid) {
      const metiers = (valeur.metiers as string[])?.length
        ? (valeur.metiers as string[])
        : [(valeur.metier as string) || null];
      for (const date of datesAjoutees) {
        for (const metier of metiers) {
          await queries.planifierTache(societeUuid, {
            bon_commande_id: bcUuid,
            libelle: metier ? `${libelleBase} — ${metier}` : libelleBase,
            date_tache: date,
            metier,
          });
        }
      }
    }

    if (directeurFranchi) {
      // Le passage à « chiffré » est la signature du directeur avant facturation
      await queries.passerPretAChiffrer(bcUuid).catch(() => undefined);
      const { error: err } = await supabase.rpc("bc_chiffrage_valide", {
        p_bc_id: bcUuid,
      });
      if (err) throw err;
    }
  } catch (err) {
    console.error("Circuit de validation : transition refusée", err);
  }
}

/** Rattache les lignes filles en une requête pour toute la collection. */
async function attacher(
  enfant: { table: TableName; fk: string },
  uuidParPrefixe: Map<Uuid, string>,
  champ: "lignes" | "photos",
  mapper: (row: Record<string, unknown>) => unknown
) {
  const { data, error } = await dyn()
    .from(enfant.table)
    .select("*")
    .in(enfant.fk, [...uuidParPrefixe.keys()])
    .order("position", { ascending: true });

  if (error) {
    console.error(`Chargement de ${enfant.table} impossible:`, error);
    return;
  }

  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const cle = uuidParPrefixe.get(row[enfant.fk] as Uuid);
    const parent = cle ? cache.get(cle) : undefined;
    if (!parent) continue;
    (parent[champ] as unknown[]).push(mapper(row));
  }
}

// ============ SURFACE ATTENDUE PAR LE HTML ============

function decouper(cle: string): [string, string] {
  const i = cle.indexOf(":");
  return i < 0 ? [cle, ""] : [cle.slice(0, i), cle.slice(i + 1)];
}

/** Remplace : `async function stGet(key)`. */
export async function stGet(cle: string): Promise<unknown | null> {
  if (!cle) return null;
  const [prefixe, id] = decouper(cle);

  if (prefixe === "settings") return lireSettings(id);
  if (!COLLECTIONS[prefixe]) return null;

  const enCache = cache.get(cle);
  if (enCache) return enCache;

  await chargerCollection(prefixe);
  return cache.get(cle) ?? null;
}

/** Remplace : `async function stSet(key, val)`. */
export async function stSet(
  cle: string,
  valeur: Record<string, unknown>
): Promise<boolean> {
  if (!cle || !valeur) return false;
  const [prefixe, id] = decouper(cle);

  if (prefixe === "settings") return ecrireSettings(id, valeur);

  const collection = COLLECTIONS[prefixe];
  if (!collection) {
    console.warn("Préfixe inconnu, écriture ignorée:", prefixe);
    return false;
  }

  try {
    const row = await versDb(prefixe, valeur);

    /* Une ligne existante est adressée par son uuid. Un identifiant base36
       ne peut venir que d'une reprise kv_store : on le range dans `legacy_id`
       et Postgres génère la clé primaire. */
    if (estUuid(id)) {
      row.id = id;
    } else {
      const uuid = uuidParCle.get(cle) ?? (await chercherUuid(collection.table, id));
      if (uuid) row.id = uuid;
      else if (id) row.legacy_id = id;
    }

    const { data, error } = await dyn()
      .from(collection.table)
      .upsert(row)
      .select()
      .single();
    if (error) throw error;

    const parentId = (data as Record<string, unknown>).id as Uuid;
    uuidParCle.set(cle, parentId);

    if (collection.lignes) {
      const lignes = (valeur.lignes as LigneLegacy[]) ?? [];
      await remplacerEnfants(
        collection.lignes,
        parentId,
        lignes.map((l, i) => ({
          ...ligneVersDb(l, i),
          [collection.lignes!.fk]: parentId,
        }))
      );
    }

    if (collection.photos) {
      // Les data-URL n'ont pas leur place en base : seules les références
      // Storage sont persistées (voir `uploadFile`).
      const chemins = ((valeur.photos as string[]) ?? []).filter(
        (p) => typeof p === "string" && !p.startsWith("data:")
      );
      await remplacerEnfants(
        collection.photos,
        parentId,
        chemins.map((chemin, position) => ({
          [collection.photos!.fk]: parentId,
          chemin,
          position,
        }))
      );
    }

    if (prefixe === "bonCommande") {
      await appliquerWorkflow(parentId, cle, valeur);
    }

    cache.set(cle, { ...valeur, id });
    return true;
  } catch (err) {
    const e = err as { message?: string; details?: string; hint?: string; code?: string };
    console.error(
      `Enregistrement de ${cle} refusé par la base`,
      { code: e.code, message: e.message, details: e.details, hint: e.hint },
      err
    );
    return false;
  }
}

/** Retrouve l'uuid d'une ligne à partir de son identifiant hérité. */
async function chercherUuid(table: TableName, legacyId: string): Promise<Uuid | null> {
  if (!legacyId) return null;
  const { data } = await dyn()
    .from(table)
    .select("id")
    .eq("legacy_id", legacyId)
    .maybeSingle();
  return (data as { id: Uuid } | null)?.id ?? null;
}

async function remplacerEnfants(
  enfant: { table: TableName; fk: string },
  parentId: Uuid,
  rows: Record<string, unknown>[]
) {
  await dyn().from(enfant.table).delete().eq(enfant.fk, parentId);
  if (rows.length) await dyn().from(enfant.table).insert(rows);
}

/** Remplace : `async function stDelete(key)`. */
export async function stDelete(cle: string): Promise<boolean> {
  if (!cle) return false;
  const [prefixe, id] = decouper(cle);

  const collection = COLLECTIONS[prefixe];
  if (!collection) return false;

  const uuid = estUuid(id)
    ? id
    : uuidParCle.get(cle) ?? (await chercherUuid(collection.table, id));
  if (!uuid) return false;

  const { error } = await dyn().from(collection.table).delete().eq("id", uuid);
  if (error) {
    console.error("stDelete error:", error);
    return false;
  }

  cache.delete(cle);
  uuidParCle.delete(cle);
  return true;
}

/** Remplace : `async function stListKeys(prefix)`. */
export async function stListKeys(prefixe: string): Promise<string[]> {
  const net = prefixe.endsWith(":") ? prefixe.slice(0, -1) : prefixe;
  if (!COLLECTIONS[net]) return [];
  return chargerCollection(net);
}

// ============ NUMÉROTATION ============

/** Le HTML nomme le type « bonCommande » là où la base attend « bon_commande ». */
const TYPES: Record<string, TypeDocument> = {
  devis: "devis",
  facture: "facture",
  intervention: "intervention",
  bonCommande: "bon_commande",
  bon_commande: "bon_commande",
  sav: "sav",
};

/** Remplace : `nextNumero(societeId, type)` — désormais atomique côté serveur. */
export async function nextNumero(code: string, type: string): Promise<string> {
  return getNextNumero(await resolveSocieteId(code), TYPES[type] ?? "devis");
}

export async function nextSAVNumero(code: string): Promise<string> {
  return getNextNumero(await resolveSocieteId(code), "sav");
}

// ============ RÉGLAGES ============

/**
 * L'app attend un objet plat (`s.adresse`, `s.siret`, `s.logo`…) utilisé par
 * l'en-tête des devis, factures et rapports. En base, l'identité légale est
 * portée par des colonnes de `societes`, et le reste par le jsonb
 * `societe_settings.infos_entreprise`. On recompose donc à la lecture, et on
 * réoriente chaque champ vers sa destination à l'écriture.
 */
const CHAMPS_SOCIETE: Record<string, string> = {
  adresse: "adresse",
  codePostal: "code_postal",
  ville: "ville",
  telephone: "telephone",
  email: "email",
  siret: "siret",
  nom: "nom",
};

async function lireSettings(code: string): Promise<Record<string, unknown>> {
  const societeId = await resolveSocieteId(code);
  const [societe, settings] = await Promise.all([
    queries.getSociete(societeId),
    queries.getSocieteSettings(societeId),
  ]);

  const plat: Record<string, unknown> = {};
  if (societe) {
    for (const [champ, colonne] of Object.entries(CHAMPS_SOCIETE)) {
      plat[champ] = (societe as unknown as Record<string, unknown>)[colonne] ?? "";
    }
  }

  // Les préférences libres priment sur les colonnes, comme dans l'écran Réglages
  const libres = (settings?.infos_entreprise as Record<string, unknown>) ?? {};
  Object.assign(plat, libres);
  plat.notifsTraitees = settings?.notifs_traitees ?? [];
  // Toujours complet, même sans document stocké : l'app peut lire sans garde
  plat.reglages = fusionnerReglages(libres.reglages);
  return plat;
}

async function ecrireSettings(
  code: string,
  valeur: Record<string, unknown>
): Promise<boolean> {
  try {
    const societeId = await resolveSocieteId(code);

    const colonnes: Record<string, unknown> = {};
    const libres: Record<string, unknown> = {};
    for (const [champ, v] of Object.entries(valeur)) {
      if (champ === "notifsTraitees") continue;
      const colonne = CHAMPS_SOCIETE[champ];
      if (colonne) colonnes[colonne] = v === "" ? null : v;
      else libres[champ] = v;
    }

    await Promise.all([
      Object.keys(colonnes).length
        ? queries.updateSociete(societeId, colonnes)
        : Promise.resolve(),
      queries.saveSocieteSettings(societeId, {
        infos_entreprise: libres as Json,
        notifs_traitees: (valeur.notifsTraitees as string[]) ?? [],
      }),
    ]);
    return true;
  } catch (err) {
    console.error("Écriture des réglages impossible:", err);
    return false;
  }
}

// ============ CHARGEMENT COMPLET ============

/** Instantané complet d'une société, pour l'export et les écrans de synthèse. */
export async function loadAllData(code: string): Promise<TerrainData> {
  const societeId = await resolveSocieteId(code);

  const [
    societe,
    settings,
    clients,
    articles,
    metiers,
    devis,
    factures,
    reglements,
    bonsCommande,
    interventions,
    chantiers,
    salaries,
    conducteurs,
    techniciens,
    sousTraitants,
    vehicules,
    materiels,
    fournisseursControle,
    documentsLegaux,
  ] = await Promise.all([
    queries.getSociete(societeId),
    queries.getSocieteSettings(societeId),
    queries.listClients(societeId),
    queries.listArticles(societeId),
    queries.listMetiers(societeId),
    queries.listDevisComplets(societeId),
    queries.listFacturesCompletes(societeId),
    queries.listReglements(societeId),
    queries.listBonsCommandeComplets(societeId),
    queries.listInterventionsCompletes(societeId),
    queries.listChantiersComplets(societeId),
    queries.listSalariesComplets(societeId),
    queries.listConducteurs(societeId),
    queries.listTechniciens(societeId),
    queries.listSousTraitants(societeId),
    queries.listVehicules(societeId),
    queries.listMateriels(societeId),
    queries.listFournisseursControle(societeId),
    queries.listDocumentsLegaux(societeId),
  ]);

  // Une requête pour tous les clients, pas une par client
  const parClient = await listByParents(
    "interlocuteurs",
    "client_id",
    clients.map((c) => c.id),
    "nom"
  );
  const interlocuteurs = [...parClient.values()].flat();

  return {
    societe,
    settings,
    clients,
    interlocuteurs,
    articles,
    metiers,
    devis,
    factures,
    reglements,
    bons_commande: bonsCommande,
    interventions,
    chantiers,
    salaries,
    conducteurs,
    techniciens,
    sous_traitants: sousTraitants,
    vehicules,
    materiels,
    fournisseurs_controle: fournisseursControle,
    documents_legaux: documentsLegaux,
  };
}

export async function exportAllData(code: string, filename?: string): Promise<Blob> {
  const data = await loadAllData(code);
  const blob = new Blob(
    [
      JSON.stringify(
        { version: 2, exportedAt: new Date().toISOString(), codeSociete: code, ...data },
        null,
        2
      ),
    ],
    { type: "application/json" }
  );

  if (typeof window !== "undefined") {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `terrain-export-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return blob;
}

// ============ INJECTION GLOBALE ============

/** Substitue les implémentations kv_store du HTML. À appeler avant son `init()`. */
export function injectGlobalFunctions() {
  if (typeof window === "undefined") return;
  const w = window as unknown as Record<string, unknown>;

  w.stGet = stGet;
  w.stSet = stSet;
  w.stDelete = stDelete;
  w.stListKeys = stListKeys;
  w.nextNumero = nextNumero;
  w.nextSAVNumero = nextSAVNumero;
  w.loadAllData = loadAllData;
  w.exportAllData = exportAllData;

  console.log("✅ Accès données branché sur les tables Supabase (kv_store retiré)");
}
