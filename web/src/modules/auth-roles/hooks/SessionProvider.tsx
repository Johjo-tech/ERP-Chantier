import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ecrirePreference, lirePreference } from "@/lib/stockage";
import { chargerSession, compteConnecte, seDeconnecter, surChangementDeSession } from "../api/session";
import type { RoleMembre } from "../domain/permissions";
import { rolesDeLaSession, simulationRetenue, societeRetenue } from "../domain/selection";
import { SessionContexte, type EtatSession, type ValeurSession } from "./SessionContexte";

const CLE_SOCIETE = "erp.web.societe";
const CLE_SIMULATION = "erp.web.simulation";

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const compte = useQuery({ queryKey: ["auth", "compte"], queryFn: compteConnecte, staleTime: Infinity });

  useEffect(
    () =>
      surChangementDeSession(() => {
        void qc.invalidateQueries({ queryKey: ["auth"] });
      }),
    [qc]
  );

  const uid = compte.data ?? null;
  const session = useQuery({
    queryKey: ["auth", "session", uid],
    queryFn: () => chargerSession(uid as string),
    enabled: uid !== null,
    staleTime: 5 * 60_000,
  });

  const [societeMemo, setSocieteMemo] = useState(() => lirePreference(CLE_SOCIETE));
  const [simulationMemo, setSimulationMemo] = useState(() => lirePreference(CLE_SIMULATION));

  const societes = session.data?.societes ?? [];
  const societeActive = societeRetenue(societes, societeMemo);
  const roleSimule = simulationRetenue(societeActive, simulationMemo);
  const { reel, effectif } = rolesDeLaSession(societeActive, roleSimule);

  const choisirSociete = useCallback((id: string) => {
    ecrirePreference(CLE_SOCIETE, id);
    setSocieteMemo(id);
  }, []);

  const simulerRole = useCallback((role: RoleMembre | null) => {
    ecrirePreference(CLE_SIMULATION, role);
    setSimulationMemo(role);
  }, []);

  const deconnecter = useCallback(async () => {
    await seDeconnecter();
    ecrirePreference(CLE_SIMULATION, null);
    setSimulationMemo(null);
    // Rien du compte précédent ne doit survivre dans le cache.
    qc.clear();
  }, [qc]);

  const etat: EtatSession = useMemo(() => {
    if (compte.isPending) return { statut: "chargement" };
    if (compte.isError) return { statut: "erreur", erreur: compte.error, reessayer: () => void compte.refetch() };
    if (uid === null) return { statut: "anonyme" };
    if (session.isPending) return { statut: "chargement" };
    if (session.isError) return { statut: "erreur", erreur: session.error, reessayer: () => void session.refetch() };
    return { statut: "connecte", session: session.data };
  }, [compte, session, uid]);

  const valeur: ValeurSession = {
    etat,
    societeActive,
    choisirSociete,
    roleReel: reel,
    roleSimule,
    simulerRole,
    roleEffectif: effectif,
    deconnecter,
  };
  return <SessionContexte.Provider value={valeur}>{children}</SessionContexte.Provider>;
}
