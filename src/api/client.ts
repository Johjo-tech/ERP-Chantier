/**
 * Client Supabase pour ERP Chantier
 *
 * Toutes les tables sont protégées par RLS et cloisonnées par société :
 * chaque requête suppose une session authentifiée (voir integrations/auth-guard).
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type {
  TableName,
  Tables,
  TablesInsert,
  TablesUpdate,
  TypeDocument,
  Uuid,
} from "./types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase credentials in .env.local");
}

// Le client est typé par le schéma généré : chaque `from()`, `select()` et
// `insert()` est vérifié à la compilation contre les vraies colonnes.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// ============ TYPES D'ERREUR ============

export class SupabaseError extends Error {
  constructor(
    public message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "SupabaseError";
  }
}

/** PostgREST renvoie ce code quand `.single()` ne trouve aucune ligne. */
export const NO_ROWS = "PGRST116";

// ============ HELPERS ============

/**
 * Les clés primaires sont des `uuid` avec valeur par défaut en base : on laisse
 * Postgres les générer plutôt que d'en fabriquer côté client. L'identifiant
 * base36 de l'app historique se range dans la colonne `legacy_id`.
 */
export function estUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/**
 * Date du jour en AAAA-MM-JJ, dans le fuseau de l'utilisateur.
 *
 * `toISOString()` bascule en UTC : avant 01h ou 02h à Paris, il renvoie la
 * veille. Les dates de l'app sont des dates civiles, pas des instants.
 */
export function todayISO(): string {
  return dateISO(new Date());
}

/** Formate une date locale en AAAA-MM-JJ, sans décalage de fuseau. */
export function dateISO(d: Date): string {
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mois}-${jour}`;
}

export function nowHeureFR(): string {
  const d = new Date();
  return (
    String(d.getHours()).padStart(2, "0") +
    ":" +
    String(d.getMinutes()).padStart(2, "0")
  );
}

export function fmtDate(d?: string): string {
  if (!d) return "—";
  const p = d.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}

export function money(n: number | undefined): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n || 0);
}

// ============ AUTH ============

export async function getCurrentSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw new SupabaseError("Sign in failed", error.code, error);
  return data.session;
}

/**
 * Envoie un lien de réinitialisation.
 *
 * `redirectTo` doit pointer vers une page de l'app capable de recevoir la
 * session « recovery » que Supabase pose au retour.
 */
export async function demanderReinitialisation(email: string) {
  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/nouveau-mot-de-passe.html`
      : undefined;

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo,
  });
  if (error) throw new SupabaseError("Reset failed", error.code, error);
}

/** Définit le mot de passe de la session en cours. */
export async function definirMotDePasse(motDePasse: string) {
  const { error } = await supabase.auth.updateUser({ password: motDePasse });
  if (error) throw new SupabaseError("Password update failed", error.code, error);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new SupabaseError("Sign out failed", error.code, error);
}

// ============ NUMÉROTATION ============

/**
 * Prochain numéro de document, incrémenté atomiquement côté serveur.
 *
 * Le compteur est porté par le triplet (société, type, année) : la RPC prend
 * donc `p_annee` en plus — signature `prochain_numero(p_annee, p_societe, p_type)`.
 */
export async function getNextNumero(
  societeId: Uuid,
  type: TypeDocument,
  annee: number = new Date().getFullYear()
): Promise<string> {
  const { data, error } = await supabase.rpc("prochain_numero", {
    p_annee: annee,
    p_societe: societeId,
    p_type: type,
  });

  if (error) {
    throw new SupabaseError(
      `Failed to generate ${type} number`,
      error.code,
      error
    );
  }

  return data as string;
}

// ============ REQUÊTES GÉNÉRIQUES ============

/**
 * Le client typé exige un nom de table littéral : avec 77 tables, un nom
 * dynamique fait exploser l'inférence. Ces helpers prennent donc le nom en
 * paramètre de type, ce qui leur rend le typage exact du retour
 * (`listBySociete("devis", id)` donne bien `Devis[]`), et n'échappent au
 * typage qu'ici, sur une seule ligne.
 */
export function dyn() {
  return supabase as unknown as {
    from: (table: string) => any;
  };
}

export async function listBySociete<T extends TableName>(
  table: T,
  societeId: Uuid
): Promise<Tables<T>[]> {
  const { data, error } = await dyn()
    .from(table)
    .select("*")
    .eq("societe_id", societeId)
    .order("cree_le", { ascending: false });

  if (error) throw new SupabaseError(`Failed to list ${table}`, error.code, error);
  return (data ?? []) as Tables<T>[];
}

/** Lignes filles d'un document parent, dans leur ordre d'affichage. */
export async function listByParent<T extends TableName>(
  table: T,
  parentColumn: string,
  parentId: Uuid,
  orderBy = "position"
): Promise<Tables<T>[]> {
  const { data, error } = await dyn()
    .from(table)
    .select("*")
    .eq(parentColumn, parentId)
    .order(orderBy, { ascending: true });

  if (error) throw new SupabaseError(`Failed to list ${table}`, error.code, error);
  return (data ?? []) as Tables<T>[];
}

