import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { analyser } from "@/lib/validation";
import { BUCKET } from "@/modules/societes/api/societe";
import { paletteSociete } from "@/modules/societes/theme/palette";
import { variablesPalette } from "../impression/palette";
import { societeImprimable, type EmetteurImprimable } from "../impression/pieces";
import { cheminLogoDuSeau, lireReglagesImpression, logoDesReglages, type CouleursDocument, type IdentiteEmettrice, type ReglagesImpression } from "../domain/identite";

const schemaSociete = z.object({
  nom: z.string(),
  raison_sociale_legale: z.string().nullable(),
  forme_juridique: z.string().nullable(),
  adresse: z.string().nullable(),
  code_postal: z.string().nullable(),
  ville: z.string().nullable(),
  telephone: z.string().nullable(),
  email: z.string().nullable(),
  siret: z.string().nullable(),
  siren: z.string().nullable(),
  tva_intracom: z.string().nullable(),
  capital_social: z.number().nullable(),
  rcs_numero: z.string().nullable(),
  rcs_ville: z.string().nullable(),
  code_naf: z.string().nullable(),
  iban: z.string().nullable(),
  bic: z.string().nullable(),
  logo_url: z.string().nullable(),
});

export interface IdentiteDocument {
  identite: IdentiteEmettrice;
  reglages: ReglagesImpression;
  /** L'émetteur tel que l'ancien gabarit le lit (`state.settings`, nom d'usage, couleurs). */
  imprimable: EmetteurImprimable;
}

/**
 * Ce qu'un document imprime de son émetteur : colonnes légales de `societes`
 * + réglages d'impression du JSON `societe_settings.infos_entreprise` (comme
 * `lireSettings` de html-adapter.ts, qui recomposait les deux).
 */
export async function lireIdentiteDocument(societeId: string): Promise<IdentiteDocument> {
  const db = supabase();
  const [societe, reglages] = await Promise.all([
    db.from("societes").select(Object.keys(schemaSociete.shape).join(", ")).eq("id", societeId).single(),
    db.from("societe_settings").select("infos_entreprise").eq("societe_id", societeId).maybeSingle(),
  ]);
  if (societe.error) throw societe.error;
  if (reglages.error) throw reglages.error;
  const s = analyser(schemaSociete, societe.data, "identité de l'émetteur");
  const infos = reglages.data?.infos_entreprise ?? null;
  const impression = lireReglagesImpression(infos);
  const chemin = cheminLogoDuSeau(infos, s.logo_url, societeId);
  const logo = chemin ? await logoDuSeau(chemin) : logoDesReglages(infos, s.logo_url);
  const { afficherIban, conditionsDevis, mentionsComplementaires, piedDePage, siteWeb } = impression;
  return {
    imprimable: {
      s: societeImprimable(s, infos, logo, { documents: { afficherIban, conditionsDevis, mentionsComplementaires, piedDePage, siteWeb } }),
      nomSociete: s.nom,
      variables: variablesPalette(paletteSociete(impression.couleurAccent, impression.couleurSecondaire)),
    },
    identite: {
      // La raison sociale AVANT le nom d'usage : c'est elle que le client doit lire.
      nom: s.raison_sociale_legale || s.nom,
      formeJuridique: s.forme_juridique,
      adresse: s.adresse,
      codePostal: s.code_postal,
      ville: s.ville,
      telephone: s.telephone,
      email: s.email,
      siret: s.siret,
      siren: s.siren,
      tvaIntracom: s.tva_intracom,
      capitalSocial: s.capital_social,
      rcsNumero: s.rcs_numero,
      rcsVille: s.rcs_ville,
      codeNaf: s.code_naf,
      iban: s.iban,
      bic: s.bic,
      logo,
      couleurs: couleursDocument(impression),
    },
    reglages: impression,
  };
}

/** La palette de l'écran, réduite à ce qu'imprime une pièce (SOC-04, D-TRV-10). */
export function couleursDocument(r: Pick<ReglagesImpression, "couleurAccent" | "couleurSecondaire">): CouleursDocument {
  const p = paletteSociete(r.couleurAccent, r.couleurSecondaire);
  return { accent: p.accent, accentFonce: p.accentFonce, secondaire: p.secondaire, surSecondaire: p.surSecondaire };
}

function enDataUrl(blob: Blob): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => (typeof lecteur.result === "string" ? resoudre(lecteur.result) : rejeter(new Error("Logo illisible.")));
    lecteur.onerror = () => rejeter(lecteur.error ?? new Error("Logo illisible."));
    lecteur.readAsDataURL(blob);
  });
}

/**
 * Le logo du seau, en data-URL : le PDF se compose sans réseau. Un logo
 * introuvable ou illisible ne doit jamais empêcher d'imprimer une facture —
 * elle part sans, et on le dit en console.
 */
async function logoDuSeau(chemin: string): Promise<string | null> {
  const { data, error } = await supabase().storage.from(BUCKET).download(chemin);
  if (error) {
    console.warn("Logo introuvable dans le seau, document imprimé sans logo :", chemin, error);
    return null;
  }
  try {
    const url = await enDataUrl(data);
    return /^data:image\/(png|jpe?g);base64,/i.test(url) ? url : null;
  } catch (e) {
    console.warn("Logo illisible, document imprimé sans logo :", chemin, e);
    return null;
  }
}
