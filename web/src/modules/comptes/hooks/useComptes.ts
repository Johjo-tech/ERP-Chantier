import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RoleMembre } from "@/modules/auth-roles/domain/permissions";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import {
  annulerInvitation,
  definirAcces,
  definirRole,
  inviterSalarie,
  listerConducteursSuivis,
  listerInvitations,
  listerMembres,
  listerSalaries,
  supprimerInvitation,
} from "../api/comptes";
import type { Membre, SaisieInvitation } from "../domain/comptes";

export const clesComptes = {
  membres: (id: string) => ["membres", id] as const,
  invitations: (id: string) => ["invitations", id] as const,
  salaries: (id: string) => ["salaries-comptes", id] as const,
  suivis: (id: string) => ["conducteurs-suivis", id] as const,
};

export function useMembres() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesComptes.membres(s.id), queryFn: () => listerMembres(s.id) });
}

export function useInvitations() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesComptes.invitations(s.id), queryFn: () => listerInvitations(s.id) });
}

export function useSalariesComptes() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesComptes.salaries(s.id), queryFn: () => listerSalaries(s.id) });
}

export function useConducteursSuivis() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesComptes.suivis(s.id), queryFn: () => listerConducteursSuivis(s.id) });
}

/** Rôle, accès et invitations : chaque geste relit membres ET invitations (l'un explique l'autre). */
export function useGererComptes() {
  const s = useSocieteActive();
  const qc = useQueryClient();
  const relire = () => {
    for (const cle of [clesComptes.membres(s.id), clesComptes.invitations(s.id), clesComptes.salaries(s.id)]) void qc.invalidateQueries({ queryKey: cle });
  };
  return {
    role: useMutation({ mutationFn: (v: { membre: Membre; role: RoleMembre }) => definirRole(v.membre, v.role), onSettled: relire }),
    acces: useMutation({ mutationFn: (v: { id: string; actif: boolean }) => definirAcces(v.id, v.actif), onSettled: relire }),
    inviter: useMutation({ mutationFn: (v: { salarieId: string; saisie: SaisieInvitation }) => inviterSalarie(v.salarieId, v.saisie), onSettled: relire }),
    annuler: useMutation({ mutationFn: (id: string) => annulerInvitation(id), onSettled: relire }),
    supprimer: useMutation({ mutationFn: (id: string) => supprimerInvitation(id), onSettled: relire }),
  };
}
