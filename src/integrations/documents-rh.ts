/**
 * Le dossier documentaire d'un salarié : lire, déposer, retirer.
 *
 * Les lignes vivent dans `salarie_documents`, les fichiers dans le bucket privé
 * `terrain` sous `<societeId>/salaries/<salarieId>/…` — ce premier segment
 * n'est pas un rangement mais la clé du cloisonnement, les policies Storage le
 * lisent pour décider qui voit quoi.
 *
 * Ce dossier ne passe **pas** par le pont kv_store comme le reste de l'écran :
 * `salarie` y est déclaré sans table fille, si bien qu'un tableau posé sur la
 * fiche est filtré par `colonnesDe()` et disparaît au rechargement suivant.
 * C'est exactement ce qui arrivait aux contrats et avenants déposés jusqu'ici :
 * l'écran les affichait, la base ne les avait jamais reçus.
 */

import { mimeDePieceJointe } from "@/api/regles-piece-jointe";
import type { DocumentRh } from "@/api/regles-documents-rh";
import * as rh from "@/api/queries/rh";
import type { SalarieDocument, Uuid } from "@/api/types";
import {
  supprimerPieceJointe,
  televerserPieceJointe,
  urlPieceJointe,
  urlTelechargementPieceJointe,
} from "./pieces-jointes";

/** Le domaine dans le chemin de stockage — il regroupe les dossiers RH. */
const DOMAINE = "salaries";

/** Ce que l'écran peut renseigner sur un document. Le reste est dérivé. */
export interface SaisieDocumentRh {
  type: string;
  nom?: string | null;
  organisme?: string | null;
  numeroDocument?: string | null;
  dateDocument?: string | null;
  dateExpiration?: string | null;
  notes?: string | null;
}

/** Postgres refuse la chaîne vide sur une date : « non renseigné » vaut `null`. */
function ouNull(valeur?: string | null): string | null {
  const propre = (valeur ?? "").trim();
  return propre === "" ? null : propre;
}

function versEcran(ligne: SalarieDocument): DocumentRh {
  return {
    id: ligne.id,
    salarieId: ligne.salarie_id,
    type: ligne.type,
    nom: ligne.nom,
    organisme: ligne.organisme,
    numeroDocument: ligne.numero_document,
    dateDocument: ligne.date_document,
    dateExpiration: ligne.date_expiration,
    notes: ligne.notes,
    fichierChemin: ligne.fichier_chemin,
    fichierNom: ligne.fichier_nom,
  };
}

function versBase(saisie: SaisieDocumentRh) {
  return {
    type: (saisie.type || "autre").trim(),
    nom: ouNull(saisie.nom),
    organisme: ouNull(saisie.organisme),
    numero_document: ouNull(saisie.numeroDocument),
    date_document: ouNull(saisie.dateDocument),
    date_expiration: ouNull(saisie.dateExpiration),
    notes: ouNull(saisie.notes),
  };
}

/** Tous les dossiers d'un coup : deux requêtes pour trente salariés, pas trente. */
export async function chargerDocumentsRh(salarieIds: Uuid[]): Promise<DocumentRh[]> {
  const ids = salarieIds.filter(Boolean);
  if (!ids.length) return [];
  const groupes = await rh.listDocumentsSalaries(ids);
  const tous: DocumentRh[] = [];
  for (const lignes of groupes.values()) for (const l of lignes) tous.push(versEcran(l));
  return tous;
}

/**
 * Dépose un document au dossier.
 *
 * Le fichier part d'abord, la ligne ensuite : si l'insertion est refusée — la
 * RLS demande `rh`/`modifier` — on retire le fichier qu'on vient de poser,
 * sinon le bucket garde un orphelin que plus rien ne désigne.
 *
 * Le fichier est facultatif : une visite médicale peut se noter le jour même,
 * l'attestation n'arrivant que la semaine suivante.
 *
 * La société se relit sur la fiche du salarié plutôt que de venir de l'écran :
 * l'écran historique ne connaît la sienne que par son **code** (« kta »), et
 * c'est l'uuid qui ouvre le premier segment du chemin de stockage.
 */
