/**
 * Recherche d'entreprise via l'annuaire public
 * (recherche-entreprises.api.gouv.fr — gratuite, sans clé).
 *
 * Porté depuis chantier-mate-ease. Trois apports par rapport à la recherche
 * par nom que faisait déjà l'app : interrogation par SIREN ou SIRET, distinction
 * du siège et des établissements, et rejet des établissements fermés.
 */

import { tvaIntracomFr } from "@/api/regles-efacture";

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
  /** Catégorie juridique INSEE — elle porte le caractère public de l'acheteur. */
  formeJuridique: string;
  /**
   * N° de TVA intracommunautaire, déduit du SIREN.
   *
   * L'annuaire ne le renvoie pas : la clé française se calcule. Le proposer ici
   * évite de le faire saisir, donc de se tromper — quitte à le corriger si
   * l'entreprise n'est pas assujettie.
   */
  tvaIntracom: string;
}

export type ResultatEntreprise =
  | { type: "siret"; etablissement: EtablissementTrouve; formeJuridique: string }
  | {
      type: "siren";
      siren: string;
      nomEntreprise: string;
      formeJuridique: string;
      etablissements: EtablissementTrouve[];
    }
  | { type: "nom"; etablissements: EtablissementTrouve[] }
  | {
      type: "erreur";
      code: "NON_TROUVE" | "ETABLISSEMENT_FERME" | "API";
      message: string;
    };

interface EtabApi {
  siret?: string;
  adresse?: string;
  code_postal?: string;
  libelle_commune?: string;
  activite_principale?: string;
  etat_administratif?: string;
  est_siege?: boolean;
}

interface EntrepriseApi {
  siren?: string;
  nom_complet?: string;
  nature_juridique?: string;
  siege?: EtabApi;
  matching_etablissements?: EtabApi[];
}

/**
 * Rend une chaîne inoffensive dans un motif d'expression régulière.
 *
 * Les noms de communes françaises contiennent des parenthèses et des points —
 * « SAINTE-FOY-LÈS-LYON », « L'ISLE-D'ABEAU », et surtout les libellés INSEE du
 * type « LYON (69003) ». Injectés tels quels, ces caractères sont interprétés
 * comme des opérateurs : au mieux le nettoyage ne trouve rien, au pire
 * `new RegExp` lève sur une parenthèse non fermée et fait échouer toute la
 * recherche d'entreprise.
 */
export function echapperRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** L'API renvoie parfois « 12 RUE X 75001 PARIS » : on retire CP et ville.
 *  Exportée pour être éprouvée seule : c'est là que les caractères spéciaux
 *  d'un nom de commune faisaient tout basculer. */
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

function mapper(
  etab: EtabApi,
  siren: string,
  nom: string,
  estSiege: boolean,
  formeJuridique: string
): EtablissementTrouve {
  const codePostal = etab.code_postal ?? "";
  const ville = etab.libelle_commune ?? "";
  return {
    siret: etab.siret ?? "",
    siren,
    nom,
    adresse: nettoyerAdresse(etab.adresse ?? "", codePostal, ville),
    codePostal,
    ville,
    activite: etab.activite_principale ?? "",
    estSiege,
    formeJuridique,
    tvaIntracom: tvaIntracomFr(siren) ?? "",
  };
}

const BASE = "https://recherche-entreprises.api.gouv.fr/search";

async function interroger(query: string, perPage: number): Promise<EntrepriseApi[] | null> {
  try {
    const rep = await fetch(`${BASE}?q=${encodeURIComponent(query)}&page=1&per_page=${perPage}`, {
      headers: { Accept: "application/json" },
    });
    if (!rep.ok) return null;
    const json = (await rep.json()) as { results?: EntrepriseApi[] };
    return json.results ?? [];
  } catch {
    return null;
  }
}

/**
 * Recherche par SIREN (9 chiffres), SIRET (14) ou raison sociale.
 *
 * Un SIRET fermé est signalé plutôt que retourné : l'app ne doit pas facturer
 * un établissement qui n'existe plus.
 */
export async function rechercherEntreprise(saisie: string): Promise<ResultatEntreprise> {
  const brut = saisie.trim();
  if (!brut) return { type: "erreur", code: "NON_TROUVE", message: "Saisie vide" };

  const chiffres = brut.replace(/[^0-9]/g, "");
  const estNumero = chiffres.length === 9 || chiffres.length === 14;

  // Recherche par nom : on rend simplement les établissements correspondants
  if (!estNumero) {
    const results = await interroger(brut, 5);
    if (results === null) {
      return { type: "erreur", code: "API", message: "Annuaire des entreprises injoignable" };
    }
    const etablissements = results
      .filter((e) => e.siege)
      .map((e) =>
        mapper(e.siege!, e.siren ?? "", e.nom_complet ?? "", true, e.nature_juridique ?? "")
      );
    return etablissements.length
      ? { type: "nom", etablissements }
      : { type: "erreur", code: "NON_TROUVE", message: "Aucun résultat" };
  }

  const results = await interroger(chiffres, 1);
  if (results === null) {
    return { type: "erreur", code: "API", message: "Annuaire des entreprises injoignable" };
  }

  const ent = results[0];
  if (!ent) return { type: "erreur", code: "NON_TROUVE", message: "Entreprise introuvable" };

  const siren = ent.siren ?? "";
  const nom = ent.nom_complet ?? "";
  const formeJuridique = ent.nature_juridique ?? "";
  const siege = ent.siege;
  const autres = ent.matching_etablissements ?? [];

  if (chiffres.length === 9) {
    const etablissements: EtablissementTrouve[] = [];
    if (siege?.etat_administratif === "A") {
      etablissements.push(mapper(siege, siren, `${nom} (Siège)`, true, formeJuridique));
    }
    for (const etab of autres) {
      if (etab.etat_administratif === "A" && etab.est_siege !== true) {
        etablissements.push(mapper(etab, siren, nom, false, formeJuridique));
      }
    }
    return etablissements.length
      ? { type: "siren", siren, nomEntreprise: nom, formeJuridique, etablissements }
      : {
          type: "erreur",
          code: "NON_TROUVE",
          message: "Aucun établissement ouvert pour ce SIREN",
        };
  }

  const candidats = [
    ...(siege ? [{ etab: siege, estSiege: true }] : []),
    ...autres.map((etab) => ({ etab, estSiege: etab.est_siege === true })),
  ];
  const trouve = candidats.find((c) => c.etab.siret === chiffres);

  if (!trouve) {
    return {
      type: "erreur",
      code: "ETABLISSEMENT_FERME",
      message: siege?.siret
        ? `L'établissement ${chiffres} est fermé ou inexistant. Siège actif : ${siege.siret}.`
        : `L'établissement ${chiffres} est fermé ou inexistant.`,
    };
  }

  if (trouve.etab.etat_administratif !== "A") {
    return {
      type: "erreur",
      code: "ETABLISSEMENT_FERME",
      message: `L'établissement ${chiffres} est fermé administrativement.`,
    };
  }

  return {
    type: "siret",
    formeJuridique,
    etablissement: mapper(trouve.etab, siren, nom, trouve.estSiege, formeJuridique),
  };
}
