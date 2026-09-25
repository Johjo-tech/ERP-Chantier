import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { Layout } from "@/app/Layout";
import { rendreAvecSession, sessionFactice } from "@/test/session-factice";
import type { RoleMembre } from "../domain/permissions";
import { SessionContexte } from "../hooks/SessionContexte";
import { RouteModule } from "./RouteProtegee";
import { ToastBox } from "@/components/ui/toast";
import { VersionConstruite } from "./VersionConstruite";

function OuSuisJe() {
  return <p data-testid="lieu">{useLocation().pathname}</p>;
}

/** Une session dont on change le rôle simulé comme le ferait « Voir en tant que ». */
function Application({ chemin }: { chemin: string }) {
  const [simule, setSimule] = useState<RoleMembre | null>(null);
  const valeur = { ...sessionFactice({ role: "admin", simule }), simulerRole: setSimule };
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SessionContexte.Provider value={valeur}>
        <MemoryRouter initialEntries={[chemin]}>
          <OuSuisJe />
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<p>Accueil</p>} />
              <Route path="factures" element={<RouteModule module="factures"><p>Liste des factures</p></RouteModule>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </SessionContexte.Provider>
    </QueryClientProvider>
  );
}

describe("onglet devenu interdit (AUTH-16)", () => {
  it("après un changement de rôle, bascule sur le premier onglet autorisé", async () => {
    render(<Application chemin="/factures" />);
    expect(screen.getByText("Liste des factures")).toBeInTheDocument();
    // « Voir en tant que » est dans le menu du nom (deux exemplaires : barre latérale et téléphone).
    await userEvent.click(screen.getAllByRole("button", { name: "🔧 Technicien" })[0] as HTMLElement);
    await waitFor(() => expect(screen.getByTestId("lieu")).toHaveTextContent(/^\/$/));
    expect(screen.getByText("Accueil")).toBeInTheDocument();
    expect(screen.queryByText("Accès refusé")).not.toBeInTheDocument();
  });

  it("un accès direct par l'URL garde son « Accès refusé » : le lien ne s'ouvre pas sans dire pourquoi", () => {
    function Direct() {
      const valeur = sessionFactice({ role: "technicien" });
      return (
        <QueryClientProvider client={new QueryClient()}>
          <SessionContexte.Provider value={valeur}>
            <MemoryRouter initialEntries={["/factures"]}>
              <OuSuisJe />
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route path="factures" element={<RouteModule module="factures"><p>Liste des factures</p></RouteModule>} />
                </Route>
              </Routes>
            </MemoryRouter>
          </SessionContexte.Provider>
        </QueryClientProvider>
      );
    }
    render(<Direct />);
    expect(screen.getByText("Accès refusé")).toBeInTheDocument();
    expect(screen.getByTestId("lieu")).toHaveTextContent("/factures");
  });
});

describe("version construite (AUTH-12)", () => {
  it("s'affiche et se copie d'un clic", async () => {
    const meta = document.createElement("meta");
    meta.name = "version-construite";
    meta.content = "a294c7a · 25/09/2026 11:00";
    document.head.append(meta);
    const ecrire = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText: ecrire }, configurable: true });
    render(<><VersionConstruite /><ToastBox /></>);
    // Comme l'ancien menu : « version … », qui se copie au clic et l'annonce.
    await userEvent.click(screen.getByRole("button", { name: "version a294c7a · 25/09/2026 11:00" }));
    expect(ecrire).toHaveBeenCalledWith("a294c7a · 25/09/2026 11:00");
    expect(await screen.findByText("Version copiée : a294c7a · 25/09/2026 11:00")).toBeInTheDocument();
    meta.remove();
  });

  it("sans marqueur (serveur de développement) : « inconnue », sans casser le menu", () => {
    render(<VersionConstruite />);
    expect(screen.getByText("version inconnue")).toBeInTheDocument();
  });
});

describe("URL directe d'un module hors abonnement (relecture 4, M4)", () => {
  it("un module que le menu masque au niveau souscrit ne s'ouvre pas par son adresse", () => {
    // Niveau 1 (Découverte) : les bons de commande demandent le niveau 3.
    rendreAvecSession(<RouteModule module="bons_commande"><p>Liste des bons</p></RouteModule>, { role: "admin", niveau: 1 });
    expect(screen.queryByText("Liste des bons")).not.toBeInTheDocument();
    expect(screen.getByText("L'abonnement de la société n'inclut pas ce module.")).toBeInTheDocument();
  });

  it("au niveau qui l'ouvre (ou sans niveau connu), il s'ouvre", () => {
    rendreAvecSession(<RouteModule module="bons_commande"><p>Liste des bons</p></RouteModule>, { role: "admin", niveau: 3 });
    expect(screen.getByText("Liste des bons")).toBeInTheDocument();
  });
});
