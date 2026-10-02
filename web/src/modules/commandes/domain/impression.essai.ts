import { describe, expect, it } from "vitest";
import { renderPrintDoc } from "@/modules/documents/impression/gabarit";
import { contexteBon, type BonImprimable } from "./impression";

const BON: BonImprimable = {
  numero_interne: "BC-2026-000012",
  numero_bc: "CMD-7781",
  date: "2026-09-15",
  date_reception: null,
  client_nom: "OPAC du Rhône",
  adresse: null,
  interlocuteur: null,
  conducteur: null,
  metiers: ["Peinture"],
  metier: null,
  bon_commande_parent_id: null,
  facturation_adresse: null,
  facturation_code_postal: null,
  facturation_ville: null,
};
const EMETTEUR = { s: {}, nomSociete: "ALPHA", variables: {} };
const LIGNES = [{ type: "ligne", designation: "Reprise joint", quantite: 2.5, prix_unitaire: 40, unite: "ml", tva: 5.5 }];

// DEF-REP-04, D-REP-04 : l'ancien intitulait un SAV « BON DE COMMANDE » et imprimait « 2.5 » et « 5.5% ».
describe("la pièce d'un bon", () => {
  it("un SAV s'intitule « SAV », un bon ordinaire « BON DE COMMANDE »", () => {
    expect(contexteBon({ ...BON, bon_commande_parent_id: "bc-origine" }, LIGNES, EMETTEUR).titre).toBe("SAV");
    expect(contexteBon(BON, LIGNES, EMETTEUR).titre).toBe("BON DE COMMANDE");
  });

  it("quantité et TVA de la ligne à la française", () => {
    const html = renderPrintDoc(contexteBon(BON, LIGNES, EMETTEUR));
    expect(html).toContain('<td class="num">2,5</td><td class="unite">ml</td>');
    // Insécable : « % » ne part pas seul à la ligne dans la colonne étroite (D-VIS3-01).
    expect(html).toContain('<td class="num">5,5\u00A0%</td></tr>');
    expect(html).not.toContain("5.5%");
  });
});
