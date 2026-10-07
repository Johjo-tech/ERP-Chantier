import { useEffect, useEffectEvent, useState } from "react";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { useClientsRapprochables } from "@/modules/clients/hooks/useClients";
import { LectureImpossible, type LectureReussie } from "@/modules/ocr/api/extraire";
import { compteRenduLecture, etatAnnule, etatDelaiDepasse, etatEchec, type EtatLecture } from "@/modules/ocr/domain/lecture";
import { versPreRemplissage } from "@/modules/ocr/domain/prefill";
import { rapprocherClient } from "@/modules/ocr/domain/rapprochement";
import { useLectureBon } from "@/modules/ocr/hooks/useLectureBon";
import type { PreRemplissageBon } from "../domain/bon";
import { metiersRetenus } from "../domain/metiers";
import { useMetiersDisponibles } from "./useBons";

/** Ce que la lecture laisse au formulaire : le préremplissage, le document, et ce qu'il reste à vérifier. */
export interface LectureAboutie {
  prefill: PreRemplissageBon;
  fichier: File;
  statut: StatutLecture;
}

/** Le bloc `#ocrStatut` : la phrase, sa couleur, et les clients proposés quand le nom lu n'est pas reconnu. */
export interface StatutLecture {
  texte: string;
  aVerifier: boolean;
  suggestions: { id: string; nom: string }[];
}

/** Les durées des messages de `lireBonCommande` : plus longues quand il y a plus à dire. */
const DUREE_TOAST_LU_MS = 4000;
const DUREE_TOAST_METIERS_MS = 7000;
const DUREE_TOAST_ECHEC_MS = 9000;

/** Le préremplissage d'une lecture, rapprochée du fichier clients PAR IDENTIFIANT (relecture 3, M5). */
function aboutieDe({ extraction, fichier }: LectureReussie, liste: readonly { id: string; nom: string }[]): LectureAboutie {
  const r = rapprocherClient(extraction.client, liste.map((c) => c.nom));
  const clientId = r.reconnu ? (liste.find((c) => c.nom === r.nom)?.id ?? null) : null;
  const suggestions = r.reconnu ? [] : liste.filter((c) => r.suggestions.includes(c.nom)).map((c) => ({ id: c.id, nom: c.nom }));
  return { prefill: versPreRemplissage(extraction, clientId, todayISO()), fichier, statut: { ...compteRenduLecture(extraction.avertissements, r), suggestions } };
}

function issueDe(erreur: unknown, ecoule: number): EtatLecture {
  if (erreur instanceof LectureImpossible && erreur.issue === "annule") return etatAnnule(ecoule);
  if (erreur instanceof LectureImpossible && erreur.issue === "delai") return etatDelaiDepasse(ecoule);
  return etatEchec(messageErreur(erreur));
}

/**
 * La lecture automatique, menée DANS le formulaire du bon comme l'ancien
 * (`lireBonCommande`) : l'écran de lecture le remplace, puis il revient
 * prérempli, avec le document lu en pièce jointe, un compte rendu et un toast.
 * Une lecture qui n'aboutit pas laisse son issue à l'écran.
 */
export function useLectureDuBon() {
  const { lecture, ecoule, etape, annuler, dernier } = useLectureBon();
  const clients = useClientsRapprochables();
  const connus = useMetiersDisponibles();
  const [lue, setLue] = useState<LectureReussie | null>(null);
  const [generation, setGeneration] = useState(0);
  // Annoncée APRÈS le rendu, avec les métiers connus à cet instant : la lecture est souvent lancée dès
  // l'ouverture, avant que la liste des métiers n'arrive.
  const annoncer = useEffectEvent((r: LectureReussie) => {
    const metiers = metiersRetenus([], r.extraction.lignes.map((l) => ({ type: l.type, designation: l.designation, metier: null })), connus).retenus.length;
    afficherToast(
      metiers > 1 ? `Bon lu — ${metiers} métiers sur ses chapitres, donc ${metiers} interventions à planifier. Relisez avant d'enregistrer.` : "Bon de commande lu — relisez avant d'enregistrer.",
      "success",
      metiers > 1 ? DUREE_TOAST_METIERS_MS : DUREE_TOAST_LU_MS
    );
  });
  useEffect(() => {
    if (lue) annoncer(lue);
  }, [lue]);

  function lancer(fichier: File) {
    if (lecture.isPending) return afficherToast("Une lecture est déjà en cours.");
    lecture.mutate(fichier, {
      onSuccess: (r) => {
        setLue(r);
        setGeneration((g) => g + 1);
      },
      onError: (e) => {
        const issue = issueDe(e, ecoule);
        if (issue.ton === "erreur") afficherToast(`${issue.libelle}${issue.alerte ? ` — ${issue.alerte}` : ""}`, "error", DUREE_TOAST_ECHEC_MS);
      },
    });
  }

  /** « Saisir à la main » : le formulaire revient, le document choisi reste joint. */
  function saisirALaMain() {
    lecture.reset();
    setGeneration((g) => g + 1);
  }

  return {
    lancer,
    annuler,
    saisirALaMain,
    enCours: lecture.isPending,
    issue: lecture.isError ? issueDe(lecture.error, ecoule) : null,
    etape,
    ecoule,
    nom: dernier?.name ?? "",
    dernier,
    /** Le formulaire attend les clients : c'est sur eux que se rapproche le nom lu. */
    aboutie: lue && clients.data ? aboutieDe(lue, clients.data) : null,
    enAttenteDesClients: !!lue && !clients.data,
    generation,
  };
}
