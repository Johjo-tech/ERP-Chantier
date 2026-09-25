import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendreAvecSession } from "@/test/session-factice";
import { PageConnexion } from "./PageConnexion";
import { PageMonCompte } from "./PageMonCompte";
import { FormulaireMotDePasse } from "./PageNouveauMotDePasse";

const compte = vi.hoisted(() => ({ demanderReinitialisation: vi.fn(), definirMotDePasse: vi.fn(), renommerMonCompte: vi.fn() }));
vi.mock("../api/compte", () => compte);

beforeEach(() => {
  vi.clearAllMocks();
  compte.demanderReinitialisation.mockResolvedValue(undefined);
  compte.definirMotDePasse.mockResolvedValue(undefined);
  compte.renommerMonCompte.mockResolvedValue(undefined);
});

/** La page de connexion ne s'affiche qu'à un visiteur : on la rend hors session. */
async function connexionAnonyme() {
  const { SessionContexte } = await import("../hooks/SessionContexte");
  const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
  const { MemoryRouter } = await import("react-router");
  const { render } = await import("@testing-library/react");
  const valeur = { etat: { statut: "anonyme" as const }, societeActive: null, choisirSociete: () => undefined, roleReel: null, roleSimule: null, simulerRole: () => undefined, roleEffectif: null, deconnecter: async () => undefined };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SessionContexte.Provider value={valeur}>
        <MemoryRouter>
          <PageConnexion />
        </MemoryRouter>
      </SessionContexte.Provider>
    </QueryClientProvider>
  );
}

describe("mot de passe oublié (AUTH-03)", () => {
  it("demande l'adresse d'abord", async () => {
    await connexionAnonyme();
    await userEvent.click(screen.getByRole("button", { name: "Mot de passe oublié ?" }));
    expect(screen.getByText("Saisissez votre email, puis cliquez à nouveau.")).toBeInTheDocument();
    expect(compte.demanderReinitialisation).not.toHaveBeenCalled();
  });

  it("envoie le lien et répond de façon neutre", async () => {
    await connexionAnonyme();
    await userEvent.type(screen.getByLabelText("Identifiant"), "inconnu@erp.local");
    await userEvent.click(screen.getByRole("button", { name: "Mot de passe oublié ?" }));
    expect(await screen.findByText("Si un compte existe pour inconnu@erp.local, un lien de réinitialisation vient d'être envoyé.")).toBeInTheDocument();
    expect(compte.demanderReinitialisation).toHaveBeenCalledWith("inconnu@erp.local");
  });

  it("affiche la date du jour et aucune société (AUTH-05)", async () => {
    await connexionAnonyme();
    // Le cartouche de l'ancienne page : « 25.09.26 ».
    expect(screen.getByText(/^\d{2}\.\d{2}\.\d{2}$/)).toBeInTheDocument();
    expect(screen.queryByText(/ALPHA/)).not.toBeInTheDocument();
  });
});

describe("nouveau mot de passe (AUTH-04)", () => {
  it("refuse deux saisies différentes, puis enregistre", async () => {
    rendreAvecSession(<FormulaireMotDePasse apres={null} />, { role: "technicien" });
    await userEvent.type(screen.getByLabelText("Nouveau mot de passe"), "motdepasse-1");
    await userEvent.type(screen.getByLabelText("Confirmation"), "motdepasse-2");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le mot de passe" }));
    expect(screen.getByText("Les deux saisies diffèrent.")).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Confirmation"));
    await userEvent.type(screen.getByLabelText("Confirmation"), "motdepasse-1");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer le mot de passe" }));
    await waitFor(() => expect(compte.definirMotDePasse).toHaveBeenCalledWith("motdepasse-1"));
    expect(await screen.findByText("Mot de passe enregistré.")).toBeInTheDocument();
  });
});

describe("mon compte (AUTH-17)", () => {
  it("ouvert au technicien : il renomme son compte", async () => {
    rendreAvecSession(<PageMonCompte />, { role: "technicien" });
    expect(screen.getByLabelText("Nom affiché")).toHaveValue("Compte de test");
    await userEvent.clear(screen.getByLabelText("Nom affiché"));
    await userEvent.type(screen.getByLabelText("Nom affiché"), "Thomas T.");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(compte.renommerMonCompte).toHaveBeenCalledWith("u1", "Thomas T."));
    expect(screen.getByLabelText("Adresse de connexion")).toBeDisabled();
  });
});
