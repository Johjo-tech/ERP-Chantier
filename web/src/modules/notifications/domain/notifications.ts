import { formatDateFr } from "@/lib/dates";
import { joursEntre, libelleDocumentRh, TYPE_HABILITATION, type DocumentRh } from "@/modules/rh/domain/documents";
import type { Seuils } from "@/modules/societes/domain/reglages-societe";
import type { AlerteVehicule } from "@/modules/vehicules/domain/echeances";

/**
 * Le centre de notifications (TRV-09, `computeNotifications`, app.js l. 627) :
 * une cloche qui regroupe ce qui arrive à échéance dans toute la société.
 * Identifiants, textes et ordre sont ceux de l'ancien écran (parité :
 * tests/parite/notifications.essai.ts) — l'identifiant est ce que « fait »
 * mémorise : le changer ferait réapparaître des alertes déjà traitées.
 */
export interface Notification {
  id: string;
  icone: string;
  urgent: boolean;
  texte: string;
  /** L'écran où l'on traite l'alerte (l'ancien `onclick: setTab(…)`). */
  lien: string;
}

/** Au-delà de ce nombre, le badge dit « 99+ » (l'ancien `refreshNotifBadge`). */
export const BADGE_MAXIMUM = 99;
/** Le panneau replié montre les premières alertes, la liste complète se déplie. */
export const APERCU_NOTIFICATIONS = 5;

const echeanceTexte = (jours: number) => (jours < 0 ? "expiré" : `dans ${jours} j`);

/** Véhicules : les alertes du module (cartes, contrôle technique, documents). */
export function notificationsVehicules(alertes: readonly AlerteVehicule[]): Notification[] {
  return alertes.map((a) => ({
    id: a.id,
    icone: "🚐",
    urgent: a.niveau === "danger",
    texte: `${a.libelle} — ${echeanceTexte(a.jours)} (${formatDateFr(a.echeance)})`,
    lien: "/vehicules",
  }));
}

export interface SalarieAlertable {
  id: string;
  nom: string | null;
  prenom: string | null;
  actif: boolean;
  carteBtpValidite: string | null;
  visiteMedicaleProchaine: string | null;
}

const identite = (s: Pick<SalarieAlertable, "nom" | "prenom">) => [s.prenom, s.nom].filter(Boolean).join(" ") || "Salarié";

/**
 * Carte BTP, visite médicale et habilitations d'un salarié actif
 * (`alertesSalarie`). Les habilitations sont au dossier documentaire, type
 * « habilitation » (D-RH-03). Seuils de Réglages › RH : l'ancienne cloche
 * appelait `alertesSalarie` sans eux, donc avec les défauts (D-CLI-06).
 */
export function notificationsSalarie(
  s: SalarieAlertable,
  documents: readonly DocumentRh[],
  seuils: Pick<Seuils, "carteBtp" | "visiteMedicale" | "habilitation">,
  aujourdhui: string
): Notification[] {
  if (!s.actif) return [];
  const qui = identite(s);
  const une = (id: string, libelle: string, date: string | null | undefined, seuil: number): Notification | null => {
    const jours = joursEntre(aujourdhui, date);
    if (jours === null || jours > seuil || !date) return null;
    return { id, icone: "👷", urgent: jours < 0, texte: `${qui} — ${libelle} — ${echeanceTexte(jours)} (${formatDateFr(date)})`, lien: "/rh" };
  };
  const habilitations = documents
    .filter((d) => d.salarieId === s.id && d.type === TYPE_HABILITATION)
    .map((h) => une(`hab_${h.id}`, h.nom ?? "habilitation", h.dateExpiration, seuils.habilitation));
  return [
    une(`btp_${s.id}`, "carte BTP", s.carteBtpValidite, seuils.carteBtp),
    une(`visite_${s.id}`, "visite médicale", s.visiteMedicaleProchaine, seuils.visiteMedicale),
    ...habilitations,
  ].filter((n): n is Notification => n !== null);
}

/**
 * Le reste du dossier RH (carte BTP déposée, titre de séjour…), au seuil des
 * documents légaux. Les habilitations en sont exclues : `notificationsSalarie`
 * les annonce déjà — l'ancienne cloche les comptait deux fois (D-CLI-06).
 */
export function notificationsDossierRh(
  documents: readonly DocumentRh[],
  salaries: readonly Pick<SalarieAlertable, "id" | "nom" | "prenom">[],
  seuilDocument: number,
  aujourdhui: string
): Notification[] {
  const nomDe = new Map(salaries.map((s) => [s.id, identite(s)]));
  return documents.flatMap((d) => {
    if (d.type === TYPE_HABILITATION || !d.dateExpiration) return [];
    const jours = joursEntre(aujourdhui, d.dateExpiration);
    if (jours === null || jours > seuilDocument) return [];
    return [{
      id: `docrh_${d.id}`,
      icone: "📁",
      urgent: jours < 0,
      texte: `${nomDe.get(d.salarieId) ?? "Salarié"} — ${libelleDocumentRh(d)} ${echeanceTexte(jours)} (${formatDateFr(d.dateExpiration)})`,
      lien: "/rh",
    }];
  });
}

