import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { usePermission, useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { affecter, listerAffectations, listerMembres, retirerAffectation } from "../api/affectations";
import { ajouterAchat, listerAchats, listerCategoriesAchat, listerSalaries, supprimerAchat } from "../api/achats";
import {
  deposerCompteRendu,
  deposerDevisComplementaire,
  deposerDocument,
  deposerInspection,
  listerComptesRendus,
  listerDevisComplementaires,
  listerDocuments,
  listerInspections,
  marquerCompteRenduVu,
  redater,
  retirer,
  type TableDatee,
} from "../api/documents";
import { identitePourPpsps, listerDevisAvecLignes, listerFacturesDuChantier, listerMetiers } from "../api/liens";
import { urlFichier } from "../api/stockage";
import { ajouterTodo, changerStatutTodo, enregistrerDetailTodo, listerTodos, supprimerTodo } from "../api/todos";
import type { SaisieAchat } from "../domain/achats";
import type { FamilleDocument } from "../domain/fichiers";
import type { DetailTodo, StatutTodo } from "../domain/todo";
import { clesChantiers, usePeutVoirDpgf } from "./useChantiers";

/** Les tables filles d'une fiche chantier : une clé par table, rangée sous le chantier. */
export const clesFiche = {
  documents: (id: string) => ["chantier", id, "documents"] as const,
  comptesRendus: (id: string) => ["chantier", id, "comptes-rendus"] as const,
  inspections: (id: string) => ["chantier", id, "inspections"] as const,
  devisComplementaires: (id: string) => ["chantier", id, "devis-complementaires"] as const,
  achats: (id: string) => ["chantier", id, "achats"] as const,
  todos: (id: string) => ["chantier", id, "todos"] as const,
  affectations: (id: string) => ["chantier", id, "affectations"] as const,
  factures: (id: string) => ["chantier", id, "factures"] as const,
  devis: (id: string) => ["chantier", id, "devis-lignes"] as const,
};

const CLE_PAR_TABLE: Record<TableDatee, (id: string) => QueryKey> = {
  chantier_documents: clesFiche.documents,
  chantier_comptes_rendus: clesFiche.comptesRendus,
  chantier_inspections: clesFiche.inspections,
  chantier_devis_complementaires: clesFiche.devisComplementaires,
};

/** Une mutation qui, réussie ou non, fait relire la table touchée : l'écran ne ment jamais sur la base. */
function useEcriture<V>(cle: QueryKey, ecrire: (v: V) => Promise<unknown>, autres: QueryKey[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ecrire,
    onSettled: () => {
      for (const k of [cle, ...autres]) void qc.invalidateQueries({ queryKey: k });
    },
  });
}

// ── Documents ───────────────────────────────────────────────────────────────

export const useDocuments = (id: string) => useQuery({ queryKey: clesFiche.documents(id), queryFn: () => listerDocuments(id) });
export const useComptesRendus = (id: string) => useQuery({ queryKey: clesFiche.comptesRendus(id), queryFn: () => listerComptesRendus(id) });
export const useInspections = (id: string) => useQuery({ queryKey: clesFiche.inspections(id), queryFn: () => listerInspections(id) });

export function useDevisComplementaires(id: string) {
  const autorise = usePeutVoirDpgf();
  return useQuery({ queryKey: clesFiche.devisComplementaires(id), queryFn: () => listerDevisComplementaires(id), enabled: autorise });
}

export function useDeposerDocument(chantierId: string) {
  const societe = useSocieteActive();
  return useEcriture(clesFiche.documents(chantierId), ({ famille, fichier }: { famille: FamilleDocument; fichier: File }) =>
    deposerDocument(societe.id, chantierId, famille, fichier)
  );
}

export function useDeposerCompteRendu(chantierId: string) {
  const societe = useSocieteActive();
  return useEcriture(clesFiche.comptesRendus(chantierId), (fichier: File) => deposerCompteRendu(societe.id, chantierId, fichier), [
    clesChantiers.compteurs(societe.id),
  ]);
}

export function useMarquerCompteRenduVu(chantierId: string) {
  return useEcriture(clesFiche.comptesRendus(chantierId), marquerCompteRenduVu);
}

export function useDeposerInspection(chantierId: string) {
  const societe = useSocieteActive();
  return useEcriture(clesFiche.inspections(chantierId), (fichier: File) => deposerInspection(societe.id, chantierId, fichier));
}

export function useDeposerDevisComplementaire(chantierId: string) {
  const societe = useSocieteActive();
  return useEcriture(clesFiche.devisComplementaires(chantierId), (fichier: File) => deposerDevisComplementaire(societe.id, chantierId, fichier));
}

