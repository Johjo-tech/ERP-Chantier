import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { clesClients } from "@/modules/clients/hooks/useClients";
import { todayISO } from "@/lib/dates";
import { clientsRapprochables, importerClients } from "../api/clients";
import { clientsConnus, creerClientMinimal, importerFactures, numerosDejaPris, supprimerBrouillonsImport, type ResultatImportFactures } from "../api/factures";
import { construireSauvegarde } from "../api/sauvegarde";
import { construireApercuClients, type ApercuImportClients } from "../domain/apercu-clients";
import { construireApercuFactures, type ApercuImportFactures } from "../domain/apercu-factures";
import { analyserExportClients, cleNom, type RapportImportClients } from "../domain/clients";
import { analyserExportFactures, type CategorieTva } from "../domain/factures";
import { nomFichierSauvegarde } from "../domain/sauvegarde";

/** Lit le fichier ET le confronte aux fiches existantes : rien n'est écrit. */
export function useApercuClients() {
  const societe = useSocieteActive();
  return useMutation({
    mutationFn: async ({ octets, nom }: { octets: ArrayBuffer; nom: string }): Promise<{ nom: string; rapport: RapportImportClients; apercu: ApercuImportClients }> => {
      const rapport = analyserExportClients(octets);
      const existants = rapport.clients.length ? await clientsRapprochables(societe.id) : [];
      return { nom, rapport, apercu: construireApercuClients(rapport, existants) };
    },
  });
}

/** Écrit ce que l'aperçu a montré ; les ambigus restent de côté. */
export function useEcrireClients() {
  const societe = useSocieteActive();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (apercu: ApercuImportClients) =>
      importerClients(
        societe.id,
        apercu.lignes.filter((l) => !l.idExistant && !l.ambigu).map((l) => l.valeurs),
        apercu.lignes.filter((l) => l.idExistant).map((l) => ({ id: l.idExistant as string, nom: l.nom, valeurs: l.valeurs }))
      ),
    onSettled: () => void qc.invalidateQueries({ queryKey: clesClients.liste(societe.id) }),
  });
}

export interface FichiersFactures {
  entetes: ArrayBuffer;
  lignes: ArrayBuffer | null;
  categorieTauxZero?: CategorieTva | undefined;
}

export function useApercuFactures() {
  const societe = useSocieteActive();
  return useMutation({
    mutationFn: async ({ entetes, lignes, categorieTauxZero }: FichiersFactures): Promise<ApercuImportFactures> => {
      const rapport = analyserExportFactures(entetes, lignes, { categorieTauxZero });
      if (!rapport.factures.length) return construireApercuFactures(rapport, [], new Set());
      const [existants, pris] = await Promise.all([clientsConnus(societe.id), numerosDejaPris(societe.id, rapport.factures.map((f) => f.numero))]);
      return construireApercuFactures(rapport, existants, pris);
    },
  });
}

/**
 * Les fiches manquantes D'ABORD : l'en-tête d'une facture porte `client_id`,
 * et il est gelé dès que le numéro est posé.
 */
export function useEcrireFactures(onProgress: (faites: number, total: number) => void) {
  const societe = useSocieteActive();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (apercu: ApercuImportFactures): Promise<ResultatImportFactures> => {
      if (!apercu.ecriturePossible) throw new Error("L'aperçu n'autorise pas l'écriture : des pièces ont été écartées.");
      const parCle = new Map<string, string>();
      for (const c of apercu.clientsACreer) parCle.set(cleNom(c.nom), await creerClientMinimal(societe.id, c.nom));
      const pieces = apercu.pieces.map((p, i) => {
        const cle = apercu.clientACreerParPiece[i];
        const id = cle ? parCle.get(cle) : undefined;
        return id ? { ...p, entete: { ...p.entete, client_id: id } } : p;
      });
      return { ...(await importerFactures(societe.id, pieces, onProgress)), clientsCrees: parCle.size };
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["factures", societe.id] });
      void qc.invalidateQueries({ queryKey: clesClients.liste(societe.id) });
    },
  });
}

export function useSupprimerBrouillons() {
  const societe = useSocieteActive();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: readonly string[]) => supprimerBrouillonsImport(ids),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["factures", societe.id] }),
  });
}

/** Fabrique la sauvegarde et la remet comme un fichier à enregistrer. */
export function useSauvegarde(telecharger: (nom: string, contenu: string) => void) {
  const societe = useSocieteActive();
  return useMutation({
    mutationFn: async () => {
      const jour = todayISO();
      telecharger(nomFichierSauvegarde(jour), await construireSauvegarde(societe.id, societe.code, new Date().toISOString()));
    },
  });
}
