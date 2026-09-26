import { todayISO } from "@/lib/dates";
import type { Seuils } from "@/modules/societes/domain/reglages-societe";
import { libelleVehicule, type Vehicule } from "./vehicule";

/**
 * Échéances du parc : contrôle technique, carte carburant, télépéage, et les
 * documents qui expirent (assurance…). Les seuils sont ceux des Réglages ›
 * Véhicules (PAR-07) — l'ancienne liste codait « 30 » en dur pour le CT
 * (D-VEH-04) ; le défaut reste 30.
 */

const JOUR_MS = 86_400_000;
const DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})/;

function jourUtc(iso: string): number | null {
  const m = DATE_ISO.exec(iso);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/**
 * Jours restants avant une date (négatif si dépassée), compté en jours de
 * calendrier d'après « aujourd'hui » À PARIS (`joursAvant`, app.js l. 15588).
 */
export function joursAvant(dateIso: string | null | undefined, aujourdhui: string = todayISO()): number | null {
  if (!dateIso) return null;
  const cible = jourUtc(dateIso);
  const ref = jourUtc(aujourdhui);
  if (cible === null || ref === null) return null;
  return (cible - ref) / JOUR_MS;
}

export type NiveauEcheance = "danger" | "alerte";

export interface EtiquetteEcheance {
  jours: number;
  niveau: NiveauEcheance;
  /** « EXPIRÉ » ou « DANS n J », comme l'étiquette de la liste. */
  texte: string;
}

/** L'étiquette d'une échéance proche, ou rien. Un véhicule vendu n'a plus d'échéance. */
export function etiquetteEcheance(dateIso: string | null, seuil: number, vendu = false, aujourdhui?: string): EtiquetteEcheance | null {
  const j = joursAvant(dateIso, aujourdhui);
  if (j === null || j > seuil || vendu) return null;
  return { jours: j, niveau: j < 0 ? "danger" : "alerte", texte: j < 0 ? "EXPIRÉ" : `DANS ${j} J` };
}

export interface DocumentEcheance {
  id: string;
  vehicule_id: string;
  type: string | null;
  nom: string | null;
  date_expiration: string | null;
}

export interface AlerteVehicule {
  id: string;
  vehiculeId: string;
  categorie: string;
  libelle: string;
  echeance: string;
  jours: number;
  niveau: NiveauEcheance;
}

type VehiculeAlertable = Pick<Vehicule, "id" | "vendu" | "immatriculation" | "marque" | "modele" | "nom" | "date_controle_technique" | "carte_carburant_validite" | "telepeage_validite">;

function alerte(v: VehiculeAlertable, cle: string, categorie: string, date: string | null, seuil: number, aujourdhui?: string): AlerteVehicule | null {
  const e = etiquetteEcheance(date, seuil, v.vendu, aujourdhui);
  if (!e || !date) return null;
  return { id: `${cle}_${v.id}`, vehiculeId: v.id, categorie, libelle: `${libelleVehicule(v)} — ${categorie.toLowerCase()}`, echeance: date, jours: e.jours, niveau: e.niveau };
}

/**
 * Les alertes d'un véhicule. Cartes : mêmes ids, catégories, seuil et bornes
 * que `alertesVehicule` (src/integrations/alertes.ts — parité). Ajouts : le
 * contrôle technique, que l'ancienne cloche ne connaissait pas (elle lisait
 * `prochainCT`, sans colonne), et les documents à échéance. Le libellé nomme le
 * véhicule par sa plaque ; l'ancien lisait `nom`, désormais vide (« Véhicule »).
 */
export function alertesVehicule(
  v: VehiculeAlertable,
  seuils: Pick<Seuils, "vehiculeCarte" | "vehiculeControle">,
  documents: readonly DocumentEcheance[] = [],
  aujourdhui?: string
): AlerteVehicule[] {
  const docs = documents
    .filter((d) => d.vehicule_id === v.id)
    .map((d) => {
      const a = alerte(v, `veh_doc_${d.id}`, d.type || "Document", d.date_expiration, seuils.vehiculeControle, aujourdhui);
      return a && { ...a, id: `veh_doc_${d.id}`, libelle: `${libelleVehicule(v)} — ${d.nom || d.type || "document"}` };
    });
  return [
    alerte(v, "veh_ct", "Contrôle technique", v.date_controle_technique, seuils.vehiculeControle, aujourdhui),
    alerte(v, "veh_carburant", "Carte carburant", v.carte_carburant_validite, seuils.vehiculeCarte, aujourdhui),
    alerte(v, "veh_telepeage", "Télépéage", v.telepeage_validite, seuils.vehiculeCarte, aujourdhui),
    ...docs,
  ].filter((a): a is AlerteVehicule => a !== null);
}

/** Les plus urgentes d'abord (`trierAlertes`) : expirées, puis par échéance croissante. */
export function trierAlertes(alertes: readonly AlerteVehicule[]): AlerteVehicule[] {
  return [...alertes].sort((a, b) => (a.niveau !== b.niveau ? (a.niveau === "danger" ? -1 : 1) : a.jours - b.jours));
}
