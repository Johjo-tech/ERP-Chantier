import { formatDateFr } from "@/lib/dates";
import type { PieceImprimable } from "@/modules/documents/domain/modele";
import { estAvoir, libelleDocument } from "./avoir";
import type { Facture } from "./facture";

/** Ce que la pièce cite d'autres pièces : son devis d'origine, la facture qu'un avoir rectifie. */
export interface ContexteImpression {
  devisNumero: string | null;
  rectifiee: { numero: string | null; date: string } | null;
}

/**
 * La facture (ou l'avoir) telle qu'elle s'imprime — méta de
 * `factureDocMetaLignes` (app.js l. 4203) : échéance, devis, marché, facture
 * rectifiée et motif ; l'identité figée de l'émetteur l'emporte.
 */
export function pieceDeFacture(f: Facture, ctx: ContexteImpression): PieceImprimable {
  const avoir = estAvoir(f.type_document);
  const meta: [string, string][] = [];
  if (f.echeance && !avoir) meta.push(["Date d'échéance", formatDateFr(f.echeance)]);
  if (ctx.devisNumero) meta.push(["Devis", ctx.devisNumero]);
  if (f.ref_marche) meta.push(["Marché", f.ref_marche]);
  // Un avoir désigne la pièce qu'il rectifie et dit pourquoi : sinon, sur quoi l'imputer ?
  if (ctx.rectifiee?.numero) meta.push(["Rectifie la facture", `${ctx.rectifiee.numero} du ${formatDateFr(ctx.rectifiee.date)}`]);
  if (f.motif_rectification) meta.push(["Motif", f.motif_rectification]);
  return {
    type: "facture",
    titre: libelleDocument(f.type_document),
    numero: f.numero,
    date: f.date,
    meta,
    client: { nom: f.client_nom, adresse: f.adresse, siret: f.client_siret, tva: f.client_tva_intracom, interlocuteur: f.interlocuteur },
    lieu: f,
    lignes: f.lignes,
    remise: f.remise_pourcentage,
    signe: avoir ? -1 : 1,
    deductions: avoir ? undefined : { acomptes: f.acomptes_deduits, retenuePct: f.retenue_garantie_pourcentage },
    reglement: avoir ? undefined : { echeance: f.echeance, conditions: f.conditions_reglement, mode: f.mode_paiement },
    emetteurFige: {
      nom: f.emetteur_nom,
      adresse: f.emetteur_adresse,
      code_postal: f.emetteur_code_postal,
      ville: f.emetteur_ville,
      siret: f.emetteur_siret,
      tva_intracom: f.emetteur_tva_intracom,
      iban: f.emetteur_iban,
    },
  };
}
