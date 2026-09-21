/**
 * Ce que l'écran des règlements laisse voir, et ce qu'il additionne.
 *
 * Les règlements ne se consultaient que dossier par dossier : pour répondre à
 * « combien avons-nous encaissé par chèque en août, sur le chantier des
 * Tilleuls ? », il fallait ouvrir chaque client l'un après l'autre.
 *
 * Module feuille — il n'importe que des types. Le filtrage et le total vivent
 * ici plutôt que dans l'écran, parce qu'un total qui ne correspond pas à la
 * liste affichée est un chiffre faux, et qu'un chiffre faux sur un écran de
 * trésorerie se remarque tard.
 *
 * LE RAPPROCHEMENT. Le schéma ne porte aucun indicateur de rapprochement
 * bancaire : `reglements` a une `reference`, et rien d'autre. Le filtre lit
 * donc la présence de cette référence — c'est ce que la saisie y met, le
 * numéro de chèque ou la référence du virement — et l'écran le nomme ainsi,
 * sans prétendre à un pointage qui n'existe pas.
 */

/** Un règlement, vu d'ici. */
export interface ReglementFiltrable {
  id: string;
  date?: string | null;
  mode?: string | null;
  montant?: number | string | null;
  reference?: string | null;
  factureId?: string | null;
}

/** Ce que l'écran sait de la facture que le règlement solde. */
export interface FactureDuReglement {
  client?: string | null;
  chantierId?: string | null;
  numero?: string | null;
}

export type Rapprochement = "" | "rapproche" | "non_rapproche";

export interface CriteresReglements {
  /** Bornes de période, en ISO `AAAA-MM-JJ`. Incluses toutes les deux. */
  du: string;
  au: string;
  client: string;
  mode: string;
  rapprochement: Rapprochement;
  chantier: string;
}

export const CRITERES_REGLEMENTS_VIDES: CriteresReglements = {
  du: "",
  au: "",
  client: "",
  mode: "",
  rapprochement: "",
  chantier: "",
};

function texte(v: unknown): string {
  return String(v ?? "").trim();
}

function nombre(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Une référence saisie vaut rapprochement ; son absence, le contraire. */
export function estRapproche(reglement: ReglementFiltrable): boolean {
  return texte(reglement.reference) !== "";
}

/**
 * Les règlements qui répondent à TOUS les critères posés.
 *
 * Un critère vide ne filtre rien : c'est ce qui permet de les combiner sans
 * énumérer les cas. Les dates se comparent en ISO, comme des chaînes — aucun
 * `new Date()` ici, `toISOString()` basculant en UTC ferait sortir de la
 * période un règlement du premier du mois saisi avant 1 h à Paris.
 */
export function filtrerReglements(
  reglements: ReglementFiltrable[],
  factureDe: (factureId: string | null | undefined) => FactureDuReglement | null | undefined,
  criteres: Partial<CriteresReglements>
): ReglementFiltrable[] {
  const c = { ...CRITERES_REGLEMENTS_VIDES, ...criteres };

  return reglements.filter((r) => {
    const date = texte(r.date);
    if (c.du && (!date || date < c.du)) return false;
    if (c.au && (!date || date > c.au)) return false;

    if (c.mode && texte(r.mode) !== c.mode) return false;

    if (c.rapprochement === "rapproche" && !estRapproche(r)) return false;
    if (c.rapprochement === "non_rapproche" && estRapproche(r)) return false;

    if (c.client || c.chantier) {
      const facture = factureDe(r.factureId);
      if (!facture) return false;
      if (c.client && texte(facture.client) !== c.client) return false;
      if (c.chantier && texte(facture.chantierId) !== c.chantier) return false;
    }

    return true;
  });
}

/** Ce que la liste affichée totalise — jamais ce qu'elle cache. */
export function totalReglements(reglements: ReglementFiltrable[]): number {
  return Math.round(reglements.reduce((s, r) => s + nombre(r.montant), 0) * 100) / 100;
}

export function criteresReglementsActifs(criteres: Partial<CriteresReglements>): boolean {
  const c = { ...CRITERES_REGLEMENTS_VIDES, ...criteres };
  return !!(c.du || c.au || c.client || c.mode || c.rapprochement || c.chantier);
}

/* ---------- Le lien qu'on peut copier ---------- */

const CLES: (keyof CriteresReglements)[] = [
  "du",
  "au",
  "client",
  "mode",
  "rapprochement",
  "chantier",
];

/**
 * Les critères, sous la forme qui tient dans une URL.
 *
 * Chaîne vide quand rien n'est posé : l'adresse reste alors celle d'avant, et
 * on n'encombre pas l'historique d'un `?` sans contenu.
 */
export function criteresVersRequete(criteres: Partial<CriteresReglements>): string {
  const c = { ...CRITERES_REGLEMENTS_VIDES, ...criteres };
  const params = CLES.filter((k) => texte(c[k]) !== "").map(
    (k) => `${k}=${encodeURIComponent(texte(c[k]))}`
  );
  return params.length ? `?${params.join("&")}` : "";
}

/**
 * Les critères relus d'une URL — et seulement ceux qu'on reconnaît.
 *
 * Un paramètre inconnu ou une valeur hors liste est ignoré : une adresse
 * bricolée ne doit pas produire un écran vide sans explication.
 */
export function criteresDepuisRequete(requete: string): CriteresReglements {
  const c: CriteresReglements = { ...CRITERES_REGLEMENTS_VIDES };
  const brut = texte(requete).replace(/^[?#]/, "");
  if (!brut) return c;

  for (const morceau of brut.split("&")) {
    const i = morceau.indexOf("=");
    if (i < 0) continue;
    const cle = morceau.slice(0, i) as keyof CriteresReglements;
    if (!CLES.includes(cle)) continue;
    let valeur = "";
    try {
      valeur = decodeURIComponent(morceau.slice(i + 1).replace(/\+/g, " ")).trim();
    } catch {
      /* Une séquence d'échappement invalide ne doit pas faire tomber l'écran :
         le critère est simplement ignoré. */
      continue;
    }
    if (cle === "du" || cle === "au") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(valeur)) continue;
    }
    if (cle === "rapprochement" && valeur !== "rapproche" && valeur !== "non_rapproche") {
      continue;
    }
    c[cle] = valeur as never;
  }
  return c;
}
