import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { schemaReponse, type ExtractionBC } from "../domain/contrat";
import { DELAI_LECTURE_MS, essentielsManquants } from "../domain/lecture";

function enBase64(octets: ArrayBuffer): string {
  const vue = new Uint8Array(octets);
  let binaire = "";
  // Par tranches : String.fromCharCode(...vue) déborde la pile sur un PDF de quelques Mo.
  for (let i = 0; i < vue.length; i += 0x8000) binaire += String.fromCharCode(...vue.subarray(i, i + 0x8000));
  return btoa(binaire);
}

export class LectureImpossible extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LectureImpossible";
  }
}

/**
 * Envoie le document à l'Edge Function `extraire-bc` (OCR puis extraction
 * structurée, côté serveur : la clé du fournisseur ne quitte jamais le
 * serveur) et valide sa réponse. Rend toujours la main : délai de 120 s.
 */
export async function extraireBonCommande(fichier: File, signal?: AbortSignal): Promise<ExtractionBC> {
  const fichierBase64 = enBase64(await fichier.arrayBuffer());
  const delai = AbortSignal.timeout(DELAI_LECTURE_MS);
  const { data, error } = await supabase().functions.invoke("extraire-bc", {
    body: { fichierBase64, mimeType: fichier.type },
    signal: signal ? AbortSignal.any([signal, delai]) : delai,
  });
  if (error) {
    if (delai.aborted) throw new LectureImpossible("Le service de lecture n'a pas répondu. Réessayez, ou saisissez le bon à la main.");
    if (signal?.aborted) throw new LectureImpossible("Lecture interrompue : le formulaire reste à saisir à la main.");
    const corps: unknown = await (error as { context?: Response }).context?.json?.().catch((e: unknown) => {
      console.warn("Réponse d'erreur illisible :", e);
      return null;
    });
    const message = typeof corps === "object" && corps && "erreur" in corps ? String((corps as { erreur: unknown }).erreur) : null;
    throw new LectureImpossible(message ?? "Lecture impossible : le service a refusé le document.");
  }
  const reponse = analyser(schemaReponse, data, "lecture du bon");
  if ("erreur" in reponse) throw new LectureImpossible(reponse.erreur);
  const e = reponse.extraction;
  return { ...e, avertissements: [...e.avertissements, ...essentielsManquants(e)] };
}
