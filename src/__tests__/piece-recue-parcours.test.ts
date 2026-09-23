/**
 * « Pièce arrivée » rend le bon au planning — parcours complet, sur la base.
 *
 * Le symptôme rapporté : la vignette ne revenait pas dans « Non planifiés ».
 * Vider `date_planifiee` sur le bon ne suffisait pas, parce que les tâches
 * gardaient leur date — et les journées du bon se DÉRIVENT des tâches. Plus
 * aucune n'égalant la date d'origine devenue vide, elles y passaient toutes, et
 * le planning reposait une vignette sur chacune : le bon était à la fois
 * « Non planifié » et encore accroché au calendrier.
 *
 * Ce parcours ne se reproduit pas hors base : la dé-datation est le fait de
 * `bc_piece_recue`, et c'est la relecture qui révèle l'écart.
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as queries from "@/api/queries";
import { stGet, stListKeys, stSet } from "@/integrations/html-adapter";
import type { Uuid } from "@/api/types";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";

const suite = AUTH_DISPONIBLE ? describe : describe.skip;

/** Force la relecture depuis la base, cache vidé, comme un rechargement. */
async function relire(): Promise<void> {
  const cles = await stListKeys("bonCommande:");
  for (const c of cles) await stGet(c);
}

function jour(decalage: number): string {
  const d = new Date();
  d.setDate(d.getDate() + decalage);
  return d.toISOString().slice(0, 10);
}

suite("La pièce reçue rend le bon au planning", () => {
  let societeId: Uuid;

  /** Un bon planifié, deux métiers, deux journées, la pièce sur la SECONDE. */
  async function bonAvecPieceSurLaSecondeTache() {
    const bc = await queries.createBonCommande(societeId, {
      client_nom: "CLIENT DE TEST",
      date: jour(0),
      date_planifiee: jour(0),
      metiers: ["PEINTURE", "SOL"],
    });

    const premiere = await queries.planifierTache(societeId, {
      bon_commande_id: bc.id,
      libelle: "Test — PEINTURE",
      date_tache: jour(0),
      metier: "PEINTURE",
    });
    const seconde = await queries.planifierTache(societeId, {
      bon_commande_id: bc.id,
      libelle: "Test — SOL",
      date_tache: jour(1),
      metier: "SOL",
    });

    await queries.updateTache(seconde.id, {
      piece_a_commander: true,
      piece_description: "Barre de seuil alu 90 cm",
      piece_fournisseur: "Point P",
      piece_date_commande: jour(0),
    });

    await relire();
    return { bc, premiere, seconde, cle: `bonCommande:${bc.id}` };
  }

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    societeId = societe!.id;
  });

  it("voit la pièce même signalée sur la seconde tâche", async () => {
    const { cle } = await bonAvecPieceSurLaSecondeTache();
    const bc = (await stGet(cle)) as Record<string, unknown>;

    expect(bc.pieceACommander).toBe(true);
    expect(bc.pieceACommanderDetail).toBe("Barre de seuil alu 90 cm");
    expect(bc.pieceACommanderFournisseur).toBe("Point P");
  });

  /* Le bug, de bout en bout. */
  it("détache le bon de toutes ses journées", async () => {
    const { bc: origine, cle } = await bonAvecPieceSurLaSecondeTache();

    const avant = (await stGet(cle)) as Record<string, unknown>;
    expect(avant.datePlanifiee).toBeTruthy();
    expect((avant.datesSupplementaires as unknown[]).length).toBe(1);

    await queries.pieceRecue(origine.id);
    await relire();

    const apres = (await stGet(cle)) as Record<string, unknown>;
    expect(apres.datePlanifiee).toBeFalsy();
    expect(apres.datesSupplementaires).toEqual([]);
    expect(apres.pieceACommander).toBe(false);
  });

  /* La trace survit : c'est elle qui explique le report à qui reprend
     l'affaire, et c'est pour elle qu'on dé-date au lieu de supprimer. */
  it("garde la description, le fournisseur et horodate la réception", async () => {
    const { bc, cle } = await bonAvecPieceSurLaSecondeTache();
    await queries.pieceRecue(bc.id);
    await relire();

    const apres = (await stGet(cle)) as Record<string, unknown>;
    expect(apres.pieceACommanderDetail).toBe("Barre de seuil alu 90 cm");
    expect(apres.pieceACommanderFournisseur).toBe("Point P");
    expect(apres.pieceRecueLe).toBeTruthy();

    const taches = await queries.listTachesBonCommande(bc.id);
    expect(taches.every((t) => !t.date_tache)).toBe(true);
    expect(taches.every((t) => !t.piece_a_commander)).toBe(true);
  });

  /* Le cas « ça dépend des techniciens » : la journée pointée ne doit ni
     bloquer le retour, ni perdre sa déclaration. */
  it("accepte un bon dont une journée est déjà pointée, sans l'effacer", async () => {
    const { bc, premiere } = await bonAvecPieceSurLaSecondeTache();
    await queries.marquerRealisee(premiere.id);

    await queries.pieceRecue(bc.id);

    const taches = await queries.listTachesBonCommande(bc.id);
    const pointee = taches.find((t) => t.id === premiere.id)!;
    expect(pointee.statut).toBe("realisee");
    expect(pointee.realisee_le).toBeTruthy();
    expect(pointee.date_tache).toBeNull();
  });

  /* Un arbitrage du conducteur ne se défait pas sans le dire. */
  it("refuse quand une tâche est validée, et ne touche à rien", async () => {
    const { bc, premiere } = await bonAvecPieceSurLaSecondeTache();
    await queries.marquerRealisee(premiere.id);
    await queries.validerTache(premiere.id, true);

    await expect(queries.pieceRecue(bc.id)).rejects.toThrow(/SAV/);

    const taches = await queries.listTachesBonCommande(bc.id);
    expect(taches.every((t) => !!t.date_tache)).toBe(true);
  });

  /* Replanifier ne doit pas laisser de jumelle : la tâche dé-datée reprend le
     rendez-vous au lieu qu'on lui en crée une autre à côté. */
  it("rend leur date aux tâches quand le bon est replanifié", async () => {
    const { bc, cle } = await bonAvecPieceSurLaSecondeTache();
    const avant = (await queries.listTachesBonCommande(bc.id)).length;

    await queries.pieceRecue(bc.id);
    await relire();

    const rendu = (await stGet(cle)) as Record<string, unknown>;
    await stSet(cle, { ...rendu, datePlanifiee: jour(7) });

    const apres = await queries.listTachesBonCommande(bc.id);
    expect(apres.length).toBe(avant);
    expect(apres.every((t) => t.date_tache === jour(7))).toBe(true);
  });
});