/**
 * Lignes filles de plusieurs parents en une seule requête.
 *
 * Évite le N+1 : charger 100 devis avec leurs lignes doit coûter deux requêtes,
 * pas cent une. Le résultat est groupé par identifiant de parent.
 */
export async function listByParents<T extends TableName>(
  table: T,
  parentColumn: string,
  parentIds: Uuid[],
  orderBy = "position"
): Promise<Map<Uuid, Tables<T>[]>> {
  const groupes = new Map<Uuid, Tables<T>[]>();
  if (!parentIds.length) return groupes;

  const { data, error } = await dyn()
    .from(table)
    .select("*")
    .in(parentColumn, parentIds)
    .order(orderBy, { ascending: true });

  if (error) throw new SupabaseError(`Failed to list ${table}`, error.code, error);

  for (const ligne of (data ?? []) as Record<string, unknown>[]) {
    const parent = ligne[parentColumn] as Uuid;
    const liste = groupes.get(parent);
    if (liste) liste.push(ligne as Tables<T>);
    else groupes.set(parent, [ligne as Tables<T>]);
  }
  return groupes;
}

export async function getOne<T extends TableName>(
  table: T,
  id: Uuid
): Promise<Tables<T> | null> {
  const { data, error } = await dyn()
    .from(table)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error && error.code !== NO_ROWS) {
    throw new SupabaseError(`Failed to get ${table}`, error.code, error);
  }
  return (data as Tables<T>) ?? null;
}

/** Recherche par identifiant hérité de kv_store (colonne `legacy_id`). */
export async function getByLegacyId<T extends TableName>(
  table: T,
  legacyId: string
): Promise<Tables<T> | null> {
  const { data, error } = await dyn()
    .from(table)
    .select("*")
    .eq("legacy_id", legacyId)
    .maybeSingle();

  if (error && error.code !== NO_ROWS) {
    throw new SupabaseError(`Failed to get ${table}`, error.code, error);
  }
  return (data as Tables<T>) ?? null;
}

export async function insertOne<T extends TableName>(
  table: T,
  row: TablesInsert<T>
): Promise<Tables<T>> {
  const { data, error } = await dyn().from(table).insert(row).select().single();

  if (error) throw new SupabaseError(`Failed to create ${table}`, error.code, error);
  return data as Tables<T>;
}

export async function insertMany<T extends TableName>(
  table: T,
  rows: TablesInsert<T>[]
): Promise<Tables<T>[]> {
  if (!rows.length) return [];
  const { data, error } = await dyn().from(table).insert(rows).select();

  if (error) throw new SupabaseError(`Failed to create ${table}`, error.code, error);
  return (data ?? []) as Tables<T>[];
}

/** Insertion idempotente sur `legacy_id`, pour la reprise depuis kv_store. */
export async function upsertByLegacyId<T extends TableName>(
  table: T,
  row: TablesInsert<T>
): Promise<Tables<T>> {
  const { data, error } = await dyn()
    .from(table)
    .upsert(row, { onConflict: "societe_id,legacy_id" })
    .select()
    .single();

  if (error) throw new SupabaseError(`Failed to upsert ${table}`, error.code, error);
  return data as Tables<T>;
}

export async function updateOne<T extends TableName>(
  table: T,
  id: Uuid,
  updates: TablesUpdate<T>
): Promise<Tables<T>> {
  const { data, error } = await dyn()
    .from(table)
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new SupabaseError(`Failed to update ${table}`, error.code, error);
  return data as Tables<T>;
}

export async function remove(table: TableName, id: Uuid): Promise<void> {
  const { error } = await dyn().from(table).delete().eq("id", id);
  if (error) {
    throw new SupabaseError(`Failed to delete from ${table}`, error.code, error);
  }
}

export async function removeByParent(
  table: TableName,
  parentColumn: string,
  parentId: Uuid
): Promise<void> {
  const { error } = await dyn().from(table).delete().eq(parentColumn, parentId);
  if (error) {
    throw new SupabaseError(`Failed to clear ${table}`, error.code, error);
  }
}

// ============ STORAGE ============

export const BUCKET = "terrain";

/** Chemin de stockage : `<societeId>/<domaine>/<entityId>/<horodatage>_<nom>`. */
export async function uploadFile(
  societeId: Uuid,
  domain: string,
  entityId: Uuid,
  file: File
): Promise<string> {
  const path = `${societeId}/${domain}/${entityId}/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) throw new SupabaseError("Upload failed", error.name, error);
  return path;
}

export function getFileUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new SupabaseError("Delete file failed", error.name, error);
}

// ============ TEMPS RÉEL ============

export function onTableChange(
  table: TableName,
  societeId: Uuid,
  callback: (payload: unknown) => void
) {
  return supabase
    .channel(`${table}:${societeId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: `societe_id=eq.${societeId}`,
      },
      callback
    )
    .subscribe();
}

export async function offTableChange(subscription: { unsubscribe: () => void }) {
  await supabase.removeChannel(subscription as never);
}
