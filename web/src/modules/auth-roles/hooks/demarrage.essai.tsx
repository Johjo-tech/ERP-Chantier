import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { MATRICE_REELLE } from "@/test/session-factice";
import { RouteConnectee } from "../components/RouteProtegee";
import { PageConnexion } from "../components/PageConnexion";
import { DELAI_DEMARRAGE_MS } from "../domain/demarrage";
import { SessionProvider } from "./SessionProvider";

const etat = vi.hoisted(() => ({ uid: "admin" as string | null, rappel: (): void => undefined, sessionMuette: false }));
const api = vi.hoisted(() => ({
  compteConnecte: vi.fn(async () => etat.uid),
  chargerSession: vi.fn(),
  seDeconnecter: vi.fn(),
  fermerSessionLocale: vi.fn(async () => {
    etat.uid = null;
  }),
  surChangementDeSession: (r: () => void) => {
    etat.rappel = r;
    return () => undefined;
  },
}));
vi.mock("../api/session", () => api);

beforeEach(() => {
  etat.uid = "admin";
  api.chargerSession.mockReset();
  api.chargerSession.mockImplementation(async (uid: string) => ({
    utilisateur: { id: uid, email: `${uid}@erp.local`, nom: uid },
    societes: [{ id: "alpha", code: "alpha", nom: "ALPHA", role: "admin", niveauAbonnement: null }],
    matrice: MATRICE_REELLE,
    accesClients: [],
  }));
});
afterEach(() => vi.useRealTimers());

/** Un écran métier dont la lecture reçoit le refus d'un jeton expiré. */
function EcranQuiExpire() {
  const q = useQuery({ queryKey: ["chantiers", "alpha"], queryFn: async () => Promise.reject({ code: "PGRST301", message: "JWT expired" }), retry: false });
  return <p>{q.isError ? "lecture refusée" : "écran métier"}</p>;
}

function monter(qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  render(
    <QueryClientProvider client={qc}>
      <SessionProvider>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/connexion" element={<PageConnexion />} />
            <Route path="/" element={<RouteConnectee><EcranQuiExpire /></RouteConnectee>} />
          </Routes>
        </MemoryRouter>
      </SessionProvider>
    </QueryClientProvider>
  );
  return qc;
}

describe("session expirée en cours de route (AUTH-10)", () => {
  it("renvoie à la connexion, dit pourquoi, et vide le cache métier", async () => {
    const qc = monter();
    expect(await screen.findByText("Votre session a expiré. Reconnectez-vous pour reprendre là où vous en étiez.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrer" })).toBeInTheDocument();
    expect(api.fermerSessionLocale).toHaveBeenCalledTimes(1);
    expect(qc.getQueryData(["chantiers", "alpha"])).toBeUndefined();
  });

  it("détectée dès le chargement de la session : pas d'écran d'erreur, retour à la connexion", async () => {
    api.chargerSession.mockRejectedValue({ code: "PGRST303", message: "JWT expired" });
    monter();
    expect(await screen.findByText(/Votre session a expiré/)).toBeInTheDocument();
    expect(api.chargerSession).toHaveBeenCalledTimes(1);
  });
});

describe("délai de démarrage (AUTH-09)", () => {
  it("une session qui ne répond pas affiche, au bout de 15 s, le message de l'ancien écran — sans trois essais de 15 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.chargerSession.mockImplementation(() => new Promise(() => undefined));
    monter();
    expect(await screen.findByText("Ouverture de la session…")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAI_DEMARRAGE_MS);
    });
    expect(await screen.findByText(/La couche de données n'a pas répondu en 15 secondes/)).toBeInTheDocument();
    expect(api.chargerSession).toHaveBeenCalledTimes(1);
  });
});
