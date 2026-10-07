import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

/**
 * Un nouveau devis s'ouvre sans client : la liste des interlocuteurs ne doit pas
 * être demandée pour `""`, que la base refuse (uuid invalide) — ce refus allumait
 * le bandeau « Certaines données n'ont pas pu être chargées (interlocuteurs) »
 * sur chaque formulaire neuf (devis, facture, bon, rapport).
 */
const lister = vi.hoisted(() => vi.fn(async () => []));

vi.mock("../api/interlocuteurs", () => ({
  listerInterlocuteurs: lister,
  creerInterlocuteur: vi.fn(),
  modifierInterlocuteur: vi.fn(),
  supprimerInterlocuteur: vi.fn(),
}));

import { useInterlocuteurs } from "./useClients";

function enveloppe({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useInterlocuteurs", () => {
  it("sans client choisi, ne demande rien à la base", () => {
    const { result } = renderHook(() => useInterlocuteurs(""), { wrapper: enveloppe });
    expect(lister).not.toHaveBeenCalled();
    expect(result.current.isError).toBe(false);
  });

  it("avec un client, lit ses interlocuteurs", async () => {
    const { result } = renderHook(() => useInterlocuteurs("c1000000-0000-0000-0000-000000000001"), { wrapper: enveloppe });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(lister).toHaveBeenCalledWith("c1000000-0000-0000-0000-000000000001");
  });
});
