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
   * N° de TVA intracommunautaire.
   *
   * L'annuaire le renvoie — contrairement à ce qu'affirmait ce commentaire —
   * et c'est lui qui fait foi : la clé française se calcule, mais le calcul ne
   * peut pas deviner qu'une entreprise n'est PAS assujettie. On retombe sur le
   * calcul quand l'annuaire se tait.
   */
  tvaIntracom: string;
  /** Vrai quand l'annuaire donne le numéro, faux quand il est calculé. */
  tvaConfirmee: boolean;
  /**
   * Le dirigeant, tel que le registre national des entreprises le déclare.
   *
   * Vide pour une personne morale sans dirigeant publié, ou lorsque
   * l'entreprise a demandé la non-diffusion de ses données.
   */
  dirigeant: string;
  /** Sa qualité : « Président de SAS », « Gérant »… */
  dirigeantQualite: string;
  /**
   * Faux pour une entreprise CESSÉE.
   *
   * L'annuaire le dit, on ne le regardait pas : on pouvait donc adresser un
   * devis ou une facture à une société radiée sans que rien ne le signale.
   */
  active: boolean;
  /** Date de fermeture si elle est connue, pour le dire dans l'avertissement. */
  dateFermeture: string;
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
      code: "NON_TROUVE" | "ETABLISSEMENT_FERME" | "API" | "QUOTA";
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

interface DirigeantApi {
  nom?: string;
  prenoms?: string;
  qualite?: string;
  denomination?: string;
  type_dirigeant?: string;
}

interface EntrepriseApi {
  siren?: string;
  nom_complet?: string;
  nature_juridique?: string;
  siege?: EtabApi;
  matching_etablissements?: EtabApi[];
  dirigeants?: DirigeantApi[];
  tva?: string[] | null;
  etat_administratif?: string;
  date_fermeture?: string | null;
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

/**
 * Le dirigeant en une ligne lisible.
 *
 * L'annuaire répète parfois le patronyme — « CHOUMANE (CHOUMANE) » — et range
 * le prénom à part. Une personne morale n'a ni l'un ni l'autre, mais une
 * dénomination. On rend ce qui se lit, ou rien.
 */
export function nomDuDirigeant(d: DirigeantApi | undefined): string {
  if (!d) return "";
  if (d.denomination) return d.denomination.trim();
  const patronyme = (d.nom ?? "").replace(/\s*\(([^)]*)\)\s*$/, (tout, entre) =>
    entre.trim().toUpperCase() === (d.nom ?? "").replace(/\s*\(.*$/, "").trim().toUpperCase() ? "" : tout
  ).trim();
  return [(d.prenoms ?? "").trim(), patronyme].filter(Boolean).join(" ");
}

function mapper(
  etab: EtabApi,
  siren: string,
  nom: string,
  estSiege: boolean,
  formeJuridique: string,
  entreprise?: EntrepriseApi
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
    ...identiteEntreprise(siren, entreprise),
  };
}

/**
 * Ce que l'annuaire sait de l'ENTREPRISE, et non de l'établissement.
 *
 * `etat_administratif` vaut « A » (active) ou « C » (cessée) ; toute autre
 * valeur, l'absence comprise, est traitée comme active — on n'alarme pas sur
 * une donnée qu'on n'a pas.
 */
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

const BASE = "https://recherche-entreprises.api.gouv.fr/search";

/* ---------- Tenir le débit, et savoir pourquoi on a échoué ----------

   L'annuaire publie 7 appels par seconde et par IP, et se réserve d'abaisser
   cette limite. Ce module n'en tenait aucun compte : `if (!rep.ok) return null`
   confondait un quota dépassé avec une panne réseau, et l'utilisateur partait
   chercher du côté de sa connexion.

   La file vit ICI, et pas dans l'import qui l'a rendue nécessaire, pour une
   raison de fond : le quota est par IP, et le formulaire client partage cette
   IP. Deux files séparées ne borneraient rien. Et `rep.status` n'est lisible
   que dans le module qui possède le `fetch`. */

/** Sous le plafond de 7 : la limite se franchit avec la taille d'un fichier,
 *  pas avec un changement de code, et la franchir coûte une erreur muette. */
const APPELS_PAR_SECONDE = 6;
const ESPACEMENT_MS = Math.ceil(1000 / APPELS_PAR_SECONDE);
/** En vol simultanément : une API lente ne doit pas ouvrir 39 connexions. */
const CONCURRENCE_MAX = 3;
const TENTATIVES_MAX = 3;
/** Attente par défaut quand l'annuaire ne dit pas `Retry-After`. Doublée. */
const ATTENTE_QUOTA_MS = 1000;
/** Le formulaire redemande la même saisie à chaque reprise de focus, et un
 *  fichier porte deux fois le même numéro. Succès seulement : mettre un échec
 *  en cache figerait une panne passagère pour toute la session. */
const CACHE_MS = 5 * 60 * 1000;
const CACHE_MAX = 500;

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let dernierDepart = 0;
let enVol = 0;
const attente: (() => void)[] = [];

