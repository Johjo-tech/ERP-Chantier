import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ecrirePreference, lirePreference } from "@/lib/stockage";
import { chargerSession, compteConnecte, fermerSessionLocale, seDeconnecter, surChangementDeSession } from "../api/session";
import { avecDelai, DemarrageImpossible } from "../domain/demarrage";
import { estSessionExpiree, type MotifDeconnexion } from "../domain/expiration";
import type { RoleMembre } from "../domain/permissions";
import { rolesDeLaSession, simulationRetenue, societeRetenue } from "../domain/selection";
import { SessionContexte, type EtatSession, type ValeurSession } from "./SessionContexte";

const CLE_SOCIETE = "erp.web.societe";
const CLE_SIMULATION = "erp.web.simulation";
const CLE_COMPTE = ["auth", "compte"] as const;

/** La session se relit au plus toutes les cinq minutes : rôles et matrice changent rarement. */
const FRAICHEUR_SESSION_MS = 300_000;
/** Deux essais de plus sur une panne passagère, comme les autres lectures. */
const ESSAIS_SESSION = 2;

/** Rien du compte précédent ne doit survivre : les clés métier portent la société, pas l'utilisateur. */
const oublierLeMetier = (qc: QueryClient) => qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" });

/**
 * Une session expirée en cours de route renvoie à la connexion (AUTH-10).
 *
 * On écoute les caches de lectures ET d'écritures : n'importe quelle requête
 * peut être la première à recevoir le refus du jeton. La session est fermée
 * localement (le serveur refuserait le jeton pour la fermer), le cache vidé,
 * et l'état passe à « anonyme » avec son motif — la page de connexion le dit.
 */
function useExpirationDeSession(qc: QueryClient, surExpiration: (m: MotifDeconnexion) => void) {
  useEffect(() => {
    let enCours = false;
    const expirer = (erreur: unknown) => {
      if (enCours || !estSessionExpiree(erreur)) return;
      enCours = true;
      surExpiration("session_expiree");
      fermerSessionLocale()
        .catch((e: unknown) => console.error("Fermeture locale de la session expirée impossible", e))
        .finally(() => {
          oublierLeMetier(qc);
          qc.setQueryData(CLE_COMPTE, null);
          enCours = false;
        });
    };
    const lectures = qc.getQueryCache().subscribe((ev) => {
      if (ev.type === "updated" && ev.action.type === "error") expirer(ev.action.error);
    });
    const ecritures = qc.getMutationCache().subscribe((ev) => {
      if (ev.type === "updated" && ev.action.type === "error") expirer(ev.action.error);
    });
    return () => {
      lectures();
      ecritures();
    };
  }, [qc, surExpiration]);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [motif, setMotif] = useState<MotifDeconnexion | undefined>(undefined);
  useExpirationDeSession(qc, setMotif);

  // Le délai de démarrage couvre aussi la lecture du jeton : un rafraîchissement
  // bloqué laisserait sinon l'écran sur « Ouverture de la session… » à jamais.
  const compte = useQuery({ queryKey: CLE_COMPTE, queryFn: () => avecDelai(compteConnecte()), staleTime: Infinity, retry: false });

  useEffect(
    () =>
      surChangementDeSession(() => {
        void qc.invalidateQueries({ queryKey: ["auth"] });
      }),
    [qc]
  );

  const uid = compte.data ?? null;

  // Un AUTRE compte (session expirée, déconnexion depuis un autre onglet, puis
  // nouvelle connexion) ne doit rien hériter du cache du précédent.
  const uidPrecedent = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (compte.isPending) return;
    if (uidPrecedent.current !== undefined && uidPrecedent.current !== uid) oublierLeMetier(qc);
    uidPrecedent.current = uid;
  }, [uid, compte.isPending, qc]);

  const session = useQuery({
    queryKey: ["auth", "session", uid],
    queryFn: () => avecDelai(chargerSession(uid as string)),
    enabled: uid !== null,
    staleTime: FRAICHEUR_SESSION_MS,
    // Un délai dépassé ou une matrice illisible ne se corrige pas en réessayant
    // aussitôt : trois fois 15 s d'attente pour le même message, c'est trop.
    retry: (echecs, erreur) => !(erreur instanceof DemarrageImpossible) && !estSessionExpiree(erreur) && echecs < ESSAIS_SESSION,
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
    // Déconnexion voulue : aucun motif à afficher sur la page de connexion.
    setMotif(undefined);
    qc.clear();
  }, [qc]);

  const etat: EtatSession = useMemo(() => {
    if (compte.isPending) return { statut: "chargement" };
    if (compte.isError) return { statut: "erreur", erreur: compte.error, reessayer: () => void compte.refetch() };
    if (uid === null) return motif ? { statut: "anonyme", motif } : { statut: "anonyme" };
    if (session.isPending) return { statut: "chargement" };
    if (session.isError) return { statut: "erreur", erreur: session.error, reessayer: () => void session.refetch() };
    return { statut: "connecte", session: session.data };
  }, [compte, session, uid, motif]);

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
