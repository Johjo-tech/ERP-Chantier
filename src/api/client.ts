/**
 * Client Supabase pour ERP Chantier
 *
 * Remplace les appels kv_store du HTML
 * Toutes les requêtes passent par la RLS (row-level security)
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase credentials in .env.local");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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

// ============ HELPERS ============

/**
 * Extraits depuis le HTML original — gardés pour compatibilité
 * mais maintenant utilisent Supabase directement
 */

export function nowHeureFR(): string {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fmtDate(d?: string): string {
  if (!d) return "—";
  const p = d.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function money(n: number | undefined): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(n || 0);
}

// ============ AUTH ============

/**
 * Obtenir la session actuelle
 * Retourne null si pas authentifié
 */
export async function getCurrentSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/**
 * Obtenir l'utilisateur actuel et son rôle
 */
export async function getCurrentUser() {
  const session = await getCurrentSession();
  if (!session) return null;

  const { data: user, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (error) throw new SupabaseError("Failed to fetch user", error.code, error);
  return user;
}

/**
 * Se connecter avec email/mot de passe
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new SupabaseError("Sign in failed", error.code, error);
  }

  return data.session;
}

/**
 * Se déconnecter
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new SupabaseError("Sign out failed", error.code, error);
  }
}

// ============ NUMÉROTATION (atomique côté serveur) ============

/**
 * Générer le prochain numéro pour un type de document
 * Utilise une fonction Supabase pour garantir l'atomicité
 *
 * Remplace: nextNumero() du HTML
 */
export async function getNextNumero(
  societeId: string,
  type: "devis" | "facture" | "intervention" | "bonCommande" | "sav"
): Promise<string> {
  const { data, error } = await supabase
    .rpc("prochain_numero", {
      p_societe_id: societeId,
      p_type: type,
    });

  if (error) {
    throw new SupabaseError(`Failed to generate ${type} number`, error.code, error);
  }

  return data;
}

// ============ GENERIC QUERIES ============

/**
 * Lister tous les enregistrements d'une table pour une société
 */
export async function listBySociete<T>(
  tableName: string,
  societeId: string
): Promise<T[]> {
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .eq("societe_id", societeId);

  if (error) {
    throw new SupabaseError(
      `Failed to list ${tableName}`,
      error.code,
      error
    );
  }

  return data || [];
}

/**
 * Récupérer un seul enregistrement
 */
export async function getOne<T>(
  tableName: string,
  id: string
): Promise<T | null> {
  const { data, error } = await supabase
    .from(tableName)
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows returned (expected pour "pas trouvé")
    throw new SupabaseError(
      `Failed to get ${tableName}`,
      error.code,
      error
    );
  }

  return data || null;
}

/**
 * Créer un nouvel enregistrement
 */
export async function create<T>(
  tableName: string,
  data: Omit<T, "id" | "created_at">
): Promise<T> {
  const { data: result, error } = await supabase
    .from(tableName)
    .insert([data])
    .select()
    .single();

  if (error) {
    throw new SupabaseError(
      `Failed to create ${tableName}`,
      error.code,
      error
    );
  }

  return result;
}

/**
 * Mettre à jour un enregistrement
 */
export async function update<T>(
  tableName: string,
  id: string,
  updates: Partial<T>
): Promise<T> {
  const { data, error } = await supabase
    .from(tableName)
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new SupabaseError(
      `Failed to update ${tableName}`,
      error.code,
      error
    );
  }

  return data;
}

/**
 * Supprimer un enregistrement
 */
export async function remove(tableName: string, id: string): Promise<void> {
  const { error } = await supabase
    .from(tableName)
    .delete()
    .eq("id", id);

  if (error) {
    throw new SupabaseError(
      `Failed to delete from ${tableName}`,
      error.code,
      error
    );
  }
}

// ============ STORAGE (fichiers) ============

/**
 * Uploader un fichier
 * Chemin: <societeId>/<domaine>/<entityId>/<filename>
 */
export async function uploadFile(
  societeId: string,
  domain: string,
  entityId: string,
  file: File
): Promise<string> {
  const fileName = `${Date.now()}_${file.name}`;
  const path = `${societeId}/${domain}/${entityId}/${fileName}`;

  const { error } = await supabase.storage.from("terrain").upload(path, file);

  if (error) {
    throw new SupabaseError("Upload failed", error.name, error);
  }

  return path;
}

/**
 * Obtenir l'URL publique d'un fichier
 */
export function getFileUrl(path: string): string {
  const { data } = supabase.storage
    .from("terrain")
    .getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Supprimer un fichier
 */
export async function deleteFile(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from("terrain")
    .remove([path]);

  if (error) {
    throw new SupabaseError("Delete file failed", error.name, error);
  }
}

// ============ REAL-TIME (pour UI reactive) ============

/**
 * S'abonner aux changements d'une table
 */
export function onTableChange(
  tableName: string,
  societeId: string,
  callback: (payload: any) => void
) {
  const subscription = supabase
    .channel(`${tableName}:${societeId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: tableName,
        filter: `societe_id=eq.${societeId}`,
      },
      callback
    )
    .subscribe();

  return subscription;
}

/**
 * Arrêter l'abonnement
 */
export async function offTableChange(subscription: any) {
  await supabase.removeChannel(subscription);
}
