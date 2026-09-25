import { describe, expect, it } from "vitest";
import { passeParUnePlateforme, refusTransmission } from "./cadre";
import { preparerDossier, type ClientSource, type FactureSource, type SourcesEmission } from "./dossier";

const facture: FactureSource = {
  numero: "FAC-2026-000007",
  date: "2026-09-15",
  echeance: "2026-10-15",
  date_livraison: null,
  date_fin_execution: "2026-09-12",
  devise: "EUR",
  type_document: "facture",
  cadre_facturation: "B2B_national",
  emetteur_nom: "ALPHA Rénovation",
  emetteur_siren: null,
  emetteur_siret: "73282932000074",
  emetteur_tva_intracom: null,
  emetteur_adresse: null,
  emetteur_code_postal: null,
  emetteur_ville: null,
  emetteur_pays_code: null,
  client_nom: "OPH Isère",
  client_siren: null,
  client_siret: null,
  client_tva_intracom: null,
  client_pays_code: null,
  client_code_service: "SERV-9",
  facturation_adresse: null,
  facturation_code_postal: null,
  facturation_ville: null,
  facturation_pays_code: null,
  adresse: "21 AVENUE DE CONSTANTINE 38100 GRENOBLE",
  code_postal: null,
  ville: null,
  ref_bon_commande_client: null,
  ref_contrat: null,
  conditions_reglement: null,
  penalites_retard: null,
  indemnite_recouvrement: null,
  escompte_pourcentage: null,
  remise_pourcentage: 0,
  acomptes_deduits: 100,
  tva_motif_exoneration: null,
  motif_rectification: null,
  total_ht: 0,
  total_tva: 0,
  total_ttc: 0,
};

const sources = (o: Partial<SourcesEmission> = {}): SourcesEmission => ({
  facture,
  lignes: [
    { type: "chapitre", designation: "Salle de bain", quantite: null, prix_unitaire: null, montant_ht: null, tva: null, unite: null, unite_code: null, tva_categorie: null, tva_motif_exoneration: null, article_reference: null },
    { type: "ligne", designation: "Faïence", quantite: 10, prix_unitaire: 50, montant_ht: null, tva: 10, unite: "m²", unite_code: null, tva_categorie: null, tva_motif_exoneration: null, article_reference: null },
  ],
  societe: null,
  client: { nom: "OPH Isère", siren: null, siret: "27380003700015", tva_intracom: null, adresse: null, code_postal: null, ville: null, pays_code: null, adresse_electronique_schema: null, adresse_electronique_valeur: null, reference_acheteur: null, cadre_facturation: "B2G" },
  totaux: { ht: 500, tva: 50, ttc: 550 },
  paye: 200,
  rectifiee: null,
  ...o,
});

describe("dossier d'émission", () => {
  it("les totaux viennent de la vue, les chapitres ne sont pas facturés, l'adresse d'un seul tenant est découpée", () => {
    const { charge, manques } = preparerDossier(sources());
    expect(manques).toEqual([]);
    const f = charge.en_invoice;
    expect(f.lines).toHaveLength(1);
    expect(f.lines[0]?.net_amount).toBe("500.00");
    expect(f.totals.total_with_vat).toBe("550.00");
    expect(f.buyer.postal_address).toEqual({ address_line1: "21 AVENUE DE CONSTANTINE", post_code: "38100", city: "GRENOBLE", country_code: "FR" });
    expect(f.buyer_reference).toBe("SERV-9");
    expect(f.delivery_date).toBe("2026-09-12");
  });

  it("BT-113 : le déjà-réglé est celui de la BASE (v_facture_solde.paye) plus les acomptes, jamais un solde recalculé (EFA-22)", () => {
    const f = preparerDossier(sources()).charge.en_invoice;
    expect(f.totals.paid_amount).toBe("300.00");
    expect(f.totals.amount_due_for_payment).toBe("250.00");
    // Sans ligne de solde (vue absente), rien n'est réputé réglé — pas de reconstitution côté écran.
    expect(preparerDossier(sources({ paye: null })).charge.en_invoice.totals.paid_amount).toBe("100.00");
  });

  it("le cadre de la FICHE l'emporte : un particulier n'est pas sommé d'avoir un SIRET", () => {
    const b2c = sources({ client: { ...(sources().client as ClientSource), siret: null, cadre_facturation: "B2C" } });
    expect(preparerDossier(b2c).manques.map((m) => m.code)).toEqual([]);
    const b2b = sources({ client: { ...(sources().client as ClientSource), siret: null, cadre_facturation: "B2B_national" } });
    expect(preparerDossier(b2b).manques.map((m) => m.code)).toEqual(["BT-49"]);
  });

  it("totaux de la vue faux par rapport aux lignes : BR-CO-10 le dit", () => {
    const manques = preparerDossier(sources({ totaux: { ht: 0, tva: 0, ttc: 0 } })).manques;
    expect(manques.map((m) => m.libelle)).toEqual(["Les lignes totalisent 500.00 € HT, la facture en déclare 0.00 €. La facture serait rejetée."]);
  });
});

describe("qui passe par la plateforme (EFA-01)", () => {
  const piece = { numero: "FAC-1", legacy_id: null, cadre_facturation: "B2G" as const, pdp_identifiant: null };
  it("une facture émise B2B/B2G se transmet ; ni brouillon, ni déposée, ni historique, ni B2C, ni étranger", () => {
    expect(refusTransmission(piece)).toBeNull();
    expect(refusTransmission({ ...piece, numero: null })).toMatch(/pas émise/);
    expect(refusTransmission({ ...piece, pdp_identifiant: "PDP-9" })).toMatch(/Déjà déposée/);
    expect(refusTransmission({ ...piece, legacy_id: "compta:F12" })).toMatch(/ancien logiciel/);
    expect(refusTransmission({ ...piece, cadre_facturation: "B2C" })).toMatch(/e-reporting/);
    expect(refusTransmission({ ...piece, cadre_facturation: "B2B_international" })).toMatch(/e-reporting/);
  });
  it("une pièce kv_store (legacy sans préfixe) reste transmissible, seule la reprise comptable ne l'est pas", () => {
    expect(passeParUnePlateforme({ legacy_id: "facture:abc", cadre_facturation: null })).toBe(true);
    expect(passeParUnePlateforme({ legacy_id: "compta:abc", cadre_facturation: "B2G" })).toBe(false);
  });
});
