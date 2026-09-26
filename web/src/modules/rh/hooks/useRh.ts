import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { messageErreur } from "@/lib/erreurs";
import { usePermission, useSession, useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import { useReglagesSociete } from "@/modules/societes/hooks/useSocieteReglages";
import { SEUILS_DEFAUT } from "@/modules/societes/domain/reglages-societe";
import * as dossier from "../api/dossier";
import * as intervenants from "../api/intervenants";
import * as salaries from "../api/salaries";
import { lienSigne } from "../api/stockage";
import { droitsRh, type SeuilsRh } from "../domain/conformite";
import type { SaisieAbsence } from "../domain/conges";
import { TYPE_HABILITATION, type DocumentRh } from "../domain/documents";
import type { DocumentSousTraitant, PlanConducteur, SaisieEquipe, SaisieSousTraitant } from "../domain/intervenants";
import type { SaisieSalarie } from "../domain/salarie";
import type { SaisieVisite, VisiteMedicale } from "../domain/visites";
import { referentielMetiers } from "@/modules/commandes/domain/metiers";
import { useMetiers } from "@/modules/reglages/hooks/useReglagesEcran";

export const clesRh = {
  tout: (id: string) => ["rh", id] as const,
  salaries: (id: string, sensible: boolean) => ["rh", id, "salaries", sensible] as const,
  documents: (id: string) => ["rh", id, "documents"] as const,
  visites: (id: string) => ["rh", id, "visites"] as const,
  absences: (id: string) => ["rh", id, "absences"] as const,
  equipes: (id: string) => ["rh", id, "equipes"] as const,
  sousTraitants: (id: string) => ["rh", id, "sous-traitants"] as const,
  documentsSousTraitants: (id: string) => ["rh", id, "documents-sous-traitants"] as const,
  fichesConducteur: (id: string) => ["rh", id, "fiches-conducteur"] as const,
};

/**
 * Les métiers proposés par les écrans RH, dans l'ordre de `metiersDisponibles`
 * (app.js l. 18643) : dédoublonnés sans tenir compte de la casse ni des accents,
 * puis triés à la française. Seuls les métiers DÉCLARÉS y entrent (D-ECR-PAR-06).
 */
export function useMetiersRh(): { data: string[]; isPending: boolean } {
  const metiers = useMetiers();
  return { data: referentielMetiers((metiers.data ?? []).map((m) => m.libelle)), isPending: metiers.isPending };
}

export function useDroitsRh() {
  const role = useSession().roleEffectif;
  const voir = usePermission("rh", "voir");
  const creer = usePermission("rh", "creer");
  const modifier = usePermission("rh", "modifier");
  const supprimer = usePermission("rh", "supprimer");
  const accorde = { voir, creer, modifier, supprimer };
  return droitsRh((a) => accorde[a], role);
}

/** Les seuils de Réglages › RH ; tant qu'ils ne sont pas lus, les défauts de l'ancienne app. */
export function useSeuilsRh(): SeuilsRh {
  const r = useReglagesSociete();
  const s = r.data?.seuils ?? SEUILS_DEFAUT;
  return { documentLegal: s.documentLegal, visiteMedicale: s.visiteMedicale, carteBtp: s.carteBtp, habilitation: s.habilitation };
}

export function useSalariesRh() {
  const s = useSocieteActive();
  const { sensible } = useDroitsRh();
  return useQuery({ queryKey: clesRh.salaries(s.id, sensible), queryFn: () => salaries.listerSalaries(s.id, sensible) });
}

/** Dossiers, visites, absences : lisibles avec `rh / modifier` seulement — pas de requête vouée au refus. */
export function useDocumentsRh() {
  const s = useSocieteActive();
  const { sensible } = useDroitsRh();
  return useQuery({ queryKey: clesRh.documents(s.id), queryFn: () => dossier.listerDocuments(s.id), enabled: sensible });
}

export function useVisitesRh() {
  const s = useSocieteActive();
  const { sensible } = useDroitsRh();
  return useQuery({ queryKey: clesRh.visites(s.id), queryFn: () => dossier.listerVisites(s.id), enabled: sensible });
}

export function useAbsencesRh() {
  const s = useSocieteActive();
  const { sensible } = useDroitsRh();
  return useQuery({ queryKey: clesRh.absences(s.id), queryFn: () => dossier.listerAbsences(s.id), enabled: sensible });
}

export function useEquipes() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesRh.equipes(s.id), queryFn: () => intervenants.listerEquipes(s.id) });
}

