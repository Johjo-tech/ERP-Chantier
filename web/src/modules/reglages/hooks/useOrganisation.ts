import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { enregistrerReglagesSociete } from "@/modules/societes/api/reglages";
import { modifierSociete } from "@/modules/societes/api/societe";
import type { SaisieSociete } from "@/modules/societes/domain/societe";
import { clesSociete } from "@/modules/societes/hooks/useSocieteReglages";
import { enregistrerGerant, type Gerant } from "../api/gerant";

export interface SaisieOrganisation {
  societe: SaisieSociete;
  gerant: Gerant;
  siteWeb: string;
}

/**
 * « Enregistrer » de l'onglet Organisation (`saveInfosEntreprise`, app.js
 * l. 13099) : un seul geste, trois rangements — les colonnes de `societes`, le
 * gérant dans `infos_entreprise`, le site web dans les réglages de documents
 * (il ne sert qu'au pied des documents). Chacun écrit par fusion ; tout ce qui
 * lit la société se relit ensuite.
 */
export function useEnregistrerOrganisation() {
  const societe = useSocieteActive();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: SaisieOrganisation) => {
      await modifierSociete(societe.id, s.societe);
      await enregistrerGerant(societe.id, s.gerant);
      await enregistrerReglagesSociete(societe.id, (r) => ({ ...r, documents: { ...r.documents, siteWeb: s.siteWeb.trim() } }));
    },
    onSettled: () => {
      for (const cle of [clesSociete.fiche(societe.id), clesSociete.reglages(societe.id), clesSociete.infos(societe.id), ["identite", societe.id], ["reglages", societe.id]]) {
        void qc.invalidateQueries({ queryKey: cle });
      }
    },
  });
}
