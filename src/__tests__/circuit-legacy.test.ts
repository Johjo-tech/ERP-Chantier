/**
 * Circuit de validation historique, rebranché sur la base.
 *
 * L'application porte son circuit sur `metiersFait`, `valideConducteur` et
 * `valideDirecteur`, qui n'ont aucune colonne : ils étaient perdus à chaque
 * enregistrement. Ces tests vérifient la traduction dans les deux sens.
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as queries from "@/api/queries";
import { stGet, stListKeys, stSet } from "@/integrations/html-adapter";
import type { Uuid } from "@/api/types";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";

const suite = AUTH_DISPONIBLE ? describe : describe.skip;

/** Force la relecture depuis la base, cache vidé, comme un rechargement. */
async function relire(): Promise<Record<string, unknown>[]> {
  const cles = await stListKeys("bonCommande:");
  const bcs: Record<string, unknown>[] = [];
  for (const c of cles) {
    const v = (await stGet(c)) as Record<string, unknown> | null;
    if (v) bcs.push(v);
  }
  return bcs;
}

suite("Circuit de validation de l'app historique", () => {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  let societeId: Uuid;
  let bcId: Uuid;
  let cle: string;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    societeId = societe!.id;

    const bc = await queries.createBonCommande(societeId, {
      client_nom: "CLIENT DE TEST",
      date: aujourdhui,
      date_planifiee: aujourdhui,
      metiers: ["PEINTURE", "SOL"],
    });
    bcId = bc.id;
    cle = `bonCommande:${bcId}`;

    // Recharge la collection : c'est ce que fait l'app au démarrage
    await relire();
  });

  it("part d'un circuit vierge", async () => {
    const bc = (await stGet(cle)) as Record<string, unknown>;
    expect(bc.valideConducteur).toBeFalsy();
    expect(bc.valideDirecteur).toBeFalsy();
  });

  it("matérialise une tâche quand le technicien coche un métier", async () => {
    const bc = (await stGet(cle)) as Record<string, unknown>;
    await stSet(cle, { ...bc, metiersFait: { PEINTURE: true } });

    const taches = await queries.listTachesBonCommande(bcId);
    const peinture = taches.find((t) => t.metier === "PEINTURE");
    expect(peinture).toBeTruthy();
    expect(peinture!.statut).toBe("realisee");
  });

  it("ne valide pas le conducteur tant qu'un métier reste ouvert", async () => {
    const bc = (await relire()).find((b) => b.id === bcId)!;
    // PEINTURE faite, SOL pas encore : le stepper reste à l'étape 1
    expect(bc.valideConducteur).toBe(false);
    expect((bc.metiersFait as Record<string, boolean>).PEINTURE).toBe(true);
  });

  it("valide le conducteur une fois tous les métiers pointés", async () => {
    let bc = (await stGet(cle)) as Record<string, unknown>;
    await stSet(cle, { ...bc, metiersFait: { PEINTURE: true, SOL: true } });

    bc = (await stGet(cle)) as Record<string, unknown>;
    await stSet(cle, { ...bc, valideConducteur: true });

    const taches = await queries.listTachesBonCommande(bcId);
    expect(taches).toHaveLength(2);
    expect(taches.every((t) => t.statut === "validee")).toBe(true);
  });

  it("relit l'état depuis la base, et non depuis l'objet enregistré", async () => {
    const bc = (await relire()).find((b) => b.id === bcId)!;
    expect(bc.valideConducteur).toBe(true);
    expect(bc.dateValideConducteur).toBeTruthy();
    expect(bc.dateOrigineFait).toBe(true);
  });

  it("fait avancer le bon quand le directeur signe", async () => {
    const bc = (await stGet(cle)) as Record<string, unknown>;
    await stSet(cle, { ...bc, valideDirecteur: true });

    const enBase = await queries.getBonCommande(bcId);
    expect(enBase?.statut_workflow).toBe("chiffre");

    expect((await relire()).find((b) => b.id === bcId)!.valideDirecteur).toBe(true);
  });
});

suite("Commande de pièces", () => {
  /**
   * L'app signale la pièce sur le bon de commande (`pieceACommander`), la base
   * la porte sur la tâche (`planning_taches.piece_*`). Sans traduction, tout le
   * circuit pièces reste muet : rien n'arrive dans « Pièces en commande ».
   */
  const aujourdhui = new Date().toISOString().slice(0, 10);
  let bcId: Uuid;
  let cle: string;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    const bc = await queries.createBonCommande(societe!.id, {
      client_nom: "CLIENT DE TEST",
      date: aujourdhui,
      date_planifiee: aujourdhui,
      metiers: ["PLOMBERIE"],
    });
    bcId = bc.id;
    cle = `bonCommande:${bcId}`;
    await relire();
  });

  it("enregistre la pièce signalée par le technicien", async () => {
    const bc = (await stGet(cle)) as Record<string, unknown>;
    await stSet(cle, {
      ...bc,
      pieceACommander: true,
      pieceACommanderDetail: "Mitigeur thermostatique Grohe",
      technicienCommentaire: "Fuite au niveau du raccord",
    });

    const taches = await queries.listTachesBonCommande(bcId);
    expect(taches).toHaveLength(1);
    expect(taches[0].piece_a_commander).toBe(true);
    expect(taches[0].piece_description).toBe("Mitigeur thermostatique Grohe");
    expect(taches[0].commentaire).toBe("Fuite au niveau du raccord");
  });

  it("remonte la pièce au rechargement, pour l'onglet Pièces en commande", async () => {
    const bc = (await relire()).find((b) => b.id === bcId)!;
    expect(bc.pieceACommander).toBe(true);
    expect(bc.pieceACommanderDetail).toBe("Mitigeur thermostatique Grohe");
    expect(bc.technicienCommentaire).toBe("Fuite au niveau du raccord");
  });

  it("enregistre le fournisseur et la date de commande", async () => {
    const bc = (await stGet(cle)) as Record<string, unknown>;
    await stSet(cle, {
      ...bc,
      pieceACommanderFournisseur: "Cedeo",
      pieceACommanderDateCommande: aujourdhui,
    });

    const relu = (await relire()).find((b) => b.id === bcId)!;
    expect(relu.pieceACommanderFournisseur).toBe("Cedeo");
    expect(relu.pieceACommanderDateCommande).toBe(aujourdhui);
  });

  it("lève le signalement quand la pièce est arrivée", async () => {
    const bc = (await stGet(cle)) as Record<string, unknown>;
    await stSet(cle, { ...bc, pieceACommander: false });

    const relu = (await relire()).find((b) => b.id === bcId)!;
    expect(relu.pieceACommander).toBe(false);
  });
});
