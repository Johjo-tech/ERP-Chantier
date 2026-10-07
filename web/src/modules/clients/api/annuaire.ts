import { SECONDE_MS } from "@/lib/durees";
import { analyser } from "@/lib/validation";
import {
  estUnNumero,
  interpreterReponse,
  RESULTATS_PAR_NOM,
  RESULTATS_PAR_NUMERO,
  schemaReponseAnnuaire,
  type EntrepriseApi,
  type ResultatEntreprise,
} from "../domain/annuaire";

/**
 * L'appel à l'annuaire public des entreprises (gratuit, sans clé, CORS
 * ouvert) — celui de l'ancien écran (`src/integrations/entreprise.ts`).
 *
 * L'annuaire publie 7 appels par seconde et par IP : on espace les départs,
 * on borne les connexions, et un quota dépassé (429) se dit comme tel — ce
 * n'est pas une panne réseau. Une file UNIQUE pour toute l'application : le
 * quota est par IP, deux files ne borneraient rien.
 */
const URL_ANNUAIRE = "https://recherche-entreprises.api.gouv.fr/search";
/** Sous le plafond de 7 : le franchir coûte une erreur. */
const APPELS_PAR_SECONDE = 6;
const ESPACEMENT_MS = Math.ceil(1000 / APPELS_PAR_SECONDE);
const CONCURRENCE_MAX = 3;
const TENTATIVES_MAX = 3;
/** Attente quand l'annuaire ne dit pas `Retry-After` ; doublée à chaque tentative. */
const ATTENTE_QUOTA_MS = 1000;
/** Succès seulement : mettre un échec en cache figerait une panne passagère. */
const CACHE_MS = 5 * 60 * 1000;
const CACHE_MAX = 500;
const HTTP_QUOTA = 429;
const HTTP_ERREUR_SERVEUR = 500;

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
let dernierDepart = 0;
let enVol = 0;
const attente: (() => void)[] = [];
const cache = new Map<string, { a: number; v: EntrepriseApi[] }>();

/** Le seau percé borne le DÉBIT quelle que soit la concurrence ; le compteur borne les connexions. */
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

function attenteDemandee(rep: Response): number | null {
  const brut = rep.headers.get("retry-after");
  if (!brut) return null;
  const secondes = Number(brut.trim());
  if (Number.isFinite(secondes) && secondes >= 0) return secondes * SECONDE_MS;
  const date = Date.parse(brut);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
}

type Raison = "quota" | "reseau" | "api";

async function interroger(requete: string, parPage: number): Promise<{ ok: true; resultats: EntrepriseApi[] } | { ok: false; raison: Raison }> {
  const cle = `${requete}|${parPage}`;
  const garde = cache.get(cle);
  if (garde && Date.now() - garde.a < CACHE_MS) return { ok: true, resultats: garde.v };
  let attenteQuota = ATTENTE_QUOTA_MS;
  for (let tentative = 1; tentative <= TENTATIVES_MAX; tentative++) {
    await place();
    try {
      const rep = await fetch(`${URL_ANNUAIRE}?q=${encodeURIComponent(requete)}&page=1&per_page=${parPage}`, { headers: { Accept: "application/json" } });
      if (rep.status === HTTP_QUOTA || rep.status >= HTTP_ERREUR_SERVEUR) {
        const patienter = (rep.status === HTTP_QUOTA ? attenteDemandee(rep) : null) ?? attenteQuota;
        attenteQuota *= 2;
        if (tentative < TENTATIVES_MAX) {
          await dormir(patienter);
          continue;
        }
        return { ok: false, raison: rep.status === HTTP_QUOTA ? "quota" : "api" };
      }
      if (!rep.ok) {
        console.warn(`Annuaire des entreprises : réponse ${rep.status} pour « ${requete} ».`);
        return { ok: false, raison: "api" };
      }
      const resultats = analyser(schemaReponseAnnuaire, await rep.json(), "annuaire des entreprises").results ?? [];
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
      cache.set(cle, { a: Date.now(), v: resultats });
      return { ok: true, resultats };
    } catch (e) {
      console.warn(`Annuaire des entreprises injoignable pour « ${requete} » :`, e);
      return { ok: false, raison: "reseau" };
    } finally {
      liberer();
    }
  }
  return { ok: false, raison: "quota" };
}

function echec(raison: Raison): ResultatEntreprise {
  return raison === "quota"
    ? { type: "erreur", code: "QUOTA", message: "Annuaire saturé (trop de requêtes) : réessayez dans un instant." }
    : { type: "erreur", code: "API", message: "Annuaire des entreprises injoignable" };
}

/** Recherche par SIREN (9 chiffres), SIRET (14) ou raison sociale. */
export async function rechercherEntreprise(saisie: string): Promise<ResultatEntreprise> {
  const brut = saisie.trim();
  if (!brut) return { type: "erreur", code: "NON_TROUVE", message: "Saisie vide" };
  const numero = estUnNumero(brut);
  const rep = await interroger(numero ? brut.replace(/[^0-9]/g, "") : brut, numero ? RESULTATS_PAR_NUMERO : RESULTATS_PAR_NOM);
  return rep.ok ? interpreterReponse(brut, rep.resultats) : echec(rep.raison);
}

/** Pour les tests : une file et un cache neufs. */
export function reinitialiserAnnuaire(): void {
  cache.clear();
  dernierDepart = 0;
}
