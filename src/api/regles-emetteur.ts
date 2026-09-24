/**
 * L'identité que la pièce emporte avec elle.
 *
 * Une facture rouverte dans six mois doit montrer la raison sociale, l'adresse
 * et le SIRET **du jour de son émission**, pas ceux des réglages du jour où on
 * la relit. Ces neuf colonnes sont la copie que la pièce garde ; l'écran et
 * l'export EN 16931 les lisent d'abord et ne retombent sur les réglages que
 * pour un document qui n'a pas encore été émis.
 *
 * Le même calcul vit en base, dans `bc_generer_facture` : une facture née du
 * bon de commande et une facture saisie à la main doivent porter la même
 * identité, sans quoi deux factures du même jour ne diraient pas la même chose.
 */

import type { FactureInsert } from "./types";

/** Ce que la fiche société déclare — le sous-ensemble qui devient une identité. */
export interface SocieteEmettrice {
  nom: string;
  raison_sociale_legale?: string | null;
  adresse?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  siret?: string | null;
  siren?: string | null;
  tva_intracom?: string | null;
  pays_code?: string | null;
  iban?: string | null;
}

export type IdentiteEmetteur = Pick<
  FactureInsert,
  | "emetteur_nom"
  | "emetteur_adresse"
  | "emetteur_code_postal"
  | "emetteur_ville"
  | "emetteur_siret"
  | "emetteur_siren"
  | "emetteur_tva_intracom"
  | "emetteur_pays_code"
  | "emetteur_iban"
>;

/** Le pays par défaut d'un émetteur qui n'en déclare pas. */
const PAYS_PAR_DEFAUT = "FR";

/** Les neuf premiers chiffres d'un SIRET sont le SIREN. */
const LONGUEUR_SIREN = 9;

/* L'écran écrit `""` pour « non renseigné » : une chaîne vide figée vaudrait
   une identité perdue, alors qu'un NULL laisse le repli sur les réglages. */
function vide(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

/** L'identité à figer sur une pièce émise par cette société. */
export function identiteEmetteur(societe: SocieteEmettrice | null): IdentiteEmetteur {
  if (!societe) return {};

  const siret = vide(societe.siret);

  return {
    emetteur_nom: vide(societe.raison_sociale_legale) ?? vide(societe.nom),
    emetteur_adresse: vide(societe.adresse),
    emetteur_code_postal: vide(societe.code_postal),
    emetteur_ville: vide(societe.ville),
    emetteur_siret: siret,
    emetteur_siren: vide(societe.siren) ?? vide(siret?.slice(0, LONGUEUR_SIREN)),
    emetteur_tva_intracom: vide(societe.tva_intracom),
    emetteur_pays_code: vide(societe.pays_code) ?? PAYS_PAR_DEFAUT,
    emetteur_iban: vide(societe.iban),
  };
}

/** Ce que la pièce porte déjà prime : on ne rend que les trous à combler. */
export function identiteManquante(
  porteuse: Partial<Record<keyof IdentiteEmetteur, string | null | undefined>>,
  identite: IdentiteEmetteur
): IdentiteEmetteur {
  const trous: IdentiteEmetteur = {};
  for (const [cle, valeur] of Object.entries(identite) as [
    keyof IdentiteEmetteur,
    string | null | undefined,
  ][]) {
    if (valeur != null && vide(porteuse[cle]) === null) trous[cle] = valeur;
  }
  return trous;
}
