import { z } from "zod";

/**
 * Les réglages de documents d'une société, rangés par l'ancienne app dans
 * `societe_settings.infos_entreprise.reglages` (JSON libre).
 *
 * Lecture TOLÉRANTE, comme `fusionnerReglages` (src/integrations/reglages.ts) :
 * un document partiel, ancien ou abîmé ne doit jamais empêcher un écran de
 * s'ouvrir — chaque valeur illisible retombe sur son défaut.
 */
export interface ReglagesDocuments {
  validiteDevisJours: number;
  tvaDefaut: number;
  delaiPaiementJours: number;
  modeDelaiPaiement: "net" | "fin_de_mois";
  unites: string[];
  tauxTva: number[];
}

export const UNITES_DEFAUT = ["U", "ml", "m²", "m³", "h", "j", "forfait", "kg", "l", "ens"];
export const TAUX_TVA_DEFAUT = [0, 2.1, 5.5, 10, 20];

export const REGLAGES_DEFAUT: ReglagesDocuments = {
  validiteDevisJours: 30,
  tvaDefaut: 10,
  delaiPaiementJours: 30,
  modeDelaiPaiement: "net",
  unites: UNITES_DEFAUT,
  tauxTva: TAUX_TVA_DEFAUT,
};

const nombreOu = (defaut: number) => z.unknown().transform((v) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : defaut));

export function lireReglages(infosEntreprise: unknown): ReglagesDocuments {
  const racine = z.object({ reglages: z.record(z.string(), z.unknown()).optional() }).safeParse(infosEntreprise);
  const r = racine.success ? (racine.data.reglages ?? {}) : {};
  const doc = z.record(z.string(), z.unknown()).safeParse(r.documents);
  const d = doc.success ? doc.data : {};

  const unites = z.array(z.unknown()).safeParse(r.unites);
  const listeUnites = unites.success ? unites.data.map((u) => String(u).trim()).filter(Boolean) : [];
  const taux = z.array(z.unknown()).safeParse(r.tauxTva);
  const listeTaux = taux.success ? taux.data.map(Number).filter((n) => Number.isFinite(n) && n >= 0) : [];

  return {
    validiteDevisJours: nombreOu(REGLAGES_DEFAUT.validiteDevisJours).parse(d.validiteDevisJours),
    tvaDefaut: nombreOu(REGLAGES_DEFAUT.tvaDefaut).parse(d.tvaDefaut),
    delaiPaiementJours: nombreOu(REGLAGES_DEFAUT.delaiPaiementJours).parse(d.delaiPaiementJours),
    modeDelaiPaiement: d.modeDelaiPaiement === "fin_de_mois" ? "fin_de_mois" : "net",
    unites: listeUnites.length ? listeUnites : UNITES_DEFAUT,
    tauxTva: listeTaux.length ? [...new Set(listeTaux)].sort((a, b) => a - b) : TAUX_TVA_DEFAUT,
  };
}
