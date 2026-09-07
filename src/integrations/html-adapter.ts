/**
 * HTML Adapter - Bridge entre le HTML original et les vraies API Supabase
 *
 * Remplace:
 * - stGet/stSet/stDelete/stListKeys (kv_store)
 * - nextNumero/nextSAVNumero
 * - loadAll/exportData/importData
 *
 * ✅ Zéro modification du HTML nécessaire
 * ✅ Les fonctions globales restent les mêmes
 * ✅ On juste change l'implémentation
 */

import { supabase, getNextNumero, uid, todayISO } from "@/api/client";
import * as queries from "@/api/queries";
import type { TerrainData } from "@/api/types";

// ============ KV_STORE REPLACEMENT ============

/**
 * Remplace: async function stGet(key) { ... }
 * Récupère une valeur JSON depuis une table Supabase
 *
 * Format clé: "prefix:id" → table: prefix, filter: id
 */
export async function stGet(key: string): Promise<any | null> {
  if (!key) return null;

  try {
    const [prefix, id] = key.split(":");
    if (!prefix || !id) {
      console.warn("Invalid key format:", key);
      return null;
    }

    // Déterminer la table et la colonne d'ID
    const tableMap: Record<string, string> = {
      devis: "id",
      facture: "id",
      intervention: "id",
      bonCommande: "id",
      client: "id",
      article: "id",
      document: "id",
      reglement: "id",
      interlocuteur: "id",
      conducteur: "id",
      technicien: "id",
      metierPerso: "id",
      sousTraitant: "id",
      chantier: "id",
      salarie: "id",
      vehicule: "id",
      materiel: "id",
      settings: "societe_id",
      counters: "societe_id",
    };

    const table = tableMap[prefix];
    if (!table) {
      console.warn("Unknown prefix:", prefix);
      return null;
    }

    const { data, error } = await supabase
      .from(prefix)
      .select("*")
      .eq(table, id)
      .single();

    if (error || !data) {
      console.debug(`stGet miss: ${key}`);
      return null;
    }

    return data;
  } catch (err) {
    console.error("stGet error:", err);
    return null;
  }
}

/**
 * Remplace: async function stSet(key, val) { ... }
 * Écrit/met à jour une valeur JSON
 */
