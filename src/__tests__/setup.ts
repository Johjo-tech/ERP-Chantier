/**
 * Setup des tests
 * Initialise l'environnement de test Supabase
 */

import { beforeAll, afterAll, beforeEach } from "vitest";
import { supabase } from "@/api/client";

// ============ SETUP GLOBAL ============

beforeAll(async () => {
  console.log("🧪 Test environment initializing...");

  // Vérifier la connexion Supabase
  try {
    const { data, error } = await supabase.from("clients").select("count", { count: "exact" });
    if (error) {
      console.error("❌ Supabase connection failed:", error);
      throw error;
    }
    console.log("✅ Supabase connected");
  } catch (err) {
    console.error("❌ Setup failed:", err);
    throw err;
  }
});

// ============ CLEANUP ============

afterAll(async () => {
  console.log("🧹 Cleaning up test data...");

  // TODO: Nettoyer les données de test
  // Pour l'instant, les données restent dans la BD
  // À implémenter: transaction que rollback à la fin des tests

  console.log("✅ Test environment cleaned up");
});

// ============ FIXTURES ============

beforeEach(() => {
  // Réinitialiser l'état si nécessaire
});