export function useSousTraitants() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesRh.sousTraitants(s.id), queryFn: () => intervenants.listerSousTraitants(s.id) });
}

export function useDocumentsSousTraitants() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesRh.documentsSousTraitants(s.id), queryFn: () => intervenants.listerDocumentsSousTraitants(s.id) });
}

export function useFichesConducteurLiees() {
  const s = useSocieteActive();
  return useQuery({ queryKey: clesRh.fichesConducteur(s.id), queryFn: () => intervenants.listerFichesConducteurLiees(s.id) });
}

/**
 * Après une écriture RH, tout ce qui lit les mêmes lignes se relit : l'écran
 * RH, les sélecteurs de conducteur (devis, bons, factures), Réglages ›
 * Intervenants et Comptes, et le planning (équipes, sous-traitants).
 */
function useRelire() {
  const s = useSocieteActive();
  const qc = useQueryClient();
  return () => {
    for (const cle of [clesRh.tout(s.id), ["conducteurs", s.id], ["fiches-conducteurs", s.id], ["salaries-comptes", s.id], ["conducteurs-suivis", s.id], ["planning"]]) {
      void qc.invalidateQueries({ queryKey: cle });
    }
  };
}

/** Une habilitation ou une visite choisie avant que la fiche n'existe : elle part avec la fiche. */
export interface HabilitationEnAttente {
  cle: string;
  nom: string;
  dateExpiration: string;
  fichier: File | null;
}
export interface VisiteEnAttente {
  cle: string;
  saisie: SaisieVisite;
  fichier: File | null;
}

export interface IssueFiche {
  id: string;
  /** Ce qui n'a pas pu suivre la fiche, rédigé : la fiche, elle, est enregistrée. */
  avertissements: string[];
  habilitationsRestantes: HabilitationEnAttente[];
  visitesRestantes: VisiteEnAttente[];
}

/**
 * Enregistre la fiche PUIS ce qui en dépend — fiche conducteur, habilitations
 * et visites en attente — une pièce à la fois, sans interrompre les suivantes :
 * perdre quatre pièces parce que la troisième est trop lourde serait pire que
 * de signaler celle-là. Ce qui échoue est rendu pour rester à l'écran.
 */
export function useEnregistrerFiche() {
  const s = useSocieteActive();
  const relire = useRelire();
  return useMutation({
    mutationFn: async (v: { id: string | null; saisie: SaisieSalarie; plan: (id: string) => PlanConducteur; habilitations: HabilitationEnAttente[]; visites: VisiteEnAttente[] }): Promise<IssueFiche> => {
      const id = v.id ?? (await salaries.creerSalarie(s.id, v.saisie));
      if (v.id) await salaries.modifierSalarie(v.id, v.saisie);
      const avertissements: string[] = [];
      try {
        await intervenants.appliquerPlanConducteur(s.id, v.plan(id));
      } catch (e) {
        console.error("Fiche conducteur non enregistrée", e);
        avertissements.push(`Salarié enregistré, mais sa fiche de conducteur n'a pas pu l'être : ${messageErreur(e)}`);
      }
      const habilitationsRestantes: HabilitationEnAttente[] = [];
      for (const h of v.habilitations) {
        if (!h.fichier && !h.nom.trim()) continue;
        try {
          await dossier.ajouterDocument(
            s.id,
            id,
            { type: TYPE_HABILITATION, nom: h.nom.trim() || h.fichier?.name || "Habilitation", organisme: null, numeroDocument: null, dateDocument: null, dateExpiration: h.dateExpiration || null, notes: null },
            h.fichier
          );
        } catch (e) {
          console.error("Habilitation non déposée", h.nom, e);
          avertissements.push(`« ${h.nom || h.fichier?.name} » n'a pas pu être déposée — ${messageErreur(e)}`);
          habilitationsRestantes.push(h);
        }
      }
      const visitesRestantes: VisiteEnAttente[] = [];
      for (const vis of v.visites) {
        try {
          await dossier.ajouterVisite(s.id, id, vis.saisie, vis.fichier);
        } catch (e) {
          console.error("Visite non déposée", vis.saisie.dateVisite, e);
          avertissements.push(`La visite du ${vis.saisie.dateVisite} n'a pas pu être enregistrée — ${messageErreur(e)}`);
          visitesRestantes.push(vis);
        }
      }
      return { id, avertissements, habilitationsRestantes, visitesRestantes };
    },
    onSettled: relire,
  });
}

