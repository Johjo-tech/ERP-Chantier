/**
 * Les fonctions `api/` de la fiche chantier, telles quelles, contre la base
 * LOCALE : chaque requête passe-t-elle, et sa réponse respecte-t-elle le schéma
 * Zod attendu ? Un nom de colonne faux ou une vue refaite échoueraient ici, pas
 * devant l'utilisateur. Le client de l'application est remplacé par un client
 * connecté au compte voulu.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ALPHA, COMPTES, connecte, type Client } from "./cible";

const courant = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase", () => ({ supabase: () => courant.client, supabasePropositions: () => courant.client }));

const { compteursChantiers, lireChantier, listerChantiers } = await import("../../src/modules/chantiers/api/chantiers");
const { listerDpgf } = await import("../../src/modules/chantiers/api/dpgf");
const docs = await import("../../src/modules/chantiers/api/documents");
const { listerAchats, listerCategoriesAchat, listerSalaries } = await import("../../src/modules/chantiers/api/achats");
const { listerTodos } = await import("../../src/modules/chantiers/api/todos");
const { listerAffectations, listerMembres } = await import("../../src/modules/chantiers/api/affectations");
const liens = await import("../../src/modules/chantiers/api/liens");
const { listerTachesPlanifiees } = await import("../../src/modules/chantiers/api/planification");

const CH1 = "a3000000-0000-0000-0000-000000000001";
let conducteur: Client;
let technicien: Client;

beforeAll(async () => {
  conducteur = await connecte(COMPTES.conducteurAlpha);
  technicien = await connecte(COMPTES.technicienAlpha);
});

describe("lectures de la fiche chantier (conducteur)", () => {
  it("chantier, DPGF, tâches, documents, achats, to-do, intervenants, factures, devis, métiers, PPSPS", async () => {
    courant.client = conducteur;
    const [liste, c] = await Promise.all([listerChantiers(ALPHA), lireChantier(CH1)]);
    expect(liste.some((x) => x.id === CH1)).toBe(true);
    expect(c.statut).toMatch(/en préparation|en cours|terminé/);
    await expect(compteursChantiers(ALPHA, { devis: true, factures: true })).resolves.toBeInstanceOf(Map);
    for (const lecture of [
      listerDpgf(CH1), listerTachesPlanifiees(CH1), docs.listerDocuments(CH1), docs.listerComptesRendus(CH1), docs.listerInspections(CH1),
      docs.listerDevisComplementaires(CH1), listerAchats(CH1), listerTodos(CH1), listerAffectations(CH1), liens.listerFacturesDuChantier(CH1),
      liens.listerDevisAvecLignes(CH1), listerCategoriesAchat(ALPHA), listerSalaries(ALPHA), listerMembres(ALPHA), liens.listerMetiers(ALPHA),
    ]) {
      await expect(lecture).resolves.toBeInstanceOf(Array);
    }
    const devis = await liens.listerDevisAvecLignes(CH1);
    expect(devis.length).toBeGreaterThan(0);
    const identite = await liens.identitePourPpsps(ALPHA);
    expect(identite.nom).toBeTruthy();
  });
});

describe("écritures de la fiche chantier (conducteur), retirées ensuite", () => {
  it("import de DPGF, planification d'une part, dépôt puis retrait d'un compte-rendu", async () => {
    courant.client = conducteur;
    const { importerDpgf } = await import("../../src/modules/chantiers/api/dpgf");
    const { planifierQuantite } = await import("../../src/modules/chantiers/api/planification");
    const { default: Big } = await import("big.js");
    await importerDpgf(CH1, [{ type: "ligne", designation: "Essai API CHA murs", quantite: 10, prix_unitaire: 45.5 }], [], 950);
    const ligne = (await listerDpgf(CH1)).find((l) => l.designation === "Essai API CHA murs");
    expect(ligne).toBeDefined();
    const c = await lireChantier(CH1);
    const bonId = await planifierQuantite({ societeId: ALPHA, chantier: c, ligne: { id: ligne?.id ?? "", metier: "Peinture" }, quantite: new Big(5), montant: new Big("227.5"), libelle: "Essai API CHA (5/10)" });
    const taches = await listerTachesPlanifiees(CH1);
    expect(taches.find((t) => t.bon_commande_id === bonId)).toMatchObject({ dpgf_ligne_id: ligne?.id, quantite_planifiee: 5, date_tache: null });
    const { data: bon } = await conducteur.from("bons_commande").select("montant, conducteur_id, numero_bc").eq("id", bonId).single();
    expect(bon).toEqual({ montant: 227.5, conducteur_id: c.conducteur_id, numero_bc: "Essai API CHA (5/10)" });

    await docs.deposerCompteRendu(ALPHA, CH1, new File(["%PDF-1.4"], "Essai API CHA.pdf", { type: "application/pdf" }));
    const cr = (await docs.listerComptesRendus(CH1)).find((x) => x.fichier_nom === "Essai API CHA.pdf");
    expect(cr).toMatchObject({ vu: false });
    expect(cr?.fichier_chemin).toMatch(new RegExp(`^${ALPHA}/chantiers/${CH1}/\\d+_Essai-API-CHA\\.pdf$`));
    await docs.retirer("chantier_comptes_rendus", cr?.id ?? "");
    const { data: restant } = await conducteur.storage.from("terrain").list(`${ALPHA}/chantiers/${CH1}`, { search: "Essai-API-CHA" });
    expect(restant).toEqual([]);

    await conducteur.from("bons_commande").delete().eq("id", bonId);
    await conducteur.from("chantier_dpgf_lignes").delete().eq("id", ligne?.id ?? "");
  });
});

describe("lectures de la fiche chantier (technicien affecté)", () => {
  it("lit la fiche, la to-do et les documents ; le DPGF et les achats lui arrivent vides", async () => {
    courant.client = technicien;
    await expect(lireChantier(CH1)).resolves.toMatchObject({ id: CH1 });
    await expect(listerTodos(CH1)).resolves.toBeInstanceOf(Array);
    await expect(docs.listerComptesRendus(CH1)).resolves.toBeInstanceOf(Array);
    expect(await listerDpgf(CH1)).toEqual([]);
    expect(await listerAchats(CH1)).toEqual([]);
  });
});
