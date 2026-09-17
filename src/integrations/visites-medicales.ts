/**
 * Le registre des visites médicales d'un salarié : lire, ajouter, retirer.
 *
 * Les lignes vivent dans `salarie_visites_medicales`, les attestations dans le
 * bucket privé `terrain` sous `<societeId>/salaries/<salarieId>/…` — le même
 * domaine que le dossier documentaire, donc les mêmes policies Storage, déjà
 * éprouvées.
 *
 * Comme le dossier documentaire, ce registre ne passe **pas** par le pont
 * kv_store : `salarie` y est déclaré sans table fille, si bien qu'un tableau
 * posé sur la fiche est filtré par `colonnesDe()` avant l'envoi.
 *
 * Ce qu'on n'écrit jamais d'ici : `salaries.visite_medicale_date` et
 * `visite_medicale_prochaine`. Un déclencheur les tient d'après la visite la
 * plus récente, et les réécrit à chaque enregistrement de la fiche.
 */

import { mimeDePieceJointe } from "@/api/regles-piece-jointe";
import type { VisiteMedicale } from "@/api/regles-visite-medicale";
import * as rh from "@/api/queries/rh";
import type { SalarieVisiteMedicale, Uuid } from "@/api/types";
import {
  supprimerPieceJointe,
  televerserPieceJointe,
  urlPieceJointe,
  urlTelechargementPieceJointe,
} from "./pieces-jointes";

/** Le domaine dans le chemin de stockage — partagé avec le dossier RH. */
const DOMAINE = "salaries";

/** Ce que l'écran renseigne sur une visite. Le reste est dérivé. */
export interface SaisieVisiteMedicale {
  dateVisite: string;
  type: string;
  suivi: string;
  organisme?: string | null;
  medecin?: string | null;
  avis?: string | null;
  reserves?: string | null;
  prochaineVisite?: string | null;
  notes?: string | null;
}

/** Postgres refuse la chaîne vide sur une date ou un `check` : c'est `null`. */
function ouNull(valeur?: string | null): string | null {
  const propre = (valeur ?? "").trim();
  return propre === "" ? null : propre;
}

function versEcran(ligne: SalarieVisiteMedicale): VisiteMedicale {
  return {
    id: ligne.id,
    salarieId: ligne.salarie_id,
    dateVisite: ligne.date_visite,
    type: ligne.type,
    suivi: ligne.suivi,
    organisme: ligne.organisme,
    medecin: ligne.medecin,
    avis: ligne.avis,
    reserves: ligne.reserves,
    prochaineVisite: ligne.prochaine_visite,
    fichierChemin: ligne.fichier_chemin,
    fichierNom: ligne.fichier_nom,
    notes: ligne.notes,
    creeLe: ligne.cree_le,
  };
}

function versBase(saisie: SaisieVisiteMedicale) {
  return {
    date_visite: saisie.dateVisite,
    type: (saisie.type || "periodique").trim(),
    suivi: (saisie.suivi || "simple").trim(),
    organisme: ouNull(saisie.organisme),
    medecin: ouNull(saisie.medecin),
    avis: ouNull(saisie.avis),
    reserves: ouNull(saisie.reserves),
    prochaine_visite: ouNull(saisie.prochaineVisite),
    notes: ouNull(saisie.notes),
  };
}

/** Tous les registres d'un coup : deux requêtes pour trente fiches, pas trente. */
export async function chargerVisitesMedicales(
  salarieIds: Uuid[]
): Promise<VisiteMedicale[]> {
  const ids = salarieIds.filter(Boolean);
  if (!ids.length) return [];
  const groupes = await rh.listVisitesMedicalesSalaries(ids);
  const toutes: VisiteMedicale[] = [];
  for (const lignes of groupes.values()) for (const l of lignes) toutes.push(versEcran(l));
  return toutes;
}

/**
 * Enregistre une visite, attestation comprise.
 *
 * Le fichier part d'abord, la ligne ensuite : si l'insertion est refusée — la
 * RLS demande `rh`/`modifier` —, on retire le fichier qu'on vient de poser,
 * sinon le bucket garde un orphelin que plus rien ne désigne.
 *
 * L'attestation est facultative : une visite se note le jour même, le document
 * du médecin n'arrivant souvent que la semaine suivante.
 */