export function useGererSalaries() {
  const relire = useRelire();
  return {
    supprimer: useMutation({ mutationFn: (id: string) => salaries.supprimerSalarie(id), onSettled: relire }),
    equipe: useMutation({ mutationFn: (v: { salarieId: string; equipeId: string | null }) => salaries.definirEquipe(v.salarieId, v.equipeId), onSettled: relire }),
  };
}

export function useGererDossier() {
  const s = useSocieteActive();
  const relire = useRelire();
  return {
    ajouterDocument: useMutation({ mutationFn: (v: { salarieId: string; saisie: dossier.SaisieDocument; fichier: File | null }) => dossier.ajouterDocument(s.id, v.salarieId, v.saisie, v.fichier), onSettled: relire }),
    modifierDocument: useMutation({ mutationFn: (v: { doc: DocumentRh; saisie: dossier.SaisieDocument; fichier: File | null }) => dossier.modifierDocument(s.id, v.doc, v.saisie, v.fichier), onSettled: relire }),
    supprimerDocument: useMutation({ mutationFn: (d: DocumentRh) => dossier.supprimerDocument(d), onSettled: relire }),
    ajouterVisite: useMutation({ mutationFn: (v: { salarieId: string; saisie: SaisieVisite; fichier: File | null }) => dossier.ajouterVisite(s.id, v.salarieId, v.saisie, v.fichier), onSettled: relire }),
    modifierVisite: useMutation({ mutationFn: (v: { visite: VisiteMedicale; saisie: SaisieVisite; fichier: File | null }) => dossier.modifierVisite(s.id, v.visite, v.saisie, v.fichier), onSettled: relire }),
    supprimerVisite: useMutation({ mutationFn: (v: VisiteMedicale) => dossier.supprimerVisite(v), onSettled: relire }),
    ajouterAbsence: useMutation({
      mutationFn: (v: { salarieId: string; saisie: SaisieAbsence; nbJours: number; aujourdHui: string; fichier: File | null }) => dossier.ajouterAbsence(s.id, v.salarieId, v.saisie, v.nbJours, v.aujourdHui, v.fichier),
      onSettled: relire,
    }),
    supprimerAbsence: useMutation({ mutationFn: (a: { id: string; justificatifChemin: string | null }) => dossier.supprimerAbsence(a), onSettled: relire }),
  };
}

export function useGererIntervenants() {
  const s = useSocieteActive();
  const relire = useRelire();
  return {
    equipe: useMutation({ mutationFn: (v: { id: string | null; saisie: SaisieEquipe }) => intervenants.enregistrerEquipe(s.id, v.id, v.saisie), onSettled: relire }),
    supprimerEquipe: useMutation({ mutationFn: (id: string) => intervenants.supprimerEquipe(id), onSettled: relire }),
    sousTraitant: useMutation({ mutationFn: (v: { id: string | null; saisie: SaisieSousTraitant }) => intervenants.enregistrerSousTraitant(s.id, v.id, v.saisie), onSettled: relire }),
    supprimerSousTraitant: useMutation({ mutationFn: (v: { id: string; documents: DocumentSousTraitant[] }) => intervenants.supprimerSousTraitant(v.id, v.documents), onSettled: relire }),
    ajouterDocument: useMutation({
      mutationFn: (v: { sousTraitantId: string; type: string; dateValidite: string | null; fichier: File | null }) => intervenants.ajouterDocumentSousTraitant(s.id, v.sousTraitantId, v.type, v.dateValidite, v.fichier),
      onSettled: relire,
    }),
    supprimerDocument: useMutation({ mutationFn: (d: DocumentSousTraitant) => intervenants.supprimerDocumentSousTraitant(d), onSettled: relire }),
  };
}

/** Un lien signé demandé au moment d'ouvrir : il expire, on ne le garde pas en cache. */
export function useLienPiece() {
  return useMutation({ mutationFn: (chemin: string) => lienSigne(chemin) });
}
