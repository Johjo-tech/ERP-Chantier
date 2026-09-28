import { metierDisplayLabel, type ContexteImpression, type FicheClientImprimable } from "@/modules/documents/impression/gabarit";
import { lieuImprimable, lignesImprimables, type EmetteurImprimable, type LigneDeBase, type LieuDeBase } from "@/modules/documents/impression/pieces";
import { metiersDuBon } from "./metiers";

export interface BonImprimable extends LieuDeBase {
  numero_interne: string | null;
  numero_bc: string | null;
  date: string;
  date_reception: string | null;
  client_nom: string;
  adresse: string | null;
  interlocuteur: string | null;
  conducteur: string | null;
  metiers: unknown;
  metier: string | null;
  /** Le bon d'origine d'un SAV : c'est lui qui fait d'un bon un SAV. */
  bon_commande_parent_id: string | null;
  facturation_adresse: string | null;
  facturation_code_postal: string | null;
  facturation_ville: string | null;
}

/**
 * Le bon de commande tel que l'ancien gabarit le lit (`documentImprimable`,
 * app.js l. 4020) : son numéro est l'interne, à défaut celui du client, et sa
 * date celle de réception. En méta, la référence du CLIENT dès qu'elle existe
 * (BC-80 : 788 bons sur 826 imprimaient un document muet sur la seule
 * référence que le client connaisse), le conducteur et les métiers.
 *
 * `masquerPrix` : la fiche interne vue sans les prix (`!ctx.avecPrix`).
 *
 * Un SAV s'intitule « SAV » : l'ancien l'imprimait « BON DE COMMANDE », et le
 * client recevait pour une reprise sous garantie une pièce qui ressemblait à une
 * nouvelle commande (DEF-REP-04, D-REP-04).
 */
export function contexteBon(b: BonImprimable, lignes: readonly LigneDeBase[], e: EmetteurImprimable, masquerPrix = false, ficheClient: FicheClientImprimable | null = null): ContexteImpression {
  return {
    type: "bonCommande",
    titre: b.bon_commande_parent_id ? "SAV" : "BON DE COMMANDE",
    s: e.s,
    nomSociete: e.nomSociete,
    masquerPrix,
    ficheClient,
    metiers: metiersDuBon(b).map((m) => metierDisplayLabel(m)).filter(Boolean),
    doc: {
      ...lieuImprimable(b),
      numero: b.numero_interne || b.numero_bc || "",
      date: b.date_reception || b.date,
      client: b.client_nom,
      adresse: b.adresse,
      interlocuteur: b.interlocuteur,
      facturationAdresse: b.facturation_adresse,
      facturationCodePostal: b.facturation_code_postal,
      facturationVille: b.facturation_ville,
      numeroBC: b.numero_bc,
      conducteur: b.conducteur,
      lignes: lignesImprimables(lignes),
    },
  };
}
