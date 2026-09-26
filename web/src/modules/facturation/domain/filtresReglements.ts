import { arrondiCentimes, montant, somme, type Montant } from "@/lib/money";

/**
 * « Tous les règlements » : ce que la vue laisse voir et ce qu'elle
 * additionne. Port de `src/api/regles-filtres-reglements.ts` (parité :
 * tests/parite/reglements.essai.ts). Le total sort de la MÊME liste que celle
 * qu'on affiche : il ne peut pas annoncer autre chose que ce qu'on voit.
 *
 * Le rapprochement se lit sur la présence d'une référence (n° de chèque,
 * référence de virement) : le schéma ne porte aucun pointage bancaire.
 */
export interface ReglementFiltrable {
  id: string;
  date: string | null;
  mode: string | null;
  montant: number | string | null;
  reference: string | null;
  facture_id: string | null;
}

export interface FactureDuReglement {
  client_nom: string | null;
  chantier_id: string | null;
}

export type Rapprochement = "" | "rapproche" | "non_rapproche";

export interface CriteresReglements {
  du: string;
  au: string;
  client: string;
  mode: string;
  rapprochement: Rapprochement;
  chantier: string;
}

export const CRITERES_REGLEMENTS_VIDES: CriteresReglements = { du: "", au: "", client: "", mode: "", rapprochement: "", chantier: "" };
const CLES = Object.keys(CRITERES_REGLEMENTS_VIDES) as (keyof CriteresReglements)[];
const texte = (v: unknown) => String(v ?? "").trim();

export const estRapproche = (r: Pick<ReglementFiltrable, "reference">) => texte(r.reference) !== "";

/** Tous les critères posés à la fois ; un critère vide ne filtre rien. Dates comparées en ISO, jamais par `Date`. */
export function filtrerReglements<R extends ReglementFiltrable>(reglements: readonly R[], factureDe: (id: string | null) => FactureDuReglement | null | undefined, criteres: Partial<CriteresReglements>): R[] {
  const c = { ...CRITERES_REGLEMENTS_VIDES, ...criteres };
  return reglements.filter((r) => {
    const date = texte(r.date);
    if (c.du && (!date || date < c.du)) return false;
    if (c.au && (!date || date > c.au)) return false;
    if (c.mode && texte(r.mode) !== c.mode) return false;
    if (c.rapprochement === "rapproche" && !estRapproche(r)) return false;
    if (c.rapprochement === "non_rapproche" && estRapproche(r)) return false;
    if (c.client || c.chantier) {
      const f = factureDe(r.facture_id);
      if (!f) return false;
      if (c.client && texte(f.client_nom) !== c.client) return false;
      if (c.chantier && texte(f.chantier_id) !== c.chantier) return false;
    }
    return true;
  });
}

/** Le total de ce que la liste montre, au centime (l'ancien arrondissait un flottant — D-006). */
export function totalReglements(reglements: readonly Pick<ReglementFiltrable, "montant">[]): Montant {
  return arrondiCentimes(somme(reglements.map((r) => montant(r.montant))));
}

export function criteresActifs(criteres: Partial<CriteresReglements>): boolean {
  const c = { ...CRITERES_REGLEMENTS_VIDES, ...criteres };
  return CLES.some((k) => texte(c[k]) !== "");
}

/** Les critères dans l'URL : un filtre trouvé se transmet en copiant le lien. Vide quand rien n'est posé. */
export function criteresVersRequete(criteres: Partial<CriteresReglements>): string {
  const c = { ...CRITERES_REGLEMENTS_VIDES, ...criteres };
  const params = CLES.filter((k) => texte(c[k]) !== "").map((k) => `${k}=${encodeURIComponent(texte(c[k]))}`);
  return params.length ? `?${params.join("&")}` : "";
}

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Relit l'URL ; un paramètre inconnu ou une valeur hors liste est ignoré, jamais un écran vide inexpliqué. */
export function criteresDepuisRequete(requete: string): CriteresReglements {
  const c: CriteresReglements = { ...CRITERES_REGLEMENTS_VIDES };
  const brut = texte(requete).replace(/^[?#]/, "");
  if (!brut) return c;
  for (const morceau of brut.split("&")) {
    const i = morceau.indexOf("=");
    if (i < 0) continue;
    const cle = morceau.slice(0, i) as keyof CriteresReglements;
    if (!CLES.includes(cle)) continue;
    let valeur: string;
    try {
      valeur = decodeURIComponent(morceau.slice(i + 1).replace(/\+/g, " ")).trim();
    } catch (err) {
      // Une séquence d'échappement invalide fait ignorer CE critère, pas tomber l'écran.
      console.warn(`Critère « ${cle} » illisible dans l'adresse, ignoré.`, err);
      continue;
    }
    if ((cle === "du" || cle === "au") && !DATE_ISO.test(valeur)) continue;
    if (cle === "rapprochement" && valeur !== "rapproche" && valeur !== "non_rapproche") continue;
    c[cle] = valeur as never;
  }
  return c;
}
