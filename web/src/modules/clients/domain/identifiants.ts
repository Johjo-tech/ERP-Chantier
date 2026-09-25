/**
 * Identifiants d'une entreprise : SIREN, SIRET, n° de TVA intracommunautaire.
 *
 * Porté de `src/api/regles-efacture.ts` (parité vérifiée par
 * tests/parite/identifiants.essai.ts). Deux natures de problème, à ne jamais
 * confondre :
 *  - MAL FORMÉ (clé fausse, pays incohérent) : on refuse d'enregistrer ;
 *  - MANQUANT : jamais une erreur — un client sans SIRET reste enregistrable.
 */
export const PAYS_DEFAUT = "FR";
export const LONGUEUR_SIREN = 9;
const LONGUEUR_SIRET = 14;
/** La Poste échappe à Luhn : la somme des 14 chiffres de ses SIRET est un multiple de 5. */
const SIREN_LA_POSTE = "356000000";
const DIVISEUR_LA_POSTE = 5;
/** Clé du n° de TVA français : (12 + 3 × (SIREN mod 97)) mod 97. */
const TVA_MODULO = 97;
const TVA_FACTEUR = 3;
const TVA_CONSTANTE = 12;

export function chiffres(saisie: string | null | undefined): string {
  return (saisie ?? "").replace(/\D/g, "");
}

/** Clé de Luhn : un chiffre doublé qui dépasse 9 se ramène à la somme de ses chiffres (− 9) ; le total doit être un multiple de 10. */
const LUHN_CHIFFRE_MAX = 9;
const LUHN_MODULO = 10;

export function luhnValide(numero: string): boolean {
  if (!/^\d+$/.test(numero)) return false;
  let somme = 0;
  let doubler = false;
  for (let i = numero.length - 1; i >= 0; i--) {
    let n = Number(numero[i]);
    if (doubler) {
      n *= 2;
      if (n > LUHN_CHIFFRE_MAX) n -= LUHN_CHIFFRE_MAX;
    }
    somme += n;
    doubler = !doubler;
  }
  return somme % LUHN_MODULO === 0;
}

/** « FR » et au moins un caractère : en deçà, ce n'est pas un n° de TVA à analyser. */
const LONGUEUR_MIN_TVA = 3;

export function sirenValide(siren: string | null | undefined): boolean {
  const n = chiffres(siren);
  return n.length === LONGUEUR_SIREN && luhnValide(n);
}

export function siretValide(siret: string | null | undefined): boolean {
  const n = chiffres(siret);
  if (n.length !== LONGUEUR_SIRET) return false;
  if (n.startsWith(SIREN_LA_POSTE)) {
    const somme = n.split("").reduce((t, c) => t + Number(c), 0);
    return somme % DIVISEUR_LA_POSTE === 0;
  }
  return luhnValide(n);
}

export function sirenDuSiret(siret: string | null | undefined): string | null {
  const n = chiffres(siret);
  return n.length === LONGUEUR_SIRET ? n.slice(0, LONGUEUR_SIREN) : null;
}

export function cleTvaFr(siren: string | null | undefined): string | null {
  const n = chiffres(siren);
  if (n.length !== LONGUEUR_SIREN) return null;
  // Number(n) reste exact : un SIREN (< 10⁹) tient largement dans un flottant.
  const cle = (TVA_CONSTANTE + TVA_FACTEUR * (Number(n) % TVA_MODULO)) % TVA_MODULO;
  return String(cle).padStart(2, "0");
}

export function tvaIntracomFr(siren: string | null | undefined): string | null {
  const n = chiffres(siren);
  const cle = cleTvaFr(n);
  return cle ? `${PAYS_DEFAUT}${cle}${n}` : null;
}

export interface TvaAnalysee {
  pays: string;
  cle: string;
  siren: string;
  cleNumerique: boolean;
  cleCoherente: boolean;
}

export function analyserTvaIntracom(tva: string | null | undefined): TvaAnalysee | null {
  const brut = (tva ?? "").replace(/\s/g, "").toUpperCase();
  if (brut.length < LONGUEUR_MIN_TVA) return null;
  const pays = brut.slice(0, 2);
  const reste = brut.slice(2);
  if (pays !== PAYS_DEFAUT) return { pays, cle: "", siren: reste, cleNumerique: false, cleCoherente: true };
  const cle = reste.slice(0, 2);
  const siren = reste.slice(2);
  const cleNumerique = /^\d{2}$/.test(cle);
  // Une clé alphabétique est légitime (anciens numéros) : on ne peut que la laisser passer.
  return { pays, cle, siren, cleNumerique, cleCoherente: cleNumerique ? cleTvaFr(siren) === cle : true };
}

export interface Anomalie {
  champ: "siret" | "siren" | "tva_intracom";
  libelle: string;
}

const rempli = (v: string | null | undefined): v is string => v != null && v.trim() !== "";

/** Ce qui est MAL FORMÉ, et rien d'autre : un champ vide n'est jamais une erreur ici. */
export function verifierIdentifiants(e: {
  siret?: string | null;
  siren?: string | null;
  tva_intracom?: string | null;
  pays_code?: string | null;
}): Anomalie[] {
  const anomalies: Anomalie[] = [];
  if (rempli(e.siret) && !siretValide(e.siret)) {
    anomalies.push({ champ: "siret", libelle: "Le SIRET est incorrect : sa clé de contrôle ne tombe pas juste." });
  }
  if (rempli(e.siren) && !sirenValide(e.siren)) {
    anomalies.push({ champ: "siren", libelle: "Le SIREN est incorrect : sa clé de contrôle ne tombe pas juste." });
  }
  const sirenAttendu = sirenDuSiret(e.siret);
  if (rempli(e.siren) && sirenAttendu && chiffres(e.siren) !== sirenAttendu) {
    anomalies.push({
      champ: "siren",
      libelle: `Le SIREN ne correspond pas au SIRET : celui-ci commence par ${sirenAttendu}.`,
    });
  }
  if (rempli(e.tva_intracom)) {
    const tva = analyserTvaIntracom(e.tva_intracom);
    const pays = (e.pays_code || PAYS_DEFAUT).toUpperCase();
    if (tva && tva.pays !== pays) {
      anomalies.push({
        champ: "tva_intracom",
        libelle: `Le n° de TVA commence par ${tva.pays} alors que le pays est ${pays}.`,
      });
    } else if (tva && !tva.cleCoherente) {
      anomalies.push({ champ: "tva_intracom", libelle: "La clé du n° de TVA ne correspond pas au SIREN qu'il contient." });
    }
  }
  return anomalies;
}
