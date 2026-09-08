/**
 * Alertes d'échéance — véhicules et RH.
 *
 * Portées depuis chantier-mate-ease, mais recalées sur les colonnes réellement
 * présentes en base. L'app historique interrogeait `vehicule.prochainCT` et
 * `salarie.habilitations[]`, qui n'existent pas : le contrôle technique vit
 * dans `vehicule_controles_periodiques` et les habilitations dans
 * `salarie_habilitations`.
 *
 * Les objets reçus sont ceux que produit l'adaptateur : colonnes de la base,
 * converties en camelCase.
 */

export type NiveauAlerte = "danger" | "warn";

export interface Alerte {
  id: string;
  niveau: NiveauAlerte;
  categorie: string;
  libelle: string;
  echeance?: string;
  jours?: number;
}

/** Seuils par défaut, en jours. Surchargeables depuis les réglages. */
export const SEUILS = {
  vehiculeCarte: 30,
  vehiculeControle: 30,
  documentLegal: 30,
  carteBtp: 60,
  visiteMedicale: 45,
  habilitation: 60,
};

export type Seuils = typeof SEUILS;

/** Jours restants avant une date ISO ; négatif si dépassée. */
export function joursRestants(dateISO?: string | null): number | null {
  if (!dateISO) return null;
  const cible = new Date(`${dateISO}T00:00:00`).getTime();
  if (Number.isNaN(cible)) return null;
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  return Math.round((cible - aujourdhui.getTime()) / 86_400_000);
}

function alerte(
  id: string,
  categorie: string,
  libelle: string,
  echeance: string | null | undefined,
  seuil: number
): Alerte | null {
  const jours = joursRestants(echeance);
  if (jours === null || jours > seuil) return null;
  return {
    id,
    niveau: jours < 0 ? "danger" : "warn",
    categorie,
    libelle,
    echeance: echeance ?? undefined,
    jours,
  };
}

interface VehiculeAlertable {
  id: string;
  nom?: string;
  vendu?: boolean;
  carteCarburantValidite?: string | null;
  telepeageValidite?: string | null;
}

export function alertesVehicule(
  v: VehiculeAlertable,
  seuils: Seuils = SEUILS
): Alerte[] {
  if (v.vendu) return [];
  const nom = v.nom ?? "Véhicule";

  return [
    alerte(
      `veh_carburant_${v.id}`,
      "Carte carburant",
      `${nom} — carte carburant`,
      v.carteCarburantValidite,
      seuils.vehiculeCarte
    ),
    alerte(
      `veh_telepeage_${v.id}`,
      "Télépéage",
      `${nom} — badge télépéage`,
      v.telepeageValidite,
      seuils.vehiculeCarte
    ),
  ].filter((a): a is Alerte => a !== null);
}

interface SalarieAlertable {
  id: string;
  nom?: string;
  prenom?: string;
  actif?: boolean;
  carteBtpValidite?: string | null;
  visiteMedicaleProchaine?: string | null;
}

interface HabilitationAlertable {
  id: string;
  salarieId: string;
  nom?: string;
  dateExpiration?: string | null;
}

export function alertesSalarie(
  s: SalarieAlertable,
  habilitations: HabilitationAlertable[] = [],
  seuils: Seuils = SEUILS
): Alerte[] {
  if (s.actif === false) return [];
  const identite = [s.prenom, s.nom].filter(Boolean).join(" ") || "Salarié";

  const base = [
    alerte(
      `btp_${s.id}`,
      "Carte BTP",
      `${identite} — carte BTP`,
      s.carteBtpValidite,
      seuils.carteBtp
    ),
    alerte(
      `visite_${s.id}`,
      "Visite médicale",
      `${identite} — visite médicale`,
      s.visiteMedicaleProchaine,
      seuils.visiteMedicale
    ),
  ];

  const hab = habilitations
    .filter((h) => h.salarieId === s.id)
    .map((h) =>
      alerte(
        `hab_${h.id}`,
        "Habilitation",
        `${identite} — ${h.nom ?? "habilitation"}`,
        h.dateExpiration,
        seuils.habilitation
      )
    );

  return [...base, ...hab].filter((a): a is Alerte => a !== null);
}

interface DocumentAlertable {
  id: string;
  nom?: string;
  type?: string;
  dateValidite?: string | null;
}

export function alertesDocument(
  d: DocumentAlertable,
  seuils: Seuils = SEUILS
): Alerte[] {
  const a = alerte(
    `doc_${d.id}`,
    "Document légal",
    d.nom ?? d.type ?? "Document",
    d.dateValidite,
    seuils.documentLegal
  );
  return a ? [a] : [];
}

/** Les plus urgentes d'abord, puis par échéance croissante. */
export function trierAlertes(alertes: Alerte[]): Alerte[] {
  return [...alertes].sort((a, b) => {
    if (a.niveau !== b.niveau) return a.niveau === "danger" ? -1 : 1;
    return (a.jours ?? 0) - (b.jours ?? 0);
  });
}