export async function ajouterVisiteMedicale(
  salarieId: Uuid,
  saisie: SaisieVisiteMedicale,
  fichier?: File | null
): Promise<VisiteMedicale> {
  let chemin: string | null = null;
  let nomFichier: string | null = null;

  if (fichier) {
    const salarie = await rh.getSalarie(salarieId);
    if (!salarie) throw new Error("Salarié introuvable — visite non enregistrée.");
    const range = await televerserPieceJointe(
      salarie.societe_id,
      DOMAINE,
      salarieId,
      fichier
    );
    chemin = range.chemin;
    nomFichier = range.nom;
  }

  try {
    const ligne = await rh.addVisiteMedicale({
      salarie_id: salarieId,
      ...versBase(saisie),
      fichier_chemin: chemin,
      fichier_nom: nomFichier,
    });
    return versEcran(ligne);
  } catch (erreur) {
    if (chemin) {
      await supprimerPieceJointe(chemin).catch((e) =>
        console.error("Attestation orpheline, suppression impossible", chemin, e)
      );
    }
    throw erreur;
  }
}

/**
 * Corrige une visite, attestation comprise.
 *
 * L'ancien fichier n'est retiré qu'une fois la ligne écrite : l'inverse
 * laisserait, si l'écriture est refusée, une visite qui désigne une
 * attestation effacée.
 */
export async function majVisiteMedicale(
  id: Uuid,
  saisie: SaisieVisiteMedicale,
  fichier?: File | null
): Promise<VisiteMedicale> {
  if (!fichier) {
    return versEcran(await rh.updateVisiteMedicale(id, versBase(saisie)));
  }

  const actuelle = await rh.getVisiteMedicale(id);
  if (!actuelle) throw new Error("Visite introuvable — rien n'a été modifié.");
  const salarie = await rh.getSalarie(actuelle.salarie_id);
  if (!salarie) throw new Error("Salarié introuvable — rien n'a été modifié.");

  const range = await televerserPieceJointe(
    salarie.societe_id,
    DOMAINE,
    actuelle.salarie_id,
    fichier
  );

  let ligne: SalarieVisiteMedicale;
  try {
    ligne = await rh.updateVisiteMedicale(id, {
      ...versBase(saisie),
      fichier_chemin: range.chemin,
      fichier_nom: range.nom,
    });
  } catch (erreur) {
    await supprimerPieceJointe(range.chemin).catch((e) =>
      console.error("Attestation orpheline, suppression impossible", range.chemin, e)
    );
    throw erreur;
  }

  if (actuelle.fichier_chemin && actuelle.fichier_chemin !== range.chemin) {
    await supprimerPieceJointe(actuelle.fichier_chemin).catch((e) =>
      console.error("Ancienne attestation non supprimée", actuelle.fichier_chemin, e)
    );
  }
  return versEcran(ligne);
}

/** Retire la visite : la ligne, puis l'attestation. */
export async function supprimerVisiteMedicale(v: VisiteMedicale): Promise<void> {
  await rh.deleteVisiteMedicale(v.id);
  if (v.fichierChemin) await supprimerPieceJointe(v.fichierChemin);
}

/**
 * Vide le registre d'un salarié qu'on s'apprête à supprimer.
 *
 * La clé étrangère est `on delete cascade` : les lignes partent seules, les
 * attestations non. Ce sont des données de santé — les laisser dans le bucket
 * après le départ de la personne serait le pire des oublis.
 */
export async function purgerVisitesMedicales(salarieId: Uuid): Promise<void> {
  const visites = await chargerVisitesMedicales([salarieId]);
  await Promise.all(
    visites
      .map((v) => v.fichierChemin)
      .filter((c): c is string => !!c)
      .map((c) =>
        supprimerPieceJointe(c).catch((e) =>
          console.error("Attestation non supprimée", c, e)
        )
      )
  );
}

/** De quoi ouvrir l'attestation : un bucket privé ne rend pas d'URL déductible. */
export async function ouvrirAttestationVisite(v: VisiteMedicale): Promise<{
  url: string;
  urlTelechargement: string;
  mime: string;
  nom: string;
} | null> {
  if (!v.fichierChemin) return null;
  const [url, urlTelechargement] = await Promise.all([
    urlPieceJointe(v.fichierChemin),
    urlTelechargementPieceJointe(v.fichierChemin),
  ]);
  const nom = v.fichierNom || "attestation";
  /* La table ne garde pas le type MIME : il se retrouve par l'extension, ce
     qui suffit aux quatre formats acceptés. */
  return { url, urlTelechargement, mime: mimeDePieceJointe(null, nom), nom };
}
