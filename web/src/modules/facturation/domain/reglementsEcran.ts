import { montant, somme, type Montant } from "@/lib/money";
import { correspond } from "@/lib/recherche";
import { estAvoir } from "@/modules/documents/domain/totaux";
import { joursDepuisEcheance, reglementEnRetard, type EtatCarte } from "./carte";

/**
 * L'onglet Règlements de l'ancien écran (`renderReglements`,
 * `listeDossiersReglementsHTML`, `facturesParEtatReglement` — app.js
 * l. 10699) : les mêmes regroupements, les mêmes tris, les mêmes filtres.
 */
export interface PieceReglement {
  f: { id: string; numero: string | null; client_nom: string; date: string; echeance: string | null; type_document: string };
  etat: EtatCarte;
  ttc: Montant;
}

export type EtatReglement = "" | "non_reglee" | "partiellement_reglee" | "reglee" | "en_retard";
export const ETATS_REGLEMENT: readonly [EtatReglement, string][] = [
  ["", "Tous les états"],
  ["non_reglee", "Non réglées"],
  ["partiellement_reglee", "Partiellement réglées"],
  ["reglee", "Réglées"],
  ["en_retard", "En retard"],
];

export type TriReglement = "retard" | "reste" | "echeance" | "client";
export const TRIS_REGLEMENT: readonly [TriReglement, string][] = [
  ["retard", "Les plus en retard d'abord"],
  ["reste", "Reste dû décroissant"],
  ["echeance", "Échéance la plus proche"],
  ["client", "Client (A → Z)"],
];

const UN_CENTIME = montant("0.01");

/** `factureRepondALEtat` : un avoir ne répond à aucun état — il s'impute, il ne se règle pas. */
export function repondALEtat(p: PieceReglement, etat: EtatReglement, aujourdhui: string): boolean {
  if (!etat) return true;
  if (estAvoir(p.f.type_document)) return false;
  const jours = joursDepuisEcheance(p.f, aujourdhui) ?? 0;
  return etat === "en_retard" ? reglementEnRetard(p.etat, jours) : p.etat.cle === etat;
}

/** Tri par défaut de `Array.prototype.sort` : l'ancien rangeait les clients ainsi, capitales d'abord. */
const ordreBrut = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export interface DossierReglement<P extends PieceReglement> {
  nom: string;
  factures: P[];
  totalDu: Montant;
  enRetard: boolean;
}

/**
 * Les dossiers « Par client » : le client disparaît s'il n'a plus de pièce
 * dans l'état demandé, et son total sort de la MÊME liste que celle qu'on
 * montre. Le reste d'un avoir est un crédit : il ne s'ajoute pas au dû.
 */
export function dossiersParClient<P extends PieceReglement>(pieces: readonly P[], etat: EtatReglement, aujourdhui: string): DossierReglement<P>[] {
  const groupes = new Map<string, P[]>();
  for (const p of pieces.filter((x) => repondALEtat(x, etat, aujourdhui))) groupes.set(p.f.client_nom, [...(groupes.get(p.f.client_nom) ?? []), p]);
  return [...groupes.keys()].sort(ordreBrut).map((nom) => {
    const factures = groupes.get(nom) ?? [];
    const dues = factures.filter((p) => !p.etat.avoir);
    return {
      nom,
      factures,
      totalDu: somme(dues.map((p) => p.etat.reste)),
      enRetard: dues.some((p) => p.etat.reste.gt(UN_CENTIME) && (joursDepuisEcheance(p.f, aujourdhui) ?? 0) > 0),
    };
  });
}

export interface CriteresParFacture {
  etat: EtatReglement;
  tri: TriReglement;
  client: string;
  du: string;
  au: string;
}
export const CRITERES_PAR_FACTURE_VIDES: CriteresParFacture = { etat: "", tri: "retard", client: "", du: "", au: "" };

/**
 * « Par facture » : les factures — jamais les avoirs —, filtrées par
 * l'ÉCHÉANCE (la date du document à défaut), puis triées. Le tri de
 * l'ancien est stable : à égalité, l'ordre de la liste des factures demeure.
 */
export function facturesParEtat<P extends PieceReglement>(pieces: readonly P[], c: CriteresParFacture, aujourdhui: string): { p: P; jours: number; enRetard: boolean }[] {
  const terme = (p: P) => p.f.echeance || p.f.date || "";
  const lignes = pieces
    .filter((p) => !estAvoir(p.f.type_document))
    .filter((p) => !c.client || p.f.client_nom === c.client)
    .filter((p) => !c.du || terme(p) >= c.du)
    .filter((p) => !c.au || terme(p) <= c.au)
    .filter((p) => repondALEtat(p, c.etat, aujourdhui))
    .map((p) => {
      const jours = joursDepuisEcheance(p.f, aujourdhui) ?? 0;
      return { p, jours, enRetard: reglementEnRetard(p.etat, jours) };
    });
  type L = (typeof lignes)[number];
  const comparateurs: Record<TriReglement, (a: L, b: L) => number> = {
    retard: (a, b) => Number(b.enRetard) - Number(a.enRetard) || b.jours - a.jours,
    reste: (a, b) => b.p.etat.reste.cmp(a.p.etat.reste),
    echeance: (a, b) => (a.p.f.echeance || a.p.f.date || "9999").localeCompare(b.p.f.echeance || b.p.f.date || "9999"),
    client: (a, b) => a.p.f.client_nom.localeCompare(b.p.f.client_nom),
  };
  return lignes.sort(comparateurs[c.tri]);
}

/** Les clients qui ont au moins une facture : en proposer d'autres offrirait des filtres qui ne ramènent rien. */
export function clientsAvecFactures(pieces: readonly PieceReglement[], sansAvoirs: boolean): string[] {
  return [...new Set(pieces.filter((p) => !sansAvoirs || !estAvoir(p.f.type_document)).map((p) => p.f.client_nom).filter(Boolean))].sort(ordreBrut);
}

/** « 3 sur 12 » à côté de la barre de recherche, seulement quand elle écarte quelque chose (`compteRecherche`). */
export function compteRecherche(requete: string, affiches: number, total: number): string | null {
  if (!requete.trim() || affiches === total) return null;
  return `${affiches} sur ${total}`;
}

export function cherche(requete: string, ...champs: (string | null | undefined)[]): boolean {
  return correspond(requete, ...champs);
}
