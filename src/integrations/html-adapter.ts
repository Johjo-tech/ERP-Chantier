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
      if (!inconnusSignales.has(signature)) {
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

  return cles;
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
