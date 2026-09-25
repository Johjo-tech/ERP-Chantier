import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { SessionContexte } from "@/modules/auth-roles/hooks/SessionContexte";
import { sessionFactice } from "@/test/session-factice";

/**
 * Relecture 4, B2. État factice : une ligne de DPGF passée de 0 à 50 % par une
 * situation dont la facture est encore en brouillon À L'ÉCRAN — mais qu'un
 * autre onglet (ou un collègue) vient d'émettre. La base refuse la suppression.
 *
 * L'ancien geste rendait l'avancement (écriture du DPGF) AVANT de supprimer :
 * le refus laissait le DPGF à 0 % et la facture à 50 % debout. Le geste est
 * désormais UN appel à la base (`supprimer_brouillon_facture`, tout ou rien) :
 * l'écran ne touche plus au DPGF lui-même. La transaction côté base est
 * couverte par tests/rls/transactions-facturation.essai.ts.
 */
const dpgf = vi.hoisted(() => ({ avancement: 50 }));

vi.mock("@/modules/facturation/api/operations", () => ({
  // L'ancienne première étape : si l'écran l'appelait encore, le DPGF bougerait.
  rendreAvancementDuBrouillon: vi.fn(async () => {
    dpgf.avancement = 0;
  }),
  dupliquerFacture: vi.fn(),
  etablirAvoir: vi.fn(),
  factureDepuisDevis: vi.fn(),
  facturerSituation: vi.fn(),
}));

const refus = { code: "23514", message: "Cette facture a été émise entre-temps (n° FA-2026-0042) : elle ne se supprime plus, elle se corrige par un avoir.", details: null, hint: null };

vi.mock("@/modules/facturation/api/factures", () => ({
  supprimerBrouillon: vi.fn(async () => {
    throw { code: "42501", message: "Suppression refusée" };
  }),
  supprimerBrouillonFacture: vi.fn(async () => {
    throw refus;
  }),
  ajouterReglement: vi.fn(),
  contexteImpression: vi.fn(),
  creerFacture: vi.fn(),
  deverrouillerBrouillon: vi.fn(),
  emettreFacture: vi.fn(),
  listerFactures: vi.fn(),
  lireFacture: vi.fn(),
  modifierBrouillon: vi.fn(),
  reglementsDeLaSociete: vi.fn(),
  supprimerReglement: vi.fn(),
  verrouillerBrouillon: vi.fn(),
}));

import { messageErreur } from "@/lib/erreurs";
import { useSupprimerBrouillon } from "@/modules/facturation/hooks/useFactures";

function enveloppe({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <SessionContexte.Provider value={sessionFactice({ role: "admin" })}>{children}</SessionContexte.Provider>
    </QueryClientProvider>
  );
}

describe("supprimer le brouillon d'une situation", () => {
  it("une suppression refusée ne rend PAS l'avancement au DPGF (sinon il se refacture)", async () => {
    const { result } = renderHook(() => useSupprimerBrouillon(), { wrapper: enveloppe });
    act(() => result.current.mutate("facture-situation"));
    await waitFor(() => expect(result.current.isError).toBe(true));
    // La facture existe toujours (émise) ; le DPGF doit toujours dire 50 %.
    expect(dpgf.avancement).toBe(50);
    // Et le motif lu est celui de la base, pas « une situation plus récente… ».
    expect(messageErreur(result.current.error)).toBe(refus.message);
  });
});