export async function ajouterDocumentRh(
  salarieId: Uuid,
  saisie: SaisieDocumentRh,
  fichier?: File | null
): Promise<DocumentRh> {
  let chemin: string | null = null;
  let nomFichier: string | null = null;

  if (fichier) {
    const salarie = await rh.getSalarie(salarieId);
    if (!salarie) throw new Error("Salarié introuvable — dossier non enregistré.");
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
    const ligne = await rh.addDocumentSalarie({
      salarie_id: salarieId,
      ...versBase(saisie),
      fichier_chemin: chemin,
      fichier_nom: nomFichier,
    });
    return versEcran(ligne);
  } catch (erreur) {
    if (chemin) {
      await supprimerPieceJointe(chemin).catch((e) =>
        console.error("Fichier RH orphelin, suppression impossible", chemin, e)
      );
    }
    throw erreur;
  }
}

/**
 * Corrige un document déjà au dossier, fichier compris.
 *
 * L'ancien fichier n'est retiré qu'une fois la ligne écrite : l'inverse
 * laisserait, si l'écriture est refusée, une ligne qui désigne un fichier
 * effacé — un document au dossier qu'on ne peut plus ouvrir.
 */
export async function majDocumentRh(
  id: Uuid,
  saisie: SaisieDocumentRh,
  fichier?: File | null
): Promise<DocumentRh> {
  if (!fichier) {
    return versEcran(await rh.updateDocumentSalarie(id, versBase(saisie)));
  }

  const actuel = await rh.getDocumentSalarie(id);
  if (!actuel) throw new Error("Document introuvable — rien n'a été modifié.");
  const salarie = await rh.getSalarie(actuel.salarie_id);
  if (!salarie) throw new Error("Salarié introuvable — rien n'a été modifié.");

  const range = await televerserPieceJointe(
    salarie.societe_id,
    DOMAINE,
    actuel.salarie_id,
    fichier
  );

  let ligne: SalarieDocument;
  try {
    ligne = await rh.updateDocumentSalarie(id, {
      ...versBase(saisie),
      fichier_chemin: range.chemin,
      fichier_nom: range.nom,
    });
  } catch (erreur) {
    await supprimerPieceJointe(range.chemin).catch((e) =>
      console.error("Fichier RH orphelin, suppression impossible", range.chemin, e)
    );
    throw erreur;
  }

  if (actuel.fichier_chemin && actuel.fichier_chemin !== range.chemin) {
    await supprimerPieceJointe(actuel.fichier_chemin).catch((e) =>
      console.error("Ancien fichier RH non supprimé", actuel.fichier_chemin, e)
    );
  }
  return versEcran(ligne);
}

/**
 * Retire le document : la ligne, puis le fichier.
 *
 * Dans cet ordre, car l'inverse laisserait une ligne qui désigne un fichier
 * disparu — l'écran proposerait de l'ouvrir et n'y arriverait jamais.
 */
export async function supprimerDocumentRh(doc: DocumentRh): Promise<void> {
  await rh.deleteDocumentSalarie(doc.id);
  if (doc.fichierChemin) await supprimerPieceJointe(doc.fichierChemin);
}

/**
 * Vide le dossier d'un salarié qu'on s'apprête à supprimer.
 *
 * La clé étrangère est `on delete cascade` : les lignes partent seules, les
 * fichiers non. Sans ce passage, le bucket accumulerait les contrats de gens
 * qui ne sont plus dans la base — précisément ce qu'on ne doit pas garder.
 */
export async function purgerDocumentsRh(salarieId: Uuid): Promise<void> {
  const documents = await chargerDocumentsRh([salarieId]);
  await Promise.all(
    documents
      .map((d) => d.fichierChemin)
      .filter((c): c is string => !!c)
      .map((c) =>
        supprimerPieceJointe(c).catch((e) =>
          console.error("Fichier RH non supprimé", c, e)
        )
      )
  );
}

/** De quoi ouvrir le document : un bucket privé ne rend pas d'URL déductible. */
export async function ouvrirDocumentRh(doc: DocumentRh): Promise<{
  url: string;
  urlTelechargement: string;
  mime: string;
  nom: string;
} | null> {
  if (!doc.fichierChemin) return null;
  const [url, urlTelechargement] = await Promise.all([
    urlPieceJointe(doc.fichierChemin),
    urlTelechargementPieceJointe(doc.fichierChemin),
  ]);
  const nom = doc.fichierNom || "document";
  /* La table ne garde pas le type MIME : il se retrouve par l'extension, ce qui
     suffit aux quatre formats acceptés (PDF, JPEG, PNG, WebP). */
  return { url, urlTelechargement, mime: mimeDePieceJointe(null, nom), nom };
}
