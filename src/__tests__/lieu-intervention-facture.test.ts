/**
 * Le lieu d'intervention survit à la transformation en facture.
 *
 * Les deux tables ne donnent pas le même sens au mot « adresse » :
 *
 *   bons_commande.adresse       le CHANTIER — le formulaire l'annonce ainsi,
 *                               « Adresse d'intervention »
 *   factures.adresse            le CLIENT — le formulaire l'écrase toujours
 *                               avec celle de sa fiche
 *   factures.adresse_locataire  le CHANTIER
 *
 * `bc_generer_facture` recopiait la première dans la deuxième. Le lieu des
 * travaux atterrissait donc dans la case du siège du client, et le document
 * imprimé n'avait plus rien à mettre sous « Lieu d'intervention » : sur 394
 * factures de production, 4 en portaient un.
 *
 * Ce cas tient les deux adresses distinctes de bout en bout. Il ne vérifie pas
 * une colonne mais une **confusion** : il faut donc que les deux valeurs
 * diffèrent, sinon il passerait quoi qu'on écrive.
 */

import { describe, it, expect, beforeAll } from "vitest";
import * as queries from "@/api/queries";
import { supabase } from "@/api/client";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";
import type { Uuid } from "@/api/types";

const suite = AUTH_DISPONIBLE ? describe : describe.skip;

const SIEGE_DU_CLIENT = "11 boulevard Jean Pain";
const LIEU_DES_TRAVAUX = "LAEP Salle Mistral";

suite("Lieu d'intervention porté jusqu'à la facture", () => {
  let societeId: Uuid;
  let factureId: Uuid;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error("Société de test introuvable");
    societeId = societe.id;

    /* Le client porte le siège. Une fiche sans adresse ne prouverait rien :
       on ne saurait pas si la facture l'a reprise ou laissée vide. */
    const client = await queries.resolveClientByNom(societeId, "CLIENT DE TEST");
    await supabase
      .from("clients")
      .update({ adresse: SIEGE_DU_CLIENT, code_postal: "38000", ville: "Grenoble" })
      .eq("id", client.id);

    // Le bon porte le chantier, ailleurs.
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const bc = await queries.createBonCommande(societeId, {
      client_id: client.id,
      client_nom: "CLIENT DE TEST",
      date: aujourdhui,
      adresse: LIEU_DES_TRAVAUX,
      code_postal: "38000",
      ville: "Grenoble",
    });

    const tache = await queries.planifierTache(societeId, {
      bon_commande_id: bc.id,
      libelle: "Intervention",
      date_tache: aujourdhui,
    });

    await queries.marquerRealisee(tache.id);
    await queries.validerTache(tache.id, true);
    await queries.passerPretAChiffrer(bc.id);
    factureId = await queries.validerPrefacture(bc.id);
  });

  it("met le chantier dans le lieu d'intervention", async () => {
    const facture = await queries.getFacture(factureId);
    expect(facture?.adresse_locataire).toBe(LIEU_DES_TRAVAUX);
  });

  it("met le siège du client dans l'adresse du client", async () => {
    const facture = await queries.getFacture(factureId);
    expect(facture?.adresse).toBe(SIEGE_DU_CLIENT);
  });

  it("ne confond plus les deux", async () => {
    const facture = await queries.getFacture(factureId);
    expect(facture?.adresse).not.toBe(facture?.adresse_locataire);
  });
});