/**
 * Espace les départs et borne les connexions.
 *
 * Le seau percé (`dernierDepart`) borne le DÉBIT quelle que soit la
 * concurrence — ce qu'un simple sémaphore ne fait pas : trois appels
 * simultanés mais instantanés dépasseraient le plafond sans qu'il s'en
 * aperçoive.
 */
async function place(): Promise<void> {
  if (enVol >= CONCURRENCE_MAX) await new Promise<void>((r) => attente.push(r));
  enVol++;
  const maintenant = Date.now();
  const tot = Math.max(0, dernierDepart + ESPACEMENT_MS - maintenant);
  dernierDepart = maintenant + tot;
  if (tot > 0) await dormir(tot);
}

function liberer(): void {
  enVol--;
  attente.shift()?.();
}

const cache = new Map<string, { a: number; v: EntrepriseApi[] }>();

/** Secondes, ou date HTTP : les deux formes existent dans la nature. */
function attenteDemandee(rep: Response): number | null {
  const brut = rep.headers.get("retry-after");
  if (!brut) return null;
  const secondes = Number(brut.trim());
  if (Number.isFinite(secondes) && secondes >= 0) return secondes * 1000;
  const date = Date.parse(brut);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

export type RaisonEchec = "quota" | "reseau" | "api";

async function interroger(
  query: string,
  perPage: number
): Promise<{ ok: true; results: EntrepriseApi[] } | { ok: false; raison: RaisonEchec }> {
  const cle = `${query}|${perPage}`;
  const garde = cache.get(cle);
  if (garde && Date.now() - garde.a < CACHE_MS) return { ok: true, results: garde.v };

  let attenteQuota = ATTENTE_QUOTA_MS;

  for (let tentative = 1; tentative <= TENTATIVES_MAX; tentative++) {
    await place();
    try {
      const rep = await fetch(`${BASE}?q=${encodeURIComponent(query)}&page=1&per_page=${perPage}`, {
        headers: { Accept: "application/json" },
      });

      if (rep.status === 429) {
        const patienter = attenteDemandee(rep) ?? attenteQuota;
        attenteQuota *= 2;
        if (tentative < TENTATIVES_MAX) {
          await dormir(patienter);
          continue;
        }
        return { ok: false, raison: "quota" };
      }

      if (rep.status >= 500) {
        if (tentative < TENTATIVES_MAX) {
          await dormir(attenteQuota);
          attenteQuota *= 2;
          continue;
        }
        return { ok: false, raison: "api" };
      }

      if (!rep.ok) {
        console.warn(`Annuaire des entreprises : réponse ${rep.status} pour « ${query} ».`);
        return { ok: false, raison: "api" };
      }

      const json = (await rep.json()) as { results?: EntrepriseApi[] };
      const results = json.results ?? [];
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
      cache.set(cle, { a: Date.now(), v: results });
      return { ok: true, results };
    } catch (err) {
      /* Le `catch {}` muet d'origine avalait tout : réseau coupé, CORS, DNS.
         Tracer coûte une ligne et fait gagner une heure de diagnostic. */
      console.warn(`Annuaire des entreprises injoignable pour « ${query} » :`, err);
      return { ok: false, raison: "reseau" };
    } finally {
      liberer();
    }
  }
  return { ok: false, raison: "quota" };
}

/** Le message d'un échec, selon sa cause. Un quota n'est pas une panne. */
function messageEchec(raison: RaisonEchec): { code: "QUOTA" | "API"; message: string } {
  return raison === "quota"
    ? {
        code: "QUOTA",
        message: "Annuaire saturé (trop de requêtes) : réessayez dans un instant.",
      }
    : { code: "API", message: "Annuaire des entreprises injoignable" };
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
    const rep = await interroger(brut, 5);
    if (!rep.ok) return { type: "erreur", ...messageEchec(rep.raison) };
    const etablissements = rep.results
      .filter((e) => e.siege)
      .map((e) =>
        mapper(e.siege!, e.siren ?? "", e.nom_complet ?? "", true, e.nature_juridique ?? "", e)
      );
    return etablissements.length
      ? { type: "nom", etablissements }
      : { type: "erreur", code: "NON_TROUVE", message: "Aucun résultat" };
  }

  const rep = await interroger(chiffres, 1);
  if (!rep.ok) return { type: "erreur", ...messageEchec(rep.raison) };

  const ent = rep.results[0];
  if (!ent) return { type: "erreur", code: "NON_TROUVE", message: "Entreprise introuvable" };

  const siren = ent.siren ?? "";
  const nom = ent.nom_complet ?? "";
  const formeJuridique = ent.nature_juridique ?? "";
  const siege = ent.siege;
  const autres = ent.matching_etablissements ?? [];

  if (chiffres.length === 9) {
    const etablissements: EtablissementTrouve[] = [];
    if (siege?.etat_administratif === "A") {
      etablissements.push(mapper(siege, siren, `${nom} (Siège)`, true, formeJuridique, ent));
    }
    for (const etab of autres) {
      if (etab.etat_administratif === "A" && etab.est_siege !== true) {
        etablissements.push(mapper(etab, siren, nom, false, formeJuridique, ent));
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
    etablissement: mapper(trouve.etab, siren, nom, trouve.estSiege, formeJuridique, ent),
  };
}
