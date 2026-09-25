import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { chargerReglagesSociete, enregistrerReglagesSociete, lireInfosEntreprise } from "../api/reglages";
import { lienFichier, lireSociete, modifierSociete, remplacerLogo, retirerLogo } from "../api/societe";
import type { ReglagesSociete } from "../domain/reglages-societe";
import type { SaisieSociete } from "../domain/societe";
import { cheminLogo } from "../domain/logo";

export const clesSociete = {
  fiche: (id: string) => ["societe", id] as const,
  reglages: (id: string) => ["reglages-societe", id] as const,
  infos: (id: string) => ["infos-entreprise", id] as const,
  logo: (id: string, chemin: string | null) => ["logo", id, chemin] as const,
};

/**
 * Après une écriture, TOUT ce qui lit la société se relit : l'identité imprimée
 * sur les documents (`identite`), les réglages de documents (`reglages`) des
 * autres modules, et les vues de cet écran.
 */
function invaliderSociete(qc: QueryClient, id: string) {
  for (const cle of [clesSociete.fiche(id), clesSociete.reglages(id), clesSociete.infos(id), ["identite", id], ["reglages", id], ["logo", id]]) {
    void qc.invalidateQueries({ queryKey: cle });
  }
}

export function useSociete() {
  const societe = useSocieteActive();
  return useQuery({ queryKey: clesSociete.fiche(societe.id), queryFn: () => lireSociete(societe.id) });
}

export function useModifierSociete() {
  const societe = useSocieteActive();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: SaisieSociete) => modifierSociete(societe.id, s),
    onSuccess: (fiche) => {
      qc.setQueryData(clesSociete.fiche(societe.id), fiche);
      invaliderSociete(qc, societe.id);
    },
  });
}

export function useReglagesSociete() {
  const societe = useSocieteActive();
  return useQuery({ queryKey: clesSociete.reglages(societe.id), queryFn: () => chargerReglagesSociete(societe.id) });
}

export function useInfosEntreprise() {
  const societe = useSocieteActive();
  return useQuery({ queryKey: clesSociete.infos(societe.id), queryFn: () => lireInfosEntreprise(societe.id) });
}

export function useEnregistrerReglages() {
  const societe = useSocieteActive();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (modifier: (r: ReglagesSociete) => ReglagesSociete) => enregistrerReglagesSociete(societe.id, modifier),
    onSuccess: (relus) => {
      qc.setQueryData(clesSociete.reglages(societe.id), relus);
      invaliderSociete(qc, societe.id);
    },
  });
}

/** Le lien (temporaire) du logo rangé dans le bucket ; `null` sans logo. */
export function useLienLogo(chemin: string | null) {
  const societe = useSocieteActive();
  return useQuery({
    queryKey: clesSociete.logo(societe.id, chemin),
    queryFn: () => (chemin ? lienFichier(chemin) : Promise.resolve(null)),
    // Le lien signé vit une heure : on le renouvelle bien avant.
    staleTime: 30 * 60_000,
  });
}

/** Un lien de lecture temporaire vers une pièce du bucket (documents légaux…). */
export function useLienFichier(chemin: string | null) {
  return useQuery({
    queryKey: ["lien-fichier", chemin],
    queryFn: () => lienFichier(chemin as string),
    enabled: chemin !== null,
    staleTime: 30 * 60_000,
  });
}

export function useChangerLogo() {
  const societe = useSocieteActive();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fichier, ancien }: { fichier: File | null; ancien: string | null }) =>
      fichier ? remplacerLogo(societe.id, fichier, cheminLogo(societe.id, fichier.name, Date.now()), ancien) : retirerLogo(societe.id, ancien),
    onSuccess: () => invaliderSociete(qc, societe.id),
  });
}
