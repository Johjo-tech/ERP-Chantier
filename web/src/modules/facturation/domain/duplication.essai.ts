import { describe, expect, it } from "vitest";
import { copieDeFacture, refusDuplication } from "./duplication";
import type { Facture } from "./facture";
import { renderPrintDoc } from "@/modules/documents/impression/gabarit";
import { contexteFacture } from "./impression";
import { verrouFacture } from "./verrou";

const f = {
  id: "f1", societe_id: "s", numero: "FAC-2026-000010", type_document: "facture", statut: "impayée", verrouillee: false, legacy_id: null,
  client_id: "c1", client_nom: "OPAC", interlocuteur: "M. Chargé", chantier_id: "ch1", devis_id: "d1", bon_commande_id: "b1", facture_rectifiee_id: null,
  motif_rectification: null, adresse: "12 rue R", adresse_locataire: "14 rue G", code_postal: "69003", ville: "Lyon", logement_statut: "vacant",
  occupant: "M. Fantôme", etage: "2", numero_logement: "12", precision_commune: "hall", ancien_locataire: "Mme Petit", date: "2026-01-15", echeance: "2026-02-14",
  date_fin_execution: "2026-01-10", remise_pourcentage: 5, acomptes_deduits: 100, retenue_garantie_pourcentage: 5, delai_paiement_jours: 30, delai_paiement_mode: "net",
  conditions_reglement: "30 jours net", mode_paiement: "cheque", ref_marche: "M-1", ref_bon_commande_client: "CMD-1", cadre_facturation: "B2B_national",
  conducteur_id: "k1", conducteur: "Christophe", emetteur_nom: "ALPHA", emetteur_adresse: "1 rue A", emetteur_code_postal: "69001", emetteur_ville: "Lyon",
  emetteur_siret: "123", emetteur_tva_intracom: "FR1", emetteur_iban: "FR76", emetteur_siren: "123", emetteur_pays_code: "FR", tva_categorie: null,
  tva_motif_exoneration: null, ref_contrat: null, devise: "EUR", intervention_id: "i1", client_siret: "999", client_siren: null, client_tva_intracom: "FR9",
  client_pays_code: "FR", client_code_routage: null, client_code_service: null, statut_cycle: "deposee", pdp_identifiant: "P1", pdp_transmission_id: "T1",
  lignes: [{ id: "l1", position: 0, type: "ligne", designation: "Pose", quantite: 1, prix_unitaire: 100, unite: "u", tva: 20, article_reference: null, commentaire: null, metier: null }],
} satisfies Facture;

describe("dupliquer une facture (FAC-07)", () => {
  it("un nouveau brouillon daté du jour, liens d'origine coupés, échéance recalculée", () => {
    const c = copieDeFacture(f, "2026-09-25");
    expect(c).toMatchObject({ type_document: "facture", date: "2026-09-25", echeance: "2026-10-25", devis_id: null, bon_commande_id: null, intervention_id: null, facture_rectifiee_id: null, date_fin_execution: null, conducteur_id: "k1", remise_pourcentage: 5 });
    // Nettoyé selon le logement : pas d'occupant sur un logement vacant.
    expect(c.occupant).toBeNull();
    expect(c.ancien_locataire).toBe("Mme Petit");
    // Rien de ce qui naît avec la pièce : ni numéro, ni cadenas, ni identité figée, ni cycle de plateforme.
    for (const cle of ["numero", "verrouillee", "emetteur_nom", "pdp_identifiant", "statut_cycle"]) expect(c).not.toHaveProperty(cle);
  });

  it("un avoir ne se duplique pas", () => {
    expect(refusDuplication({ type_document: "avoir" })).toMatch(/ne se duplique pas/);
    expect(refusDuplication(f)).toBeNull();
  });
});

describe("une seule définition de l'avoir (FAC-94)", () => {
  it("le verrou d'un avoir émis se lit comme tel", () => {
    expect(verrouFacture({ ...f, type_document: "avoir", numero: "AV-2026-000001" })?.libelle).toMatch(/^L'avoir AV-2026-000001 est émis :/);
  });
});

describe("la facture imprimée (FAC-10)", () => {
  const emetteur = { s: { raisonSocialeLegale: "ALPHA SAS", iban: "FR00-DU-JOUR", reglages: { documents: {} } }, nomSociete: "ALPHA", variables: {} };
  const meta = (html: string) => [...html.matchAll(/<dt>(.*?)<\/dt><dd>(.*?)<\/dd>/g)].map((m) => [m[1], m[2]]);

  it("échéance, devis d'origine, marché ; l'identité figée l'emporte", () => {
    const c = contexteFacture(f, { devisNumero: "DEV-2026-000003", rectifiee: null }, emetteur, []);
    const html = renderPrintDoc(c);
    expect(meta(html)).toContainEqual(["Date d'échéance", "14/02/2026"]);
    expect(meta(html)).toContainEqual(["Devis", "DEV-2026-000003"]);
    expect(meta(html)).toContainEqual(["Marché", "M-1"]);
    expect(html).toContain("IBAN : <span>FR76</span>");
    expect(html).toContain("SIRET 999");
    expect(html).toContain("TVA FR9");
  });

  it("un avoir cite la facture qu'il rectifie et son motif, sous le titre AVOIR, montants positifs comme l'ancien (D-PDF-03)", () => {
    const c = contexteFacture({ ...f, type_document: "avoir", motif_rectification: "Double facturation" }, { devisNumero: null, rectifiee: { numero: "FAC-2026-000009", date: "2026-01-02" } }, emetteur, []);
    const html = renderPrintDoc(c);
    expect(c.titre).toBe("AVOIR");
    expect(meta(html)).toContainEqual(["Rectifie la facture", "FAC-2026-000009 du 02/01/2026"]);
    expect(meta(html)).toContainEqual(["Motif", "Double facturation"]);
    // Aucun montant négatif : ni dans les lignes, ni dans les totaux (seules les déductions portent un « - »).
    expect(html).toContain('<div class="p-kv p-ttc"><span>Total TTC</span><em>114,00\u00a0€</em></div>');
  });
});
