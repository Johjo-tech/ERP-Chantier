import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendreAvecSession } from "@/test/session-factice";
import { PageDocumentClient } from "./PageDocumentClient";

/**
 * D-MAIN-02, D-COR2-05 : une pièce ouverte depuis l'espace client sortait SANS commune — le bloc « Client »
 * prend le code postal et la ville sur la fiche, que le client ne lit pas. La vue de ses accès les lui rend
 * (proposition 20260928213000), sans lui ouvrir la fiche.
 */
const suivi = vi.hoisted(() => ({
  emetteurPourClient: vi.fn(),
  communeDuClient: vi.fn(),
  bonsDuClient: vi.fn(),
  soldesDuClient: vi.fn(),
}));
const devis = vi.hoisted(() => ({ lireDevis: vi.fn() }));
vi.mock("../api/suivi", () => suivi);
vi.mock("@/modules/devis/api/devis", () => devis);
vi.mock("@/modules/facturation/api/factures", () => ({ lireFacture: vi.fn() }));

const identite = {
  nom: "ALPHA Rénovation", formeJuridique: null, adresse: "1 rue Émetteur", codePostal: "69001", ville: "Lyon", telephone: null, email: null,
  siret: null, siren: null, tvaIntracom: null, capitalSocial: null, rcsNumero: null, rcsVille: null, codeNaf: null, iban: null, bic: null, logo: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  suivi.emetteurPourClient.mockResolvedValue({ identite, mentions: {} });
  devis.lireDevis.mockResolvedValue({
    id: "d1", societe_id: "alpha", numero: "DEV-2026-900001", client_id: "c1", client_nom: "OPAC du Rhône", interlocuteur: null,
    chantier_id: null, adresse: "12 rue de la République", adresse_locataire: null, code_postal: null, ville: null, logement_statut: null, occupant: null,
    etage: null, numero_logement: null, precision_commune: null, ancien_locataire: null, telephone_locataire: null, date: "2026-09-24",
    remise_pourcentage: 0, statut: "envoyé", conducteur_id: null, conducteur: null,
    lignes: [{ id: "l1", position: 0, type: "ligne", designation: "Robinet", quantite: 1, prix_unitaire: 45, unite: "u", tva: 20, article_reference: null, commentaire: null, metier: null }],
  });
});

const ouvrir = () =>
  rendreAvecSession(
    <Routes>
      <Route path="/espace-client/devis/:id" element={<PageDocumentClient nature="devis" />} />
    </Routes>,
    { role: "lecture", chemin: "/espace-client/devis/d1" }
  );

describe("pièce ouverte depuis l'espace client : le bloc « Client » (D-MAIN-02)", () => {
  it("porte la rue ET la commune de sa fiche, lue par la vue de ses accès", async () => {
    suivi.communeDuClient.mockResolvedValue({ codePostal: "69002", ville: "Lyon" });
    ouvrir();
    await screen.findByText("DEVIS");
    const contenu = document.getElementById("viewInterventionContent")?.textContent ?? "";
    expect(contenu).toContain("12 rue de la République");
    expect(contenu).toContain("69002 Lyon");
    // Par le nom du document dans sa société, comme l'ancien retrouvait la fiche.
    expect(suivi.communeDuClient).toHaveBeenCalledWith("alpha", "OPAC du Rhône");
  });

  it("commune illisible : la pièce sort quand même, avec la rue seule", async () => {
    suivi.communeDuClient.mockResolvedValue(null);
    ouvrir();
    await screen.findByText("DEVIS");
    const contenu = document.getElementById("viewInterventionContent")?.textContent ?? "";
    expect(contenu).toContain("12 rue de la République");
    expect(contenu).not.toContain("69002");
  });
});
