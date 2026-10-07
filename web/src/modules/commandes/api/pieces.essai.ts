import { describe, expect, it } from "vitest";
import type { Client } from "@/lib/supabase";
import { modifierCommandePiece } from "./pieces";

/**
 * DEF-ECR-02 : « 📦 Commandé » de l'ancien n'enregistrait pas la date de commande (la pièce restait sous
 * « À commander »). web/ l'écrit sur TOUTES les tâches du bon qui portent la pièce, et un refus (aucune
 * ligne écrite) remonte au lieu d'être tu. Le relu en base est couvert par tests/rls/commandes.essai.ts.
 */
function clientFactice(lignesEcrites: number) {
  const appels: { table?: string; champs?: unknown; filtres: [string, unknown][] } = { filtres: [] };
  const requete = {
    update(champs: unknown) {
      appels.champs = champs;
      return requete;
    },
    eq(colonne: string, valeur: unknown) {
      appels.filtres.push([colonne, valeur]);
      return requete;
    },
    select: async () => ({ data: Array.from({ length: lignesEcrites }, (_, i) => ({ id: `t${i}` })), error: null }),
  };
  const client = {
    from(table: string) {
      appels.table = table;
      return requete;
    },
  } as unknown as Client;
  return { client, appels };
}

describe("pièce commandée (DEF-ECR-02)", () => {
  it("la date de commande s'écrit sur toutes les tâches du bon qui portent la pièce", async () => {
    const { client, appels } = clientFactice(2);
    await modifierCommandePiece("b1", { piece_date_commande: "2026-09-28" }, client);
    expect(appels).toEqual({ table: "planning_taches", champs: { piece_date_commande: "2026-09-28" }, filtres: [["bon_commande_id", "b1"], ["piece_a_commander", true]] });
  });

  it("rien d'écrit : le refus remonte, la pièce ne passe pas pour commandée", async () => {
    const { client } = clientFactice(0);
    await expect(modifierCommandePiece("b1", { piece_date_commande: "2026-09-28" }, client)).rejects.toMatchObject({ code: "42501" });
  });
});
