/**
 * SOC-42 — l'ancien écran lançait dossiers, visites et invitations PENDANT le
 * chargement global, avant de connaître la société : ils restaient vides
 * toute la session. Ici, chaque lecture RH est indexée par société et ne part
 * qu'une fois la session ouverte (le composant n'est monté qu'ensuite).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { RouteConnectee } from "@/modules/auth-roles/components/RouteProtegee";
import { SessionContexte, type ValeurSession } from "@/modules/auth-roles/hooks/SessionContexte";
import { ALPHA, sessionFactice } from "@/test/session-factice";
import { clesComptes } from "@/modules/comptes/hooks/useComptes";
import { clesRh, useDocumentsRh, useVisitesRh } from "./useRh";

const dossier = vi.hoisted(() => ({
  listerDocuments: vi.fn(async (societe: string) => [{ id: `doc-${societe}` }]),
  listerVisites: vi.fn(async (societe: string) => [{ id: `visite-${societe}` }]),
  listerAbsences: vi.fn(async () => []),
}));
vi.mock("../api/dossier", () => dossier);

const BETA = { ...ALPHA, id: "beta", code: "beta", nom: "BETA Bâtiment" };

function DossiersRh() {
  const docs = useDocumentsRh();
  const visites = useVisitesRh();
  return <p>{[...(docs.data ?? []), ...(visites.data ?? [])].map((d) => (d as { id: string }).id).join(" ")}</p>;
}

function Application({ etat }: { etat: ValeurSession["etat"] }) {
  const [societe, setSociete] = useState(ALPHA);
  const base = sessionFactice({ role: "admin", societes: [ALPHA, BETA] });
  const valeur: ValeurSession = { ...base, etat, societeActive: { ...societe, role: "admin" } };
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <SessionContexte.Provider value={valeur}>
        <MemoryRouter>
          <button type="button" onClick={() => setSociete(BETA)}>BETA</button>
          <RouteConnectee>
            <DossiersRh key={societe.id} />
          </RouteConnectee>
        </MemoryRouter>
      </SessionContexte.Provider>
    </QueryClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());

describe("chargements RH indexés par société (SOC-42)", () => {
  it("toutes les clés RH — et celles des invitations — portent la société", () => {
    for (const [nom, cle] of Object.entries(clesRh)) expect(cle("s1", true)[1], nom).toBe("s1");
    for (const [nom, cle] of Object.entries(clesComptes)) expect(cle("s1"), nom).toContain("s1");
  });

  it("rien ne part pendant l'ouverture de la session", () => {
    render(<Application etat={{ statut: "chargement" }} />);
    expect(screen.getByText("Ouverture de la session…")).toBeInTheDocument();
    expect(dossier.listerDocuments).not.toHaveBeenCalled();
    expect(dossier.listerVisites).not.toHaveBeenCalled();
  });

  it("session ouverte : dossiers et visites de la société active ; changer de société relit ceux de l'autre", async () => {
    render(<Application etat={sessionFactice({ role: "admin" }).etat} />);
    expect(await screen.findByText("doc-alpha visite-alpha")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "BETA" }));
    expect(await screen.findByText("doc-beta visite-beta")).toBeInTheDocument();
    expect(dossier.listerDocuments).toHaveBeenCalledWith("beta");
  });
});
