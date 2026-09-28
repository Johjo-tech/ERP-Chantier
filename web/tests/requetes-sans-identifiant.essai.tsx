/**
 * Une lecture qui dépend d'un identifiant ne part pas tant qu'il est vide (D-COR2-06) : demander les lignes
 * de `""` fait refuser la requête par la base (uuid invalide) et allume le bandeau « Certaines données n'ont
 * pas pu être chargées ». Constaté sur `useInterlocuteurs` (formulaire neuf) et `useDpgf` (situation ouverte
 * sans identifiant) ; le test couvre tous les hooks de ce genre. Le capteur est l'état de TanStack : une
 * requête lancée passe `fetchStatus` à « fetching », une requête retenue reste « idle » — sans dépendre du
 * réseau (supabase-js garde sa propre référence à `fetch`, qu'un espion posé après coup ne voit pas).
 * Le cas « identifiant connu » prouve que le capteur voit bien une requête quand il y en a une.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { SessionContexte } from "@/modules/auth-roles/hooks/SessionContexte";
import { useChantier, useDpgf, useTachesPlanifiees } from "@/modules/chantiers/hooks/useChantiers";
import {
  useAchats,
  useAffectations,
  useComptesRendus,
  useDevisAvecLignes,
  useDevisComplementaires,
  useDevisDuChantier,
  useDocuments,
  useFacturesDuChantier,
  useInspections,
  useTodos,
} from "@/modules/chantiers/hooks/useFiche";
import { useInterlocuteurs, useUsagesClient } from "@/modules/clients/hooks/useClients";
import { useLignesDuBon, usePhotosDuBon, useTravauxSupplementaires } from "@/modules/planning/hooks/usePlanning";
import { useDocumentsVehicule, useEntretiens, usePretsVehicule } from "@/modules/vehicules/hooks/useVehicules";
import { sessionFactice } from "@/test/session-factice";

// Le seul cas qui lit vraiment : sa lecture ne sort pas du test (jamais de base joignable en test unitaire).
const listerTodos = vi.hoisted(() => vi.fn(() => new Promise<never>(() => undefined)));
vi.mock("@/modules/chantiers/api/todos", async (original) => ({ ...(await original<typeof import("@/modules/chantiers/api/todos")>()), listerTodos }));

function enveloppe({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // L'administrateur voit tout : un `enabled` qui ne tiendrait qu'au droit laisserait partir la requête.
  return (
    <QueryClientProvider client={qc}>
      <SessionContexte.Provider value={sessionFactice({ role: "admin" })}>{children}</SessionContexte.Provider>
    </QueryClientProvider>
  );
}

const HOOKS: [string, (id: string) => unknown][] = [
  ["useDpgf", useDpgf],
  ["useTachesPlanifiees", useTachesPlanifiees],
  ["useDocuments", useDocuments],
  ["useComptesRendus", useComptesRendus],
  ["useInspections", useInspections],
  ["useDevisComplementaires", useDevisComplementaires],
  ["useAchats", useAchats],
  ["useTodos", useTodos],
  ["useAffectations", useAffectations],
  ["useFacturesDuChantier", useFacturesDuChantier],
  ["useDevisAvecLignes", useDevisAvecLignes],
  ["useDevisDuChantier", useDevisDuChantier],
  ["useInterlocuteurs", useInterlocuteurs],
  ["useUsagesClient", useUsagesClient],
  ["useLignesDuBon", useLignesDuBon],
  ["usePhotosDuBon", (id) => usePhotosDuBon(id).liste],
  ["useTravauxSupplementaires", (id) => useTravauxSupplementaires(id, true)],
  ["usePretsVehicule", usePretsVehicule],
  ["useEntretiens", useEntretiens],
  ["useDocumentsVehicule", useDocumentsVehicule],
];

/** Laisse à TanStack le temps de lancer ce qu'il lancerait (il déclenche au montage, dans une microtâche). */
const apresMontage = () => new Promise((r) => setTimeout(r, 20));

describe("aucune lecture avec un identifiant vide", () => {
  it.each(HOOKS)("%s(\"\") ne demande rien à la base", async (_nom, hook) => {
    const { result } = renderHook(() => hook(""), { wrapper: enveloppe });
    await apresMontage();
    expect(result.current).toMatchObject({ isError: false, fetchStatus: "idle" });
  });

  it("useChantier(undefined) non plus (fiche neuve)", async () => {
    const { result } = renderHook(() => useChantier(undefined), { wrapper: enveloppe });
    await apresMontage();
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("le capteur voit une lecture quand l'identifiant est connu", async () => {
    const { result } = renderHook(() => useTodos("c1000000-0000-0000-0000-000000000001"), { wrapper: enveloppe });
    await apresMontage();
    expect(result.current.fetchStatus).toBe("fetching");
    expect(listerTodos).toHaveBeenCalledWith("c1000000-0000-0000-0000-000000000001");
  });
});
