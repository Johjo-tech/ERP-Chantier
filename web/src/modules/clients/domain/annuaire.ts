import { z } from "zod";
import { adresseElectroniqueParDefaut } from "./efacture";
import { tvaIntracomFr } from "./identifiants";

/**
 * L'annuaire public des entreprises (recherche-entreprises.api.gouv.fr, sans
 * clé) tel que l'ancien écran le lisait (`src/integrations/entreprise.ts`,
 * parité : tests/parite/annuaire.essai.ts). Pur : la réponse de l'API entre,
 * un résultat sort ; l'appel lui-même vit dans `api/annuaire.ts`.
 */

const etab = z.object({
  siret: z.string().nullish(),
  adresse: z.string().nullish(),
  code_postal: z.string().nullish(),
  libelle_commune: z.string().nullish(),
  activite_principale: z.string().nullish(),
  etat_administratif: z.string().nullish(),
  est_siege: z.boolean().nullish(),
});
const dirigeant = z.object({
  nom: z.string().nullish(),
  prenoms: z.string().nullish(),
  qualite: z.string().nullish(),
  denomination: z.string().nullish(),
});
export const schemaEntrepriseApi = z.object({
  siren: z.string().nullish(),
  nom_complet: z.string().nullish(),
  nature_juridique: z.string().nullish(),
  siege: etab.nullish(),
  matching_etablissements: z.array(etab).nullish(),
  dirigeants: z.array(dirigeant.passthrough()).nullish(),
  tva: z.array(z.string()).nullish(),
  etat_administratif: z.string().nullish(),
  date_fermeture: z.string().nullish(),
});
export const schemaReponseAnnuaire = z.object({ results: z.array(schemaEntrepriseApi.passthrough()).nullish() });
export type EntrepriseApi = z.infer<typeof schemaEntrepriseApi>;
type EtabApi = z.infer<typeof etab>;
type DirigeantApi = z.infer<typeof dirigeant>;

export interface EtablissementTrouve {
  siret: string;
  siren: string;
  nom: string;
  adresse: string;
  codePostal: string;
  ville: string;
  /** Code APE/NAF de l'activité principale. */
  activite: string;
  estSiege: boolean;
  /** Catégorie juridique INSEE : elle porte le caractère public de l'acheteur. */
  formeJuridique: string;
  /** Celui de l'annuaire s'il le donne (il fait foi : une entreprise peut ne pas être assujettie), sinon calculé. */
  tvaIntracom: string;
  tvaConfirmee: boolean;
  dirigeant: string;
  dirigeantQualite: string;
  /** Faux pour une entreprise CESSÉE au registre. */
  active: boolean;
  dateFermeture: string;
}

export type CodeEchec = "NON_TROUVE" | "ETABLISSEMENT_FERME" | "API" | "QUOTA";

export type ResultatEntreprise =
  | { type: "siret"; etablissement: EtablissementTrouve; formeJuridique: string }
  | { type: "siren"; siren: string; nomEntreprise: string; formeJuridique: string; etablissements: EtablissementTrouve[] }
  | { type: "nom"; etablissements: EtablissementTrouve[] }
  | { type: "erreur"; code: CodeEchec; message: string };

/** Les caractères d'une commune (« LYON (69003) ») ne doivent pas devenir des opérateurs de motif. */
export function echapperRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** L'API renvoie parfois « 12 RUE X 75001 PARIS » : on retire code postal et ville. */
export function nettoyerAdresse(adresse: string, codePostal: string, ville: string): string {
  if (!adresse) return "";
  const a = adresse.trim();
  if (!codePostal) return a;
  const cp = echapperRegex(codePostal);
  const v = echapperRegex(ville);
  const sansCpVille = a.replace(new RegExp(`\\s*${cp}\\s*${v}.*$`, "i"), "").trim();
  if (sansCpVille && sansCpVille !== a) return sansCpVille;
  const sansCp = a.replace(new RegExp(`\\s*${cp}.*$`, "i"), "").trim();
  return sansCp || a;
}

