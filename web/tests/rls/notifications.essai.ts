/**
 * La cloche : alertes marquées « fait » par société (proposition 20260926120000,
 * D-CLI-05), contre la base LOCALE. Clés marquées « essai-rls-notif » et
 * retirées à la fin : la base locale est partagée.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clientNotifications } from "../../src/lib/supabase";
import { ALPHA, BETA, COMPTES, connecte, type Client } from "./cible";

const MARQUE = "essai-rls-notif";
const cle = (suffixe: string) => `${MARQUE}_${suffixe}_${Date.now()}`;
const nt = (c: Client) => clientNotifications(c).from("notifications_traitees");

let admin: Client;
let technicien: Client;
let lecture: Client;
let adminBeta: Client;

beforeAll(async () => {
  [admin, technicien, lecture, adminBeta] = await Promise.all([
    connecte(COMPTES.adminAlpha),
    connecte(COMPTES.technicienAlpha),
    connecte(COMPTES.lectureAlpha),
    connecte(COMPTES.adminBeta),
  ]);
});

afterAll(async () => {
  // Chaque société ne voit que ses lignes : chacune retire les siennes.
  for (const c of [admin, adminBeta]) {
    if (!c) continue;
    const { error } = await nt(c).delete().like("cle", `${MARQUE}%`);
    if (error) console.warn("Nettoyage des alertes d'essai incomplet :", error);
  }
});

describe("[proposition] notifications traitées par société", () => {
  it("un technicien (sans « réglages / modifier ») marque une alerte : toute la société la voit traitée, lui compris", async () => {
    const c = cle("tech");
    const { error } = await nt(technicien).insert({ societe_id: ALPHA, cle: c });
    expect(error).toBeNull();
    const vue = await nt(admin).select("cle, traitee_par").eq("societe_id", ALPHA).eq("cle", c);
    expect(vue.data).toHaveLength(1);
    expect(vue.data?.[0]?.traitee_par).toBe("a1000000-0000-0000-0000-000000000004");
  });

  it("l'auteur est posé par la base : un `traitee_par` fourni est remplacé", async () => {
    const c = cle("auteur");
    await nt(admin).insert({ societe_id: ALPHA, cle: c, traitee_par: "a1000000-0000-0000-0000-000000000004" });
    const vue = await nt(admin).select("traitee_par").eq("cle", c).single();
    expect(vue.data?.traitee_par).not.toBe("a1000000-0000-0000-0000-000000000004");
  });

  it("marquer deux fois n'est pas une erreur (upsert sans doublon)", async () => {
    const c = cle("double");
    const une = await nt(admin).upsert([{ societe_id: ALPHA, cle: c }], { onConflict: "societe_id,cle", ignoreDuplicates: true });
    const deux = await nt(technicien).upsert([{ societe_id: ALPHA, cle: c }], { onConflict: "societe_id,cle", ignoreDuplicates: true });
    expect(une.error).toBeNull();
    expect(deux.error).toBeNull();
    const vue = await nt(admin).select("id").eq("cle", c);
    expect(vue.data).toHaveLength(1);
  });

  it("une autre société ne lit ni n'écrit les alertes d'ALPHA", async () => {
    const c = cle("beta");
    await nt(admin).insert({ societe_id: ALPHA, cle: c });
    const lue = await nt(adminBeta).select("id").eq("cle", c);
    expect(lue.data).toEqual([]);
    const ecrite = await nt(adminBeta).insert({ societe_id: ALPHA, cle: cle("intrus") });
    expect(ecrite.error?.code).toBe("42501");
    expect((await nt(adminBeta).insert({ societe_id: BETA, cle: cle("chez-soi") })).error).toBeNull();
  });

  it("le rôle lecture ne remet pas une alerte « à faire » ; l'admin le peut", async () => {
    const c = cle("suppr");
    await nt(admin).insert({ societe_id: ALPHA, cle: c });
    const refus = await nt(lecture).delete().eq("cle", c).select("id");
    expect(refus.data ?? []).toEqual([]);
    const ok = await nt(admin).delete().eq("cle", c).select("id");
    expect(ok.data).toHaveLength(1);
  });
});