export function useRedater(chantierId: string, table: TableDatee) {
  return useEcriture(CLE_PAR_TABLE[table](chantierId), ({ id, date }: { id: string; date: string | null }) => redater(table, id, date));
}

export function useRetirerFichier(chantierId: string, table: TableDatee) {
  const societe = useSocieteActive();
  return useEcriture(CLE_PAR_TABLE[table](chantierId), (id: string) => retirer(table, id), [clesChantiers.compteurs(societe.id)]);
}

// ── Achats ──────────────────────────────────────────────────────────────────

export function useAchats(chantierId: string) {
  const autorise = usePeutVoirDpgf();
  return useQuery({ queryKey: clesFiche.achats(chantierId), queryFn: () => listerAchats(chantierId), enabled: autorise });
}

export function useCategoriesAchat() {
  const societe = useSocieteActive();
  return useQuery({ queryKey: ["referentiels", societe.id, "categorie_achat"], queryFn: () => listerCategoriesAchat(societe.id), staleTime: 5 * 60_000 });
}

export function useSalaries() {
  const societe = useSocieteActive();
  const autorise = usePermission("rh", "voir");
  return useQuery({ queryKey: ["salaries-annuaire", societe.id], queryFn: () => listerSalaries(societe.id), enabled: autorise, staleTime: 5 * 60_000 });
}

export const useAjouterAchat = (chantierId: string) => useEcriture(clesFiche.achats(chantierId), (a: SaisieAchat) => ajouterAchat(chantierId, a));
export const useSupprimerAchat = (chantierId: string) => useEcriture(clesFiche.achats(chantierId), supprimerAchat);

// ── To-do ───────────────────────────────────────────────────────────────────

export const useTodos = (chantierId: string) => useQuery({ queryKey: clesFiche.todos(chantierId), queryFn: () => listerTodos(chantierId) });
export const useAjouterTodo = (chantierId: string) =>
  useEcriture(clesFiche.todos(chantierId), ({ texte, position }: { texte: string; position: number }) => ajouterTodo(chantierId, texte, position));
export const useChangerStatutTodo = (chantierId: string) =>
  useEcriture(clesFiche.todos(chantierId), ({ id, statut }: { id: string; statut: StatutTodo }) => changerStatutTodo(id, statut));
export const useEnregistrerDetailTodo = (chantierId: string) =>
  useEcriture(clesFiche.todos(chantierId), ({ id, detail }: { id: string; detail: DetailTodo }) => enregistrerDetailTodo(id, detail));
export const useSupprimerTodo = (chantierId: string) => useEcriture(clesFiche.todos(chantierId), supprimerTodo);

// ── Intervenants ────────────────────────────────────────────────────────────

export const useAffectations = (chantierId: string) => useQuery({ queryKey: clesFiche.affectations(chantierId), queryFn: () => listerAffectations(chantierId) });

export function useMembres() {
  const societe = useSocieteActive();
  return useQuery({ queryKey: ["membres", societe.id], queryFn: () => listerMembres(societe.id), staleTime: 5 * 60_000 });
}

export function useAffecter(chantierId: string) {
  const societe = useSocieteActive();
  return useEcriture(clesFiche.affectations(chantierId), ({ profileId, role }: { profileId: string; role: string | null }) =>
    affecter(societe.id, chantierId, profileId, role)
  );
}

export const useRetirerAffectation = (chantierId: string) => useEcriture(clesFiche.affectations(chantierId), retirerAffectation);

// ── Ce que la fiche lit ailleurs ────────────────────────────────────────────

export function useFacturesDuChantier(chantierId: string) {
  const autorise = usePermission("factures", "voir");
  return useQuery({ queryKey: clesFiche.factures(chantierId), queryFn: () => listerFacturesDuChantier(chantierId), enabled: autorise });
}

export function useDevisAvecLignes(chantierId: string) {
  const autorise = usePermission("devis", "voir");
  return useQuery({ queryKey: clesFiche.devis(chantierId), queryFn: () => listerDevisAvecLignes(chantierId), enabled: autorise });
}

export function useMetiers() {
  const societe = useSocieteActive();
  return useQuery({ queryKey: ["metiers", societe.id], queryFn: () => listerMetiers(societe.id), staleTime: 5 * 60_000 });
}

/** Une URL signée demandée au moment d'ouvrir : elle expire, on ne la garde pas en cache. */
export function useUrlFichier() {
  return useMutation({ mutationFn: (chemin: string) => urlFichier(chemin) });
}

export function useIdentitePpsps() {
  const societe = useSocieteActive();
  return useMutation({ mutationFn: () => identitePourPpsps(societe.id) });
}