/** Le dirigeant en une ligne : « CHOUMANE (CHOUMANE) » ne répète pas le patronyme ; une personne morale a sa dénomination. */
export function nomDuDirigeant(d: DirigeantApi | undefined | null): string {
  if (!d) return "";
  if (d.denomination) return d.denomination.trim();
  const brut = d.nom ?? "";
  const patronyme = brut
    .replace(/\s*\(([^)]*)\)\s*$/, (tout, entre: string) => (entre.trim().toUpperCase() === brut.replace(/\s*\(.*$/, "").trim().toUpperCase() ? "" : tout))
    .trim();
  return [(d.prenoms ?? "").trim(), patronyme].filter(Boolean).join(" ");
}

/** Ce que l'annuaire sait de l'ENTREPRISE ; un état inconnu est « active » : on n'alarme pas sur une donnée absente. */
function identiteEntreprise(siren: string, e: EntrepriseApi | undefined) {
  const premier = (e?.dirigeants ?? [])[0];
  const tvaAnnuaire = (e?.tva ?? []).find((n) => typeof n === "string" && n.trim());
  return {
    tvaIntracom: (tvaAnnuaire ?? tvaIntracomFr(siren) ?? "").trim(),
    tvaConfirmee: Boolean(tvaAnnuaire),
    dirigeant: nomDuDirigeant(premier),
    dirigeantQualite: (premier?.qualite ?? "").trim(),
    active: (e?.etat_administratif ?? "A").toUpperCase() !== "C",
    dateFermeture: (e?.date_fermeture ?? "").trim(),
  };
}

function versEtablissement(e: EtabApi, siren: string, nom: string, estSiege: boolean, formeJuridique: string, entreprise?: EntrepriseApi): EtablissementTrouve {
  const codePostal = e.code_postal ?? "";
  const ville = e.libelle_commune ?? "";
  return {
    siret: e.siret ?? "",
    siren,
    nom,
    adresse: nettoyerAdresse(e.adresse ?? "", codePostal, ville),
    codePostal,
    ville,
    activite: e.activite_principale ?? "",
    estSiege,
    formeJuridique,
    ...identiteEntreprise(siren, entreprise),
  };
}

export const LONGUEURS_NUMERO = [9, 14] as const;

/** Une saisie de 9 ou 14 chiffres est un numéro ; le reste, une raison sociale. */
export function estUnNumero(saisie: string): boolean {
  const n = saisie.replace(/[^0-9]/g, "").length;
  return (LONGUEURS_NUMERO as readonly number[]).includes(n);
}

/** Combien de résultats demander : cinq pour un nom, un seul pour un numéro. */
export const RESULTATS_PAR_NOM = 5;
export const RESULTATS_PAR_NUMERO = 1;

/**
 * Ce que dit la réponse de l'annuaire, pour une saisie donnée. Un SIRET fermé
 * est signalé plutôt que rendu : on ne facture pas un établissement qui
 * n'existe plus.
 */
