import { z } from "zod";

/**
 * Ce qu'une pièce imprimée dit de son ÉMETTEUR : identité légale (colonnes de
 * `societes`) et réglages d'impression (`societe_settings.infos_entreprise`,
 * rangés par l'ancienne app dans `reglages.documents`).
 *
 * Lecture TOLÉRANTE, comme `fusionnerReglages` (src/integrations/reglages.ts) :
 * un réglage abîmé ne doit jamais empêcher d'imprimer une facture.
 */
export interface IdentiteEmettrice {
  nom: string;
  formeJuridique: string | null;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  telephone: string | null;
  email: string | null;
  siret: string | null;
  siren: string | null;
  tvaIntracom: string | null;
  capitalSocial: number | null;
  rcsNumero: string | null;
  rcsVille: string | null;
  codeNaf: string | null;
  iban: string | null;
  bic: string | null;
  /** Logo en data-URL seulement : le PDF se fabrique sans requête réseau. */
  logo: string | null;
}

export interface ReglagesImpression {
  afficherIban: boolean;
  piedDePage: string;
  mentionsComplementaires: string;
  conditionsDevis: string;
  mentionAcceptation: string;
  siteWeb: string;
}

/** Les défauts de `REGLAGES_DEFAUT.documents` de l'ancienne app. */
export const REGLAGES_IMPRESSION_DEFAUT: ReglagesImpression = {
  afficherIban: true,
  piedDePage: "",
  mentionsComplementaires: "",
  conditionsDevis: "",
  mentionAcceptation: "Bon pour accord — date et signature",
  siteWeb: "",
};

const texte = (v: unknown, defaut: string) => (v == null ? defaut : String(v));

export function lireReglagesImpression(infosEntreprise: unknown): ReglagesImpression {
  const racine = z.object({ reglages: z.record(z.string(), z.unknown()).optional() }).safeParse(infosEntreprise);
  const doc = z.record(z.string(), z.unknown()).safeParse(racine.success ? racine.data.reglages?.documents : undefined);
  const d = doc.success ? doc.data : {};
  const D = REGLAGES_IMPRESSION_DEFAUT;
  return {
    // Comme `booleen()` de l'ancien : seul un vrai booléen compte, le reste retombe sur le défaut.
    afficherIban: typeof d.afficherIban === "boolean" ? d.afficherIban : D.afficherIban,
    piedDePage: texte(d.piedDePage, D.piedDePage),
    mentionsComplementaires: texte(d.mentionsComplementaires, D.mentionsComplementaires),
    conditionsDevis: texte(d.conditionsDevis, D.conditionsDevis),
    mentionAcceptation: texte(d.mentionAcceptation, D.mentionAcceptation),
    siteWeb: texte(d.siteWeb, D.siteWeb),
  };
}

/** Le logo vit dans le JSON des réglages (data-URL) ; une URL distante n'est pas suivie. */
export function logoDesReglages(infosEntreprise: unknown, logoUrl: string | null): string | null {
  const lu = z.object({ logo: z.string() }).safeParse(infosEntreprise);
  const candidat = lu.success ? lu.data.logo : logoUrl;
  return candidat && /^data:image\/(png|jpe?g);base64,/i.test(candidat) ? candidat : null;
}

const capitalFr = new Intl.NumberFormat("fr-FR");

/**
 * Les identifiants légaux du pied de page, dans l'ordre de
 * `regles-efacture.ts#identifiantsLegaux` (parité : tests/parite/documents.essai.ts).
 */
export function identifiantsLegaux(e: {
  formeJuridique?: string | null;
  siret?: string | null;
  siren?: string | null;
  tvaIntracom?: string | null;
  capitalSocial?: number | string | null;
  rcsNumero?: string | null;
  rcsVille?: string | null;
  codeNaf?: string | null;
}): string[] {
  const capital = Number(e.capitalSocial);
  return [
    e.formeJuridique || "",
    e.siret ? `SIRET ${e.siret}` : e.siren ? `SIREN ${e.siren}` : "",
    e.tvaIntracom ? `TVA ${e.tvaIntracom}` : "",
    Number.isFinite(capital) && capital > 0 ? `Capital ${capitalFr.format(capital)} €` : "",
    e.rcsNumero ? `RCS ${[e.rcsVille, e.rcsNumero].filter(Boolean).join(" ")}` : "",
    e.codeNaf ? `APE ${e.codeNaf}` : "",
  ].filter(Boolean);
}

/**
 * Le pied légal (art. R123-238) : nom, identifiants, adresse — ou le pied
 * personnalisé des réglages, qui l'emporte (`piedDePageHTML`, app.js l. 4263).
 */
export function piedDePage(em: { nom: string; siret: string | null; tvaIntracom: string | null; adresse: string | null }, identite: IdentiteEmettrice, reglages: ReglagesImpression): string {
  const perso = reglages.piedDePage.trim();
  if (perso) return perso;
  const ids = identifiantsLegaux({ ...identite, siret: em.siret, tvaIntracom: em.tvaIntracom });
  return [em.nom, ...ids, em.adresse].filter(Boolean).join(" — ");
}
