/**
 * Les fonctions `api/` du parc, telles quelles, contre la base LOCALE : chaque
 * requête passe-t-elle, sa réponse respecte-t-elle le schéma Zod, et les
 * enchaînements (compteur qui monte, vente → facture émise) tiennent-ils ?
 * Dépend de la proposition 20260926070000 (durée des prêts, droits de la
 * secrétaire sur les filles du véhicule et le seau `terrain`).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ALPHA, COMPTES, connecte, type Client } from "./cible";

const courant = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase", () => ({
  supabase: () => courant.client,
  supabasePropositions: () => courant.client,
  clientParc: () => courant.client,
  clientPlanning: () => courant.client,
}));

const veh = await import("../../src/modules/vehicules/api/vehicules");
const ent = await import("../../src/modules/vehicules/api/entretiens");
const prets = await import("../../src/modules/vehicules/api/prets");
const docs = await import("../../src/modules/vehicules/api/documents");
const { vendreVehicule } = await import("../../src/modules/vehicules/api/vente");
const mat = await import("../../src/modules/materiel/api/materiels");
const { listerPersonnes, libellesDuReferentiel } = await import("../../src/modules/materiel/api/annuaires");
const { lireEtatDepart, lireMarquesRetour } = await import("../../src/modules/vehicules/domain/schema-vehicule");
const { schemaSaisieVehicule, saisieDepuis } = await import("../../src/modules/vehicules/domain/vehicule");

const CLIENT_ALPHA = "a2000000-0000-0000-0000-000000000003";
const plaque = `API-${Date.now().toString(36).toUpperCase()}`;
let secretaire: Client;
let admin: Client;
let vehiculeId = "";
let materielId = "";
let salarieId = "";

beforeAll(async () => {
  secretaire = await connecte(COMPTES.secretaireAlpha);
  admin = await connecte(COMPTES.adminAlpha);
  // Un salarié à soi : la base locale est partagée, on ne compte pas sur ceux des autres.
  const s = await admin.from("salaries").insert({ societe_id: ALPHA, nom: `Parc ${plaque}`, prenom: "Essai", actif: true }).select("id").single();
  if (s.error) throw s.error;
  salarieId = s.data.id;
});

afterAll(async () => {
  if (vehiculeId) await admin.from("vehicules").delete().eq("id", vehiculeId);
  if (materielId) await admin.from("materiels").delete().eq("id", materielId);
  if (salarieId) await admin.from("salaries").delete().eq("id", salarieId);
});

describe("fiche véhicule (secrétaire : véhicules / tout)", () => {
  it("crée, relit, liste ; la plaque en double se dit en clair", async () => {
    courant.client = secretaire;
    const saisie = schemaSaisieVehicule.parse({ ...saisieDepuis(null), immatriculation: plaque.toLowerCase(), kilometrage: "1000", date_controle_technique: "2026-10-01" });
    const v = await veh.creerVehicule(ALPHA, saisie);
    vehiculeId = v.id;
    expect(v).toMatchObject({ immatriculation: plaque, kilometrage: 1000, date_controle_technique: "2026-10-01", vendu: false });
    expect((await veh.listerVehicules(ALPHA)).some((x) => x.id === v.id)).toBe(true);
    await expect(veh.creerVehicule(ALPHA, saisie)).rejects.toMatchObject({ code: "P0001", message: expect.stringMatching(/immatriculation/) });
    expect((await listerPersonnes(ALPHA)).some((p) => p.id === salarieId)).toBe(true);
    await expect(libellesDuReferentiel(ALPHA, "etat_materiel")).resolves.toBeInstanceOf(Array);
  });

  it("[proposition] entretien avec facture jointe : le compteur monte, jamais ne descend", async () => {
    courant.client = secretaire;
    const fichier = new File(["facture"], "facture garage.pdf", { type: "application/pdf" });
    await ent.ajouterEntretien(ALPHA, { id: vehiculeId, kilometrage: 1000 }, { designation: "Vidange", kilometrage: 1500, montant: 120.5, date_entretien: "2026-09-20" }, fichier);
    expect((await veh.lireVehicule(vehiculeId)).kilometrage).toBe(1500);
    await ent.ajouterEntretien(ALPHA, { id: vehiculeId, kilometrage: 1500 }, { designation: "Pneus", kilometrage: 900, montant: 0, date_entretien: "2026-09-21" }, null);
    expect((await veh.lireVehicule(vehiculeId)).kilometrage).toBe(1500);
    const liste = await ent.listerEntretiens(vehiculeId);
    const vidange = liste.find((e) => e.designation === "Vidange");
    expect(vidange?.fichier_chemin).toMatch(new RegExp(`^${ALPHA}/vehicules/${vehiculeId}/\\d+_facture-garage\\.pdf$`));
    if (vidange) await ent.supprimerEntretien(vidange);
    expect((await ent.listerEntretiens(vehiculeId)).map((e) => e.designation)).toEqual(["Pneus"]);
  });

  it("[proposition] prêt avec schéma, second prêt refusé en clair, retour avec nouvelles marques", async () => {
    courant.client = secretaire;
    await prets.preterVehicule(vehiculeId, { salarie_id: salarieId, etat: "Bon état", date_debut: "2026-09-25", duree_jours: 2 }, [{ x: 110, y: 35 }]);
    await expect(prets.preterVehicule(vehiculeId, { salarie_id: salarieId, etat: null, date_debut: "2026-09-25", duree_jours: null }, [])).rejects.toMatchObject({ code: "P0001" });
    const [p] = await prets.listerPretsVehicule(vehiculeId);
    expect(p).toMatchObject({ duree_jours: 2, date_fin: null });
    expect(lireEtatDepart(p?.etat_depart)).toEqual({ etat: "Bon état", marques: [{ x: 110, y: 35 }] });
    await prets.rendreVehicule(p?.id ?? "", [{ x: 45, y: 210 }]);
    const [rendu] = await prets.listerPretsVehicule(vehiculeId);
    expect(rendu?.date_fin).not.toBeNull();
    expect(lireMarquesRetour(rendu?.etat_retour)).toEqual([{ x: 45, y: 210 }]);
  });

  it("[proposition] document à échéance : déposé, puis vu par les alertes de la société", async () => {
    courant.client = secretaire;
    const fichier = new File(["assurance"], "attestation.pdf", { type: "application/pdf" });
    await docs.ajouterDocument(ALPHA, vehiculeId, { type: "Assurance", nom: null, numero_document: "P-1", organisme: "Assureur", date_expiration: "2026-10-01" }, fichier);
    const [d] = await docs.listerDocuments(vehiculeId);
    expect(d).toMatchObject({ type: "Assurance", nom: "attestation.pdf", date_expiration: "2026-10-01" });
    expect((await docs.documentsAEcheance(ALPHA)).some((x) => x.id === d?.id)).toBe(true);
    if (d) await docs.supprimerDocument(d);
  });

  it("[proposition] la vente émet une facture numérotée par la base, et ne se fait qu'une fois", async () => {
    courant.client = secretaire;
    const r = await vendreVehicule(ALPHA, vehiculeId, { client_id: CLIENT_ALPHA, date: "2026-09-25", prix: 5000, tva: 20 });
    expect(r.numero).toMatch(/^FAC-\d{4}-\d{6}$/);
    const v = await veh.lireVehicule(vehiculeId);
    expect(v).toMatchObject({ vendu: true, date_vente: "2026-09-25", prix_vente: 5000, facture_vente_id: r.factureId });
    const { data: lignes } = await secretaire.from("facture_lignes").select("designation, quantite, prix_unitaire, tva").eq("facture_id", r.factureId);
    expect(lignes).toEqual([{ designation: expect.stringMatching(new RegExp(`^Vente du véhicule ${plaque}`)), quantite: 1, prix_unitaire: 5000, tva: 20 }]);
    await expect(vendreVehicule(ALPHA, vehiculeId, { client_id: CLIENT_ALPHA, date: "2026-09-25", prix: 5000, tva: 20 })).rejects.toMatchObject({ message: "Ce véhicule est déjà vendu." });
  });
});

describe("matériel (technicien : matériel / modifier)", () => {
  it("[proposition] crée (admin), prête et rend (technicien) ; les prêts reviennent avec la fiche", async () => {
    courant.client = admin;
    const m = await mat.creerMateriel(ALPHA, { nom: `Essai API ${plaque}`, categorie: "Outillage", etat_general: "Neuf", numero_serie: null, date_achat: null });
    materielId = m.id;
    courant.client = await connecte(COMPTES.technicienAlpha);
    await mat.preterMateriel(m.id, { salarie_id: salarieId, etat: "Neuf", date_debut: "2026-09-25", duree_jours: 3 });
    await expect(mat.preterMateriel(m.id, { salarie_id: salarieId, etat: "Neuf", date_debut: "2026-09-25", duree_jours: null })).rejects.toMatchObject({ code: "P0001" });
    const fiche = await mat.lireMateriel(m.id);
    expect(fiche.prets).toEqual([expect.objectContaining({ duree_jours: 3, date_fin: null, etat_depart: "Neuf" })]);
    await mat.rendreMateriel(fiche.prets[0]?.id ?? "");
    expect((await mat.listerMateriels(ALPHA)).find((x) => x.id === m.id)?.prets[0]?.date_fin).not.toBeNull();
  });
});
