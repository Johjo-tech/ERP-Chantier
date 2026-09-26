import { supabase } from "@/lib/supabase";
import { analyserReponse, type ExtractionBC } from "../domain/contrat";
import { DELAI_BASCULE_ANALYSE_MS, DELAI_LECTURE_MS, essentielsManquants, type EtapeLecture } from "../domain/lecture";

/** 32 Kio par appel : bien en deçà de la limite d'arguments des moteurs JavaScript. */
const TRANCHE_OCTETS = 0x8000;

function enBase64(octets: ArrayBuffer): string {
  const vue = new Uint8Array(octets);
  let binaire = "";
  // Par tranches : String.fromCharCode(...vue) déborde la pile sur un PDF de quelques Mo.
  for (let i = 0; i < vue.length; i += TRANCHE_OCTETS) binaire += String.fromCharCode(...vue.subarray(i, i + TRANCHE_OCTETS));
  return btoa(binaire);
}

/** Les trois issues d'une lecture qui n'aboutit pas ont chacune leur écran (OCR-03). */
export type IssueLecture = "annule" | "delai" | "echec";

export class LectureImpossible extends Error {
  constructor(
    message: string,
    readonly issue: IssueLecture = "echec"
  ) {
    super(message);
    this.name = "LectureImpossible";
  }
}

export interface LectureReussie {
  extraction: ExtractionBC;
  /** Le document tel qu'il est parti (converti ou allégé) : c'est lui que le bon retiendra en pièce jointe (OCR-04). */
  fichier: File;
}

async function messageDuRefus(error: unknown): Promise<string | null> {
  const corps: unknown = await (error as { context?: Response }).context?.json?.().catch((e: unknown) => {
    console.warn("Réponse d'erreur illisible :", e);
    return null;
  });
  return typeof corps === "object" && corps && "erreur" in corps ? String((corps as { erreur: unknown }).erreur) : null;
}

/**
 * Envoie le document PRÉPARÉ (`preparerDocument`) à l'Edge Function `extraire-bc` (OCR puis
 * extraction structurée, côté serveur : la clé du fournisseur ne quitte jamais
 * le serveur) et valide sa réponse. Rend toujours la main : délai de 120 s.
 * `onEtape` suit la progression, passant d'« envoi » à « analyse » au bout de
 * deux secondes — le navigateur ne sait pas les distinguer.
 */
export async function extraireBonCommande(fichier: File, signal?: AbortSignal, onEtape: (e: EtapeLecture) => void = () => undefined): Promise<LectureReussie> {
  onEtape("encodage");
  const fichierBase64 = enBase64(await fichier.arrayBuffer());
  const delai = AbortSignal.timeout(DELAI_LECTURE_MS);
  onEtape("envoi");
  const bascule = window.setTimeout(() => onEtape("analyse"), DELAI_BASCULE_ANALYSE_MS);
  const { data, error } = await supabase()
    .functions.invoke("extraire-bc", { body: { fichierBase64, mimeType: fichier.type }, signal: signal ? AbortSignal.any([signal, delai]) : delai })
    .finally(() => window.clearTimeout(bascule));
  if (error) {
    if (delai.aborted) throw new LectureImpossible("Le service de lecture n'a pas répondu. Réessayez, ou saisissez le bon à la main.", "delai");
    if (signal?.aborted) throw new LectureImpossible("Lecture interrompue : le formulaire reste à saisir à la main.", "annule");
    throw new LectureImpossible((await messageDuRefus(error)) ?? "Lecture impossible : le service a refusé le document.");
  }
  const reponse = analyserReponse(data);
  if (!reponse) {
    console.error("Réponse de lecture illisible", data);
    throw new LectureImpossible("La lecture a rendu une réponse illisible : saisissez le bon à la main.");
  }
  if ("erreur" in reponse) throw new LectureImpossible(reponse.erreur);
  const e = reponse.extraction;
  // Une lecture en partie hors contrat se relit avec ses champs douteux vidés, en le disant (OCR-31, D-BC-12).
  const incertaine = reponse.incertaine.length ? [`Lecture partiellement incertaine : ${reponse.incertaine.join(", ")} non retenu(s) — vérifiez-les sur le document.`] : [];
  return { extraction: { ...e, avertissements: [...incertaine, ...e.avertissements, ...essentielsManquants(e)] }, fichier };
}