export async function stSet(key: string, val: any): Promise<boolean> {
  if (!key || !val) return false;

  try {
    const [prefix, id] = key.split(":");

    const { error } = await supabase
      .from(prefix)
      .upsert({ id, ...val }, { onConflict: "id" });

    if (error) {
      console.error("stSet error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("stSet error:", err);
    return false;
  }
}

/**
 * Remplace: async function stDelete(key) { ... }
 */
export async function stDelete(key: string): Promise<boolean> {
  if (!key) return false;

  try {
    const [prefix, id] = key.split(":");

    const { error } = await supabase
      .from(prefix)
      .delete()
      .eq("id", id);

    if (error) {
      console.error("stDelete error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.error("stDelete error:", err);
    return false;
  }
}

/**
 * Remplace: async function stListKeys(prefix) { ... }
 * Liste toutes les clés commençant par un préfixe
 */
export async function stListKeys(prefix: string): Promise<string[]> {
  if (!prefix) return [];

  try {
    const { data, error } = await supabase
      .from(prefix)
      .select("id");

    if (error || !data) return [];

    return data.map((row: any) => `${prefix}:${row.id}`);
  } catch (err) {
    console.error("stListKeys error:", err);
    return [];
  }
}

// ============ NUMÉROTATION ============

/**
 * Remplace: async function nextNumero(societeId, type) { ... }
 * Utilise la fonction Supabase qui est atomique
 */
export async function nextNumero(
  societeId: string,
  type: "devis" | "facture" | "intervention" | "bonCommande" | "sav"
): Promise<string> {
  return getNextNumero(societeId, type);
}

/**
 * Remplace: async function nextSAVNumero(societeId) { ... }
 */
export async function nextSAVNumero(societeId: string): Promise<string> {
  return getNextNumero(societeId, "sav");
}

// ============ HELPERS ============

/**
 * Remplace: function uid() { ... }
 * Génère un UUID unique
 */
export function generateUid(): string {
  return uid();
}

/**
 * Remplace: function todayISO() { ... }
 */
export function getTodayISO(): string {
  return todayISO();
}

// ============ LOAD/EXPORT/IMPORT ============

/**
 * Remplace: async function loadAll() { ... }
 * Charge TOUTES les données pour une société (ou plusieurs)
 */
export async function loadAllData(societeId: string): Promise<TerrainData> {
  try {
    const [
      devis,
      factures,
      interventions,
      bonsCommande,
      clients,
      articles,
      documents,
      reglements,
      interlocuteurs,
      conducteurs,
      techniciens,
      metiersPerso,
      sousTraitants,
      chantiers,
      salaries,
      vehicules,
      fournisseursControle,
      materiels,
    ] = await Promise.all([
      queries.listDevis(societeId),
      queries.listFactures(societeId),
      queries.listInterventions(societeId),
      queries.listBonsCommande(societeId),
      queries.listClients(societeId),
      queries.listArticles(societeId),
      queries.listDocuments(societeId),
      queries.listReglements(societeId),
      queries.listInterlocuteurs(societeId),
      queries.listConducteurs(societeId),
      queries.listTechniciens(societeId),
      queries.listMetiersPerso(societeId),
      queries.listSousTraitants(societeId),
      queries.listChantiers(societeId),
      queries.listSalaries(societeId),
      queries.listVehicules(societeId),
      queries.listFournisseursControle(societeId),
      queries.listMateriels(societeId),
    ]);

    return {
      devis,
      factures,
      interventions,
      bons_commande: bonsCommande,
      clients,
      articles,
      documents,
      reglements,
      interlocuteurs,
      conducteurs,
      techniciens,
      metiers_perso: metiersPerso,
      sous_traitants: sousTraitants,
      chantiers,
      salaries,
      vehicules,
      fournisseurs_controle: fournisseursControle,
      materiels,
      settings: {},
      societeIds: { [societeId]: societeId },
    };
  } catch (err) {
    console.error("loadAllData error:", err);
    return {
      devis: [],
      factures: [],
      interventions: [],
      bons_commande: [],
      clients: [],
      articles: [],
      documents: [],
      reglements: [],
      interlocuteurs: [],
      conducteurs: [],
      techniciens: [],
      metiers_perso: [],
      sous_traitants: [],
      chantiers: [],
      salaries: [],
      vehicules: [],
      fournisseurs_controle: [],
      materiels: [],
      settings: {},
      societeIds: {},
    };
  }
}

/**
 * Remplace: async function exportAllData() { ... }
 * Exporte toutes les données en JSON
 */
export async function exportAllData(societeId: string, filename?: string): Promise<Blob> {
  const data = await loadAllData(societeId);

  const json = {
    version: 1,
    exportedAt: new Date().toISOString(),
    societeId,
    ...data,
  };

  const blob = new Blob([JSON.stringify(json, null, 2)], {
    type: "application/json",
  });

  // Déclencher le téléchargement
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

/**
 * Remplace: async function importAllData(file) { ... }
 * Importe un fichier JSON exporté
 */
export async function importAllData(
  file: File,
  societeId: string
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const text = await file.text();
    const json = JSON.parse(text);

    let count = 0;

    // Importer chaque collection
    const collections = {
      devis: queries.createDevis,
      factures: queries.createFacture,
      interventions: queries.createIntervention,
      bons_commande: queries.createBonCommande,
      clients: queries.createClient,
      articles: queries.createArticle,
      documents: queries.createDocument,
      reglements: queries.addReglement,
      interlocuteurs: queries.createInterlocuteur,
      conducteurs: queries.createConducteur,
      techniciens: queries.createTechnicien,
      metiers_perso: queries.createMetierPerso,
      sous_traitants: queries.createSousTraitant,
      chantiers: queries.createChantier,
      salaries: queries.createSalarie,
      vehicules: queries.createVehicule,
      fournisseurs_controle: queries.createFournisseurControle,
      materiels: queries.createMateriel,
    };

    for (const [key, createFn] of Object.entries(collections)) {
      const items = json[key] || [];
      for (const item of items) {
        if (!item || !item.id) continue;
        try {
          // @ts-ignore - createFn est polymorphe
          await createFn(societeId, item);
          count++;
        } catch (err) {
          console.warn(`Failed to import ${key}:`, err);
        }
      }
    }

    return { success: true, count };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, count: 0, error: message };
  }
}

// ============ INJECTION GLOBALE ============

/**
 * Injecte les fonctions dans le scope global du HTML
 * Appelle ça au démarrage de main.ts
 */
export function injectGlobalFunctions() {
  if (typeof window !== "undefined") {
    // KV Store
    (window as any).stGet = stGet;
    (window as any).stSet = stSet;
    (window as any).stDelete = stDelete;
    (window as any).stListKeys = stListKeys;

    // Numérotation
    (window as any).nextNumero = nextNumero;
    (window as any).nextSAVNumero = nextSAVNumero;

    // Helpers
    (window as any).uid = generateUid;
    (window as any).todayISO = getTodayISO;

    // Load/Export/Import
    (window as any).loadAllData = loadAllData;
    (window as any).exportAllData = exportAllData;
    (window as any).importAllData = importAllData;

    console.log("✅ Global functions injected (stGet, stSet, etc.)");
  }
}
