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
  const { etat: e, roleEffectif } = useSession();
  return <p>{e.statut === "connecte" ? `${e.session.utilisateur.nom} ${roleEffectif}` : e.statut}</p>;
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
});
