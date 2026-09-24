/**
 * Délai de paiement et échéance (art. L441-10 du code de commerce).
 *
 * Porté de `src/api/regles-efacture.ts` ; jumeau SQL : `public.date_echeance`.
 * Tout le calendrier se fait en UTC : une date « AAAA-MM-JJ » entre, une sort,
 * sans jamais repasser par l'heure locale.
 */
export type ModeDelaiPaiement = "net" | "fin_de_mois";

export interface DelaiPaiement {
  jours: number;
  mode: ModeDelaiPaiement;
}

export const DELAI_PAIEMENT_DEFAUT: DelaiPaiement = { jours: 30, mode: "net" };
export const PLAFOND_NET_JOURS = 60;
export const PLAFOND_FIN_DE_MOIS_JOURS = 45;

export interface DelaiPreregle extends DelaiPaiement {
  cle: string;
  libelle: string;
}

export const DELAIS_PREREGLES: readonly DelaiPreregle[] = [
  { cle: "reception", libelle: "À réception", jours: 0, mode: "net" },
  { cle: "net30", libelle: "Net 30 jours", jours: 30, mode: "net" },
  { cle: "net45", libelle: "Net 45 jours", jours: 45, mode: "net" },
  { cle: "net60", libelle: "Net 60 jours", jours: 60, mode: "net" },
  { cle: "fdm30", libelle: "30 jours fin de mois", jours: 30, mode: "fin_de_mois" },
  { cle: "fdm45", libelle: "45 jours fin de mois", jours: 45, mode: "fin_de_mois" },
  { cle: "fdm60", libelle: "60 jours fin de mois", jours: 60, mode: "fin_de_mois" },
];

/** Un particulier paie à réception : le crédit est un usage entre professionnels. */
export const CLE_DELAI_PAR_CADRE: Partial<Record<string, string>> = { B2C: "reception" };

export const MODES_REGLEMENT = [
  { code: "virement", libelle: "Virement" },
  { code: "cheque", libelle: "Chèque" },
  { code: "prelevement", libelle: "Prélèvement" },
  { code: "carte", libelle: "Carte bancaire" },
  { code: "especes", libelle: "Espèces" },
] as const;

export function delaiPreregle(delai: DelaiPaiement | null | undefined): DelaiPreregle | null {
  if (!delai) return null;
  return DELAIS_PREREGLES.find((d) => d.jours === Number(delai.jours) && d.mode === delai.mode) ?? null;
}

const modeConnu = (v: unknown): ModeDelaiPaiement => (v === "fin_de_mois" ? "fin_de_mois" : "net");
const renseigne = (v: number | null | undefined): v is number => v != null && Number.isFinite(Number(v));

/**
 * Le délai qui s'applique : client, sinon société, sinon 30 jours net.
 * `0` (« à réception ») est un vrai délai et l'emporte : `null` seul veut dire « non paramétré ».
 */
export function delaiPaiementRetenu(
  client?: { delai_paiement_jours?: number | null; delai_paiement_mode?: string | null } | null,
  societe?: { delai_paiement_jours?: number | null; delai_paiement_mode?: string | null } | null
): DelaiPaiement {
  if (renseigne(client?.delai_paiement_jours)) {
    return { jours: Number(client.delai_paiement_jours), mode: modeConnu(client.delai_paiement_mode) };
  }
  if (renseigne(societe?.delai_paiement_jours)) {
    return { jours: Number(societe.delai_paiement_jours), mode: modeConnu(societe.delai_paiement_mode) };
  }
  return DELAI_PAIEMENT_DEFAUT;
}

function jourUTC(iso: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((iso ?? "").trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

function enISO(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * L'échéance. « Fin de mois » part du DERNIER jour du mois de la facture :
 * 15 janvier + 45 j fin de mois = 17 mars. Date illisible : chaîne vide,
 * plutôt qu'une échéance inventée.
 */
export function dateEcheance(dateFacture: string | null | undefined, delai: DelaiPaiement): string {
  const base = jourUTC(dateFacture);
  if (!base) return "";
  const jours = Number.isFinite(delai.jours) ? delai.jours : 0;
  const a = base.getUTCFullYear();
  const mois = base.getUTCMonth();
  return enISO(
    delai.mode === "fin_de_mois"
      ? new Date(Date.UTC(a, mois + 1, jours))
      : new Date(Date.UTC(a, mois, base.getUTCDate() + jours))
  );
}

export function libelleDelaiPaiement(delai: DelaiPaiement): string {
  const jours = Number.isFinite(delai.jours) ? delai.jours : 0;
  if (jours === 0) return "Paiement à réception";
  return `${jours} jours${delai.mode === "fin_de_mois" ? " fin de mois" : " net"}`;
}

/** Signalé, jamais bloqué : la règle admet des dérogations sectorielles. */
export function delaiHorsPlafond(delai: DelaiPaiement): string | null {
  const jours = Number.isFinite(delai.jours) ? delai.jours : 0;
  if (delai.mode === "fin_de_mois" && jours > PLAFOND_FIN_DE_MOIS_JOURS) {
    return `Au-delà des ${PLAFOND_FIN_DE_MOIS_JOURS} jours fin de mois de l'art. L441-10.`;
  }
  if (delai.mode !== "fin_de_mois" && jours > PLAFOND_NET_JOURS) {
    return `Au-delà des ${PLAFOND_NET_JOURS} jours nets de l'art. L441-10.`;
  }
  return null;
}
