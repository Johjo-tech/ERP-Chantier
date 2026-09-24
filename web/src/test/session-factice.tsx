import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import type { SocieteAccessible } from "@/modules/auth-roles/api/session";
import { construireMatrice, roleEffectif, type DroitAccorde, type RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { SessionContexte, type ValeurSession } from "@/modules/auth-roles/hooks/SessionContexte";
import droits from "./fixtures/role_permissions.json";

/** La matrice réelle, relevée sur la base locale (tests/rls vérifie qu'elle n'a pas bougé). */
export const MATRICE_REELLE = construireMatrice(droits as DroitAccorde[]);

export const ALPHA: SocieteAccessible = { id: "alpha", code: "alpha", nom: "ALPHA Rénovation", role: "admin", niveauAbonnement: null };

interface Options {
  role: RoleMembre;
  simule?: RoleMembre | null;
  niveau?: number | null;
  societes?: SocieteAccessible[];
  chemin?: string;
}

export function sessionFactice({ role, simule = null, niveau = null, societes }: Options): ValeurSession {
  const active = { ...ALPHA, role, niveauAbonnement: niveau };
  return {
    etat: {
      statut: "connecte",
      session: {
        utilisateur: { id: "u1", email: "test@erp.local", nom: "Compte de test" },
        societes: societes ?? [active],
        matrice: MATRICE_REELLE,
      },
    },
    societeActive: active,
    choisirSociete: () => undefined,
    roleReel: role,
    roleSimule: role === "admin" ? simule : null,
    simulerRole: () => undefined,
    roleEffectif: roleEffectif(role, simule),
    deconnecter: async () => undefined,
  };
}

/** Rend un élément sous une session connectée factice, sans réseau. */
export function rendreAvecSession(ui: ReactElement, options: Options) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SessionContexte.Provider value={sessionFactice(options)}>
        <MemoryRouter initialEntries={[options.chemin ?? "/"]}>{ui}</MemoryRouter>
      </SessionContexte.Provider>
    </QueryClientProvider>
  );
}
