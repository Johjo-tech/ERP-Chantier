import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import { todayISO } from "@/lib/dates";
import { usePermission, useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { listerDocumentsLegaux } from "@/modules/reglages/api/documentsLegaux";
import { clesReglages } from "@/modules/reglages/hooks/useReglagesEcran";
import { listerDocuments } from "@/modules/rh/api/dossier";
import { listerDocumentsSousTraitants, listerSousTraitants } from "@/modules/rh/api/intervenants";
import { listerSalaries } from "@/modules/rh/api/salaries";
import { clesRh, useDroitsRh } from "@/modules/rh/hooks/useRh";
import { SEUILS_DEFAUT } from "@/modules/societes/domain/reglages-societe";
import { useReglagesSociete } from "@/modules/societes/hooks/useSocieteReglages";
import { documentsAEcheance } from "@/modules/vehicules/api/documents";
import { listerVehicules } from "@/modules/vehicules/api/vehicules";
import { alertesVehicule } from "@/modules/vehicules/domain/echeances";
import { clesVehicules } from "@/modules/vehicules/hooks/useVehicules";
import { bonsASurveiller, listerTraitees, marquerTraitees } from "../api/notifications";
import {
  notificationsActives,
  notificationsBonsEnRetard,
  notificationsDocumentsLegaux,
  notificationsDossierRh,
  notificationsRappels,
  notificationsSalarie,
  notificationsSousTraitants,
  notificationsVehicules,
  type Notification,
} from "../domain/notifications";

export const clesNotifications = {
  bons: (societeId: string, jour: string) => ["notifications", societeId, "bons", jour] as const,
  traitees: (societeId: string) => ["notifications", societeId, "traitees"] as const,
};

/** Les alertes changent au fil de la journée, pas de la seconde. */
const FRAICHEUR_MS = 5 * 60_000;

export interface EtatNotifications {
  actives: Notification[];
  /** Les familles qu'on n'a pas pu lire : la cloche le dit plutôt que de se taire. */
  sourcesIllisibles: string[];
  chargement: boolean;
}

/**
 * Toutes les alertes de la société (TRV-09). Chaque famille n'est lue que si
 * le rôle ouvre l'écran où elle se traite — pas de requête vouée au refus ni
 * d'alerte qui mènerait à une page fermée. Une famille illisible n'éteint pas
 * les autres (chargement tolérant, TRV-10).
 */
export function useNotifications(): EtatNotifications {
  const s = useSocieteActive();
  const aujourdhui = todayISO();
  const voirVehicules = usePermission("vehicules");
  const voirRh = usePermission("rh");
  const { sensible } = useDroitsRh();
  const voirReglages = usePermission("reglages");
  const voirBons = usePermission("bons_commande");
  const reglages = useReglagesSociete();
  const seuils = reglages.data?.seuils ?? SEUILS_DEFAUT;
  const opts = { staleTime: FRAICHEUR_MS };

  const vehicules = useQuery({ queryKey: clesVehicules.liste(s.id), queryFn: () => listerVehicules(s.id), enabled: voirVehicules, ...opts });
  const docsVehicules = useQuery({ queryKey: clesVehicules.echeances(s.id), queryFn: () => documentsAEcheance(s.id), enabled: voirVehicules, ...opts });
  const salaries = useQuery({ queryKey: clesRh.salaries(s.id, sensible), queryFn: () => listerSalaries(s.id, sensible), enabled: voirRh, ...opts });
  const dossiers = useQuery({ queryKey: clesRh.documents(s.id), queryFn: () => listerDocuments(s.id), enabled: sensible, ...opts });
  const sousTraitants = useQuery({ queryKey: clesRh.sousTraitants(s.id), queryFn: () => listerSousTraitants(s.id), enabled: voirRh, ...opts });
  const docsSousTraitants = useQuery({ queryKey: clesRh.documentsSousTraitants(s.id), queryFn: () => listerDocumentsSousTraitants(s.id), enabled: voirRh, ...opts });
  const legaux = useQuery({ queryKey: clesReglages.documentsLegaux(s.id), queryFn: () => listerDocumentsLegaux(s.id), enabled: voirReglages, ...opts });
  const bons = useQuery({ queryKey: clesNotifications.bons(s.id, aujourdhui), queryFn: () => bonsASurveiller(s.id, aujourdhui), enabled: voirBons, ...opts });
  const traitees = useQuery({ queryKey: clesNotifications.traitees(s.id), queryFn: () => listerTraitees(s.id), ...opts });

  const sources: [string, UseQueryResult][] = [
    ["véhicules", vehicules], ["documents des véhicules", docsVehicules], ["salariés", salaries], ["dossiers RH", dossiers],
    ["sous-traitants", sousTraitants], ["documents des sous-traitants", docsSousTraitants], ["documents légaux", legaux],
    ["bons de commande", bons], ["alertes déjà traitées", traitees],
  ];
  const sourcesIllisibles = sources.filter(([, q]) => q.isError).map(([nom]) => nom);

  const actives = useMemo(() => {
    const toutes = [
      ...notificationsVehicules((vehicules.data ?? []).flatMap((v) => alertesVehicule(v, seuils, docsVehicules.data ?? [], aujourdhui))),
      ...(salaries.data ?? []).flatMap((x) => notificationsSalarie(x, dossiers.data ?? [], seuils, aujourdhui)),
      ...notificationsDocumentsLegaux(legaux.data ?? [], seuils.documentLegal, aujourdhui),
      ...notificationsDossierRh(dossiers.data ?? [], salaries.data ?? [], seuils.documentLegal, aujourdhui),
      ...notificationsBonsEnRetard(bons.data ?? [], aujourdhui),
      ...notificationsSousTraitants(sousTraitants.data ?? [], docsSousTraitants.data ?? [], seuils.documentLegal, aujourdhui),
      ...notificationsRappels(bons.data ?? [], aujourdhui),
    ];
    return notificationsActives(toutes, traitees.data ?? new Set());
  }, [vehicules.data, docsVehicules.data, salaries.data, dossiers.data, legaux.data, bons.data, sousTraitants.data, docsSousTraitants.data, traitees.data, seuils, aujourdhui]);

  return { actives, sourcesIllisibles, chargement: sources.some(([, q]) => q.isLoading) };
}

export function useMarquerTraitees() {
  const s = useSocieteActive();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cles: readonly string[]) => marquerTraitees(s.id, cles),
    onSettled: () => void qc.invalidateQueries({ queryKey: clesNotifications.traitees(s.id) }),
  });
}