export function interpreterReponse(saisie: string, resultats: readonly EntrepriseApi[]): ResultatEntreprise {
  const brut = saisie.trim();
  const chiffres = brut.replace(/[^0-9]/g, "");
  if (!estUnNumero(brut)) {
    const etablissements = resultats
      .filter((e): e is EntrepriseApi & { siege: EtabApi } => !!e.siege)
      .map((e) => versEtablissement(e.siege, e.siren ?? "", e.nom_complet ?? "", true, e.nature_juridique ?? "", e));
    return etablissements.length ? { type: "nom", etablissements } : { type: "erreur", code: "NON_TROUVE", message: "Aucun résultat" };
  }
  const ent = resultats[0];
  if (!ent) return { type: "erreur", code: "NON_TROUVE", message: "Entreprise introuvable" };
  const siren = ent.siren ?? "";
  const nom = ent.nom_complet ?? "";
  const formeJuridique = ent.nature_juridique ?? "";
  const siege = ent.siege ?? undefined;
  const autres = ent.matching_etablissements ?? [];

  if (chiffres.length === 9) {
    const etablissements: EtablissementTrouve[] = [];
    if (siege?.etat_administratif === "A") etablissements.push(versEtablissement(siege, siren, `${nom} (Siège)`, true, formeJuridique, ent));
    for (const e of autres) if (e.etat_administratif === "A" && e.est_siege !== true) etablissements.push(versEtablissement(e, siren, nom, false, formeJuridique, ent));
    return etablissements.length
      ? { type: "siren", siren, nomEntreprise: nom, formeJuridique, etablissements }
      : { type: "erreur", code: "NON_TROUVE", message: "Aucun établissement ouvert pour ce SIREN" };
  }

  const candidats = [...(siege ? [{ e: siege, estSiege: true }] : []), ...autres.map((e) => ({ e, estSiege: e.est_siege === true }))];
  const trouve = candidats.find((c) => c.e.siret === chiffres);
  if (!trouve) {
    return {
      type: "erreur",
      code: "ETABLISSEMENT_FERME",
      message: siege?.siret ? `L'établissement ${chiffres} est fermé ou inexistant. Siège actif : ${siege.siret}.` : `L'établissement ${chiffres} est fermé ou inexistant.`,
    };
  }
  if (trouve.e.etat_administratif !== "A") return { type: "erreur", code: "ETABLISSEMENT_FERME", message: `L'établissement ${chiffres} est fermé administrativement.` };
  return { type: "siret", formeJuridique, etablissement: versEtablissement(trouve.e, siren, nom, trouve.estSiege, formeJuridique, ent) };
}

/** Les établissements proposés au choix, quel que soit le type de réponse. */
export function etablissementsDe(r: ResultatEntreprise): EtablissementTrouve[] {
  if (r.type === "siret") return [r.etablissement];
  if (r.type === "erreur") return [];
  return r.etablissements;
}

/** Les champs de la fiche client que l'annuaire sait remplir. */
export interface ChampsAnnuaire {
  nom: string;
  siret: string;
  siren: string;
  adresse: string;
  code_postal: string;
  ville: string;
  tva_intracom: string;
  adresse_electronique_valeur: string;
  adresse_electronique_schema: string;
}

/**
 * Ce qu'un établissement choisi écrit sur la fiche (CLI-23, `appliquerEtablissement`) :
 * nom, adresse, code postal, ville, SIRET et SIREN sont ÉCRASÉS — c'est
 * l'identité qu'on vient de choisir ; TVA et adresse électronique ne remplissent
 * que le VIDE — une saisie manuelle survit à une nouvelle recherche.
 */
export function appliquerEtablissement(actuels: ChampsAnnuaire, e: EtablissementTrouve): Partial<ChampsAnnuaire> {
  const siVide = (cle: keyof ChampsAnnuaire, v: string) => (actuels[cle].trim() || !v ? {} : { [cle]: v });
  const adr = adresseElectroniqueParDefaut(e);
  return {
    siret: e.siret,
    nom: e.nom,
    adresse: e.adresse,
    code_postal: e.codePostal,
    ville: e.ville,
    siren: e.siren,
    ...siVide("tva_intracom", e.tvaIntracom),
    ...(adr ? { ...siVide("adresse_electronique_valeur", adr.valeur), ...siVide("adresse_electronique_schema", adr.schema) } : {}),
  };
}

/**
 * Le mot après remplissage. Une entreprise radiée n'est pas bloquée — reprendre
 * une créance antérieure à la radiation est légitime — mais l'avertissement
 * REMPLACE le « champs remplis ».
 */
export function messageApresRemplissage(e: EtablissementTrouve, formatDate: (iso: string) => string): { texte: string; alerte: boolean } {
  if (!e.active) {
    const quand = e.dateFermeture ? ` le ${formatDate(e.dateFermeture)}` : "";
    return { texte: `⚠ Entreprise radiée${quand} au registre — champs remplis. Vérifiez avant d'émettre un document.`, alerte: true };
  }
  return { texte: "Champs remplis.", alerte: false };
}

/** Moins de trois lettres ne font pas une recherche par nom ; un numéro complet, si. */
export const CARACTERES_MINIMUM = 3;

export function rechercheParNomPossible(saisie: string): boolean {
  const q = saisie.trim();
  return !!q && (q.length >= CARACTERES_MINIMUM || estUnNumero(q));
}