export interface DocumentLegalAlertable {
  id: string;
  nom: string | null;
  type: string | null;
  date_validite: string | null;
}

/** Kbis, attestations URSSAF, assurance décennale… (`alertesDocument`). */
export function notificationsDocumentsLegaux(documents: readonly DocumentLegalAlertable[], seuil: number, aujourdhui: string): Notification[] {
  return documents.flatMap((d) => {
    const jours = joursEntre(aujourdhui, d.date_validite);
    if (jours === null || jours > seuil || !d.date_validite) return [];
    return [{ id: `doc_${d.id}`, icone: "📑", urgent: jours < 0, texte: `${d.nom ?? d.type ?? "Document"} — ${echeanceTexte(jours)} (${formatDateFr(d.date_validite)})`, lien: "/reglages" }];
  });
}

export interface BonAlertable {
  id: string;
  numero_bc: string | null;
  client_nom: string | null;
  date_fin_travaux: string | null;
  rappel_date: string | null;
  statut_workflow: string | null;
}

/**
 * Les étapes où les travaux sont encore à faire. L'ancienne cloche comptait
 * en retard TOUT bon dont la date de fin était passée, facturés compris :
 * une alerte permanente qu'on apprend à ignorer (D-CLI-06).
 */
const TRAVAUX_EN_COURS: readonly (string | null)[] = [null, "en_cours"];

export function notificationsBonsEnRetard(bons: readonly BonAlertable[], aujourdhui: string): Notification[] {
  return bons
    .filter((b) => b.date_fin_travaux && b.date_fin_travaux < aujourdhui && TRAVAUX_EN_COURS.includes(b.statut_workflow))
    .map((b) => ({
      id: `bc_retard_${b.id}`,
      icone: "📦",
      urgent: true,
      texte: `${b.numero_bc || b.client_nom || "BC"} — en retard (échéance ${formatDateFr(b.date_fin_travaux)})`,
      lien: `/commandes/${b.id}`,
    }));
}

/** « Rappeler le locataire » le jour dit, et tant qu'on ne l'a pas fait. */
export function notificationsRappels(bons: readonly BonAlertable[], aujourdhui: string): Notification[] {
  return bons.flatMap((b) => {
    const jours = joursEntre(aujourdhui, b.rappel_date);
    if (jours === null || jours > 0 || !b.rappel_date) return [];
    return [{
      id: `rappel_${b.id}`,
      icone: "🔄",
      urgent: true,
      texte: `Rappeler ${b.client_nom ?? ""} — ${jours < 0 ? `prévu le ${formatDateFr(b.rappel_date)}` : "aujourd'hui"}`,
      lien: `/commandes/${b.id}`,
    }];
  });
}

export interface DocumentSousTraitantAlertable {
  id: string;
  sousTraitantId: string;
  type: string | null;
  dateValidite: string | null;
}

/**
 * Attestations de vigilance, Kbis, assurance d'un sous-traitant : au seuil des
 * documents légaux (30 j par défaut, que l'ancien écran codait en dur — D-RH-04).
 */
export function notificationsSousTraitants(
  sousTraitants: readonly { id: string; nom: string }[],
  documents: readonly DocumentSousTraitantAlertable[],
  seuil: number,
  aujourdhui: string
): Notification[] {
  const nomDe = new Map(sousTraitants.map((s) => [s.id, s.nom]));
  return documents.flatMap((d) => {
    const nom = nomDe.get(d.sousTraitantId);
    const jours = joursEntre(aujourdhui, d.dateValidite);
    if (nom === undefined || jours === null || jours > seuil) return [];
    return [{ id: `stdoc_${d.sousTraitantId}_${d.id}`, icone: "📑", urgent: jours < 0, texte: `${nom} — ${d.type ?? ""} ${echeanceTexte(jours)}`, lien: "/rh" }];
  });
}

/**
 * Ce qui reste à traiter : les alertes marquées « fait » disparaissent, les
 * urgentes passent devant (tri stable : l'ordre des familles est gardé).
 */
export function notificationsActives(toutes: readonly Notification[], traitees: ReadonlySet<string>): Notification[] {
  return toutes.filter((n) => !traitees.has(n.id)).sort((a, b) => Number(b.urgent) - Number(a.urgent));
}

export function libelleBadge(nombre: number): string {
  return nombre > BADGE_MAXIMUM ? `${BADGE_MAXIMUM}+` : String(nombre);
}
