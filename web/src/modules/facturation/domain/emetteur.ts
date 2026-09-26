/**
 * L'identité de l'émetteur, FIGÉE sur la facture à sa naissance (port de
 * `src/api/regles-emetteur.ts`) : rouvrir une facture dans six mois ne doit
 * pas lui donner l'adresse ou l'IBAN du jour.
 */
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

export interface IdentiteEmetteur {
  emetteur_nom: string | null;
  emetteur_adresse: string | null;
  emetteur_code_postal: string | null;
  emetteur_ville: string | null;
  emetteur_siret: string | null;
  emetteur_siren: string | null;
  emetteur_tva_intracom: string | null;
  emetteur_pays_code: string | null;
  emetteur_iban: string | null;
}

const LONGUEUR_SIREN = 9;
const vide = (v: string | null | undefined) => ((v ?? "").trim() === "" ? null : (v ?? "").trim());

export function identiteEmetteur(s: SocieteEmettrice): IdentiteEmetteur {
  const siret = vide(s.siret);
  return {
    emetteur_nom: vide(s.raison_sociale_legale) ?? vide(s.nom),
    emetteur_adresse: vide(s.adresse),
    emetteur_code_postal: vide(s.code_postal),
    emetteur_ville: vide(s.ville),
    emetteur_siret: siret,
    emetteur_siren: vide(s.siren) ?? vide(siret?.slice(0, LONGUEUR_SIREN)),
    emetteur_tva_intracom: vide(s.tva_intracom),
    emetteur_pays_code: vide(s.pays_code) ?? "FR",
    emetteur_iban: vide(s.iban),
  };
}
