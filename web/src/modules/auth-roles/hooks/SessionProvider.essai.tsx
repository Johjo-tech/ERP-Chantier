import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MATRICE_REELLE } from "@/test/session-factice";
import { SessionProvider } from "./SessionProvider";
import { useSession } from "./useSession";

const etat = vi.hoisted(() => ({ uid: "admin" as string | null, rappel: (): void => undefined }));
vi.mock("../api/session", () => ({
  compteConnecte: vi.fn(async () => etat.uid),
  chargerSession: vi.fn(async (uid: string) => ({
    utilisateur: { id: uid, email: `${uid}@erp.local`, nom: uid },
    societes: [{ id: "alpha", code: "alpha", nom: "ALPHA", role: uid === "admin" ? "admin" : "technicien", niveauAbonnement: null }],
    matrice: MATRICE_REELLE,
  })),
  seDeconnecter: vi.fn(),
  surChangementDeSession: (r: () => void) => {
    etat.rappel = r;
    return () => undefined;
  },
}));

function Qui() {
  const { etat: e, roleEffectif, simulerRole } = useSession();
  return (
    <>
      <p>{e.statut === "connecte" ? `${e.session.utilisateur.nom} ${roleEffectif}` : e.statut}</p>
      <button type="button" onClick={() => simulerRole("technicien")}>Voir en tant que technicien</button>
    </>
  );
}

describe("SessionProvider", () => {
  it("un changement de compte sans « Se déconnecter » vide le cache métier", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <SessionProvider>
          <Qui />
        </SessionProvider>
      </QueryClientProvider>
    );
    expect(await screen.findByText("admin admin")).toBeInTheDocument();
    // L'admin a chargé la liste des chantiers de la société.
    qc.setQueryData(["chantiers", "alpha"], ["chantier réservé à l'admin"]);

    // Session expirée puis connexion d'un technicien, dans le même onglet.
    etat.uid = "tech";
    await act(async () => etat.rappel());
    expect(await screen.findByText("tech technicien")).toBeInTheDocument();
    await waitFor(() => expect(qc.getQueryData(["chantiers", "alpha"])).toBeUndefined());
  });

  it("la simulation « voir en tant que » ne survit pas à l'expiration de la session (relecture 4, M5)", async () => {
    etat.uid = "admin";
    window.localStorage.clear();
    const monter = () =>
      render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <SessionProvider>
            <Qui />
          </SessionProvider>
        </QueryClientProvider>
      );
    const premier = monter();
    expect(await screen.findByText("admin admin")).toBeInTheDocument();
    act(() => screen.getByRole("button", { name: "Voir en tant que technicien" }).click());
    expect(await screen.findByText("admin technicien")).toBeInTheDocument();
    // La session expire : plus de compte.
    etat.uid = null;
    await act(async () => etat.rappel());
    expect(await screen.findByText("anonyme")).toBeInTheDocument();
    premier.unmount();
    // L'administrateur suivant se connecte sur le même poste : il n'hérite pas du rôle simulé.
    etat.uid = "admin";
    monter();
    expect(await screen.findByText("admin admin")).toBeInTheDocument();
  });

  it("la simulation survit à un rechargement du même compte", async () => {
    etat.uid = "admin";
    window.localStorage.clear();
    const monter = () =>
      render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <SessionProvider>
            <Qui />
          </SessionProvider>
        </QueryClientProvider>
      );
    const premier = monter();
    expect(await screen.findByText("admin admin")).toBeInTheDocument();
    act(() => screen.getByRole("button", { name: "Voir en tant que technicien" }).click());
    expect(await screen.findByText("admin technicien")).toBeInTheDocument();
    premier.unmount();
    monter();
    expect(await screen.findByText("admin technicien")).toBeInTheDocument();
  });
});
