import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import {
  articleParCode,
  changerActif,
  chercherArticles,
  chercherPourLigne,
  codesExistants,
  creerArticle,
  importerArticles,
  listerFamilles,
  lireArticle,
  modifierArticle,
} from "../api/articles";
import type { CriteresArticles, SaisieArticle } from "../domain/article";
import type { ArticleImporte } from "../domain/import";

export const clesArticles = {
  racine: (s: string) => ["articles", s] as const,
  page: (s: string, c: CriteresArticles) => ["articles", s, "page", c] as const,
  familles: (s: string) => ["articles", s, "familles"] as const,
  ligne: (s: string, q: string) => ["articles", s, "ligne", q] as const,
  existants: (s: string, codes: readonly string[]) => ["articles", s, "existants", codes] as const,
  fiche: (id: string) => ["article", id] as const,
};

export function usePageArticles(criteres: CriteresArticles) {
  const societe = useSocieteActive();
  return useQuery({
    queryKey: clesArticles.page(societe.id, criteres),
    queryFn: () => chercherArticles(societe.id, criteres),
    // La page précédente reste affichée pendant la suivante : la liste ne clignote pas à chaque frappe.
    placeholderData: keepPreviousData,
  });
}

export function useFamillesArticles() {
  const societe = useSocieteActive();
  return useQuery({ queryKey: clesArticles.familles(societe.id), queryFn: () => listerFamilles(societe.id) });
}

export function useArticle(id: string | undefined) {
  return useQuery({ queryKey: clesArticles.fiche(id ?? ""), queryFn: () => lireArticle(id as string), enabled: !!id });
}

/** Toute écriture invalide pages, familles et suggestions : un code changé doit se voir partout. */
function useInvaliderCatalogue() {
  const societe = useSocieteActive();
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: clesArticles.racine(societe.id) });
}

export function useEnregistrerArticle(id: string | undefined) {
  const societe = useSocieteActive();
  const qc = useQueryClient();
  const invalider = useInvaliderCatalogue();
  return useMutation({
    mutationFn: (s: SaisieArticle) => (id ? modifierArticle(id, s) : creerArticle(societe.id, s)),
    onSuccess: (article) => {
      qc.setQueryData(clesArticles.fiche(article.id), article);
      invalider();
    },
  });
}

export function useChangerActif() {
  const qc = useQueryClient();
  const invalider = useInvaliderCatalogue();
  return useMutation({
    mutationFn: ({ id, actif }: { id: string; actif: boolean }) => changerActif(id, actif),
    onSuccess: (_, { id }) => {
      invalider();
      void qc.invalidateQueries({ queryKey: clesArticles.fiche(id) });
    },
  });
}

export function useSuggestionsArticles(q: string) {
  const societe = useSocieteActive();
  const terme = q.trim();
  return useQuery({
    queryKey: clesArticles.ligne(societe.id, terme),
    queryFn: () => chercherPourLigne(societe.id, terme),
    enabled: terme.length > 0,
  });
}

/** Recherche à la demande d'un code exact (Entrée dans une ligne) : passe par le cache comme le reste. */
export function useTrouverParCode() {
  const societe = useSocieteActive();
  const qc = useQueryClient();
  return (code: string) =>
    qc.fetchQuery({ queryKey: [...clesArticles.racine(societe.id), "code", code.trim()], queryFn: () => articleParCode(societe.id, code) });
}

/** Combien des articles lus sont déjà au catalogue : annoncé avant d'écrire (« 940 à créer, 61 à mettre à jour »). */
export function useCodesExistants(codes: readonly string[]) {
  const societe = useSocieteActive();
  return useQuery({
    queryKey: clesArticles.existants(societe.id, codes),
    queryFn: () => codesExistants(societe.id, codes),
    enabled: codes.length > 0,
  });
}

export function useImporterArticles() {
  const societe = useSocieteActive();
  const invalider = useInvaliderCatalogue();
  return useMutation({
    mutationFn: (articles: readonly ArticleImporte[]) => importerArticles(societe.id, articles),
    onSettled: () => invalider(),
  });
}
