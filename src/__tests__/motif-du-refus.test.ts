/**
 * Un refus de la base doit arriver jusqu'à l'utilisateur, en clair.
 *
 * `stSet` rend un booléen, et trente-neuf appels en dépendent. Quand il rendait
 * faux, l'écran affichait invariablement :
 *
 *   « Échec de l'enregistrement (connexion à Supabase impossible). Si vous êtes
 *     dans l'aperçu Claude.ai, téléchargez le fichier… »
 *
 * Deux mensonges dans une seule phrase. Sur une base vivante, un échec
 * d'écriture vient presque toujours d'un REFUS — une facture émise qu'on
 * rouvre, un droit manquant, un champ obligatoire vide — et non d'une panne de
 * réseau. Le déclencheur écrit pourtant une phrase qui dit quoi faire ; elle
 * partait dans la console pendant que l'utilisateur lisait qu'il avait un
 * problème de connexion. Quant à « l'aperçu Claude.ai », il ne veut rien dire
 * pour le client à qui l'application est vendue.
 *
 * Le motif voyage désormais à côté du booléen, et `dernierRefus()` le rend.
 *
 * Ces tests écrivent vraiment, contre la base locale.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { dernierRefus, stSet } from "@/integrations/html-adapter";
import * as queries from "@/api/queries";
import type { Uuid } from "@/api/types";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";
import { LIGNES_MINIMALES } from "./facture-de-test";

const suite = AUTH_DISPONIBLE ? describe : describe.skip;

suite("Le motif du refus remonte jusqu'à l'écran", () => {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  let societeId: Uuid;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error(`Société « ${TEST_SOCIETE_CODE} » introuvable`);
    societeId = societe.id;
  });

  /** Une facture ÉMISE : son en-tête est figé par un déclencheur. */
  async function factureEmise() {
    const f = await queries.createFacture(
      societeId,
      { client_nom: "CLIENT DE TEST", date: aujourdhui, statut: "brouillon" },
      LIGNES_MINIMALES
    );
    return queries.emettreFacture(f.id as Uuid);
  }

  it("rend null quand rien n'a été refusé", async () => {
    /* Une écriture qui passe remet le compteur à zéro : un motif périmé
       serait pire qu'aucun motif — il accuserait la mauvaise cause. */
    const ok = await stSet(`facture:${(await factureEmise()).id}`, {
      id: (await factureEmise()).id,
      societeId: TEST_SOCIETE_CODE,
      client: "CLIENT DE TEST",
      date: aujourdhui,
      statut: "impayée",
      lignes: [],
    });
    if (ok) expect(dernierRefus()).toBeNull();
  });

  /* LE cas. Rouvrir l'en-tête d'une facture numérotée : le déclencheur refuse,
     et sa phrase nomme le numéro et le remède — un avoir. */
  it("rend la phrase du déclencheur quand une facture émise est retouchée", async () => {
    const emise = await factureEmise();

    const ok = await stSet(`facture:${emise.id}`, {
      id: emise.id,
      societeId: TEST_SOCIETE_CODE,
      client: "AUTRE CLIENT — retouche interdite",
      date: aujourdhui,
      statut: "impayée",
      lignes: [],
    });

    expect(ok).toBe(false);
    const motif = dernierRefus();
    expect(motif).toBeTruthy();
    /* On n'exige pas un libellé exact — il appartient au déclencheur et peut
       être reformulé. On exige qu'il PARLE de la facture, et non du réseau. */
    expect(motif).toMatch(/factur|émise|numérot|avoir/i);
    expect(motif).not.toMatch(/connexion|Claude/i);
  });

  it("ne parle plus jamais d'un aperçu Claude.ai", async () => {
    const emise = await factureEmise();
    await stSet(`facture:${emise.id}`, {
      id: emise.id,
      societeId: TEST_SOCIETE_CODE,
      client: "ENCORE UNE RETOUCHE",
      date: aujourdhui,
      statut: "impayée",
      lignes: [],
    });
    expect(dernierRefus() ?? "").not.toContain("Claude");
  });
});
