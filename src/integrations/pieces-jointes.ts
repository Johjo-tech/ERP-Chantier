/**
 * Le bon de commande tel que le client l'a envoyé : le ranger, et le rouvrir.
 *
 * Le document vit dans le bucket privé `terrain`, sous
 * `<societeId>/bons-commande/<bcId>/…` — ce premier segment n'est pas une
 * convention de rangement mais la clé du cloisonnement : les policies Storage
 * le lisent pour décider qui a le droit de voir quoi.
 */

import { deleteFile, getSignedFileUrl, uploadFile } from "@/api/client";
import { mimeDePieceJointe, nomSurPourStockage } from "@/api/regles-piece-jointe";
import type { Uuid } from "@/api/types";

export interface PieceJointeRangee {
  chemin: string;
  nom: string;
  mime: string;
}

/** Le domaine dans le chemin de stockage — il regroupe les bons entre eux. */
const DOMAINE = "bons-commande";

/**
 * Range le document et rend de quoi le retrouver.
 *
 * Le nom conservé est celui d'origine, celui rangé est assaini : l'utilisateur
 * doit retrouver « Bon n°12 – Résidence Côte d'Azur.pdf », le stockage ne doit
 * pas avoir à porter ses accents.
 *
 * `domaine` dit à quoi le document se rattache — c'est le deuxième segment du
 * chemin, celui qui sépare les bons des dossiers RH. Le premier reste la
 * société : c'est lui, et lui seul, que lisent les policies Storage.
 */
export async function televerserPieceJointe(
  societeId: Uuid,
  domaine: string,
  entiteId: Uuid,
  fichier: File
): Promise<PieceJointeRangee> {
  const nom = fichier.name || "document";
  const pourStockage = new File([fichier], nomSurPourStockage(nom), { type: fichier.type });
  const chemin = await uploadFile(societeId, domaine, entiteId, pourStockage);
  return { chemin, nom, mime: mimeDePieceJointe(fichier.type, nom) };
}

export function televerserPieceJointeBC(
  societeId: Uuid,
  bcId: Uuid,
  fichier: File
): Promise<PieceJointeRangee> {
  return televerserPieceJointe(societeId, DOMAINE, bcId, fichier);
}

/*
 * Une URL signée coûte un aller-retour réseau, et l'écran en redemande une à
 * chaque redessin — la modale de pré-facture se reconstruit à chaque frappe
 * dans un champ de prix. On garde donc la dernière, tant qu'elle vaut.
 */
const enCache = new Map<string, { url: string; expire: number }>();

/** Marge avant l'expiration réelle : une URL qui périme en vol ne sert à rien. */
const MARGE_MS = 60_000;
const DUREE_S = 3600;

export async function urlPieceJointe(chemin: string): Promise<string> {
  const connue = enCache.get(chemin);
  if (connue && connue.expire > Date.now() + MARGE_MS) return connue.url;

  const url = await getSignedFileUrl(chemin, { secondes: DUREE_S });
  enCache.set(chemin, { url, expire: Date.now() + DUREE_S * 1000 });
  return url;
}

/** La même pièce, mais que le navigateur enregistre au lieu de l'afficher. */
export function urlTelechargementPieceJointe(chemin: string): Promise<string> {
  return getSignedFileUrl(chemin, { secondes: DUREE_S, telechargement: true });
}

/**
 * Oublie le document — le fichier **et** l'URL qu'on gardait sous la main.
 *
 * Sans l'oubli du cache, remplacer une pièce par une autre continuerait
 * d'afficher l'ancienne pendant une heure.
 */
export async function supprimerPieceJointe(chemin: string): Promise<void> {
  enCache.delete(chemin);
  await deleteFile(chemin);
}
