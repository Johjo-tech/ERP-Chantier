import { z } from "zod";
import { schemaNombreFr } from "@/lib/nombres";
import { videEnNull } from "@/lib/validation";

export const schemaNouvelleLigneDpgf = z
  .object({
    type: z.enum(["ligne", "chapitre"]),
    designation: z.string().trim().min(1, "La désignation est obligatoire."),
    quantite: z.string(),
    prix_unitaire: z.string(),
    unite: z.string(),
  })
  .transform((l, ctx) => {
    if (l.type === "chapitre") {
      return { type: l.type, designation: l.designation, quantite: 0, prix_unitaire: 0, unite: null };
    }
    const q = schemaNombreFr.safeParse(l.quantite);
    const p = schemaNombreFr.safeParse(l.prix_unitaire);
    if (!q.success) ctx.addIssue({ code: "custom", path: ["quantite"], message: "Quantité invalide." });
    if (!p.success) ctx.addIssue({ code: "custom", path: ["prix_unitaire"], message: "Prix invalide." });
    if (!q.success || !p.success) return z.NEVER;
    return { type: l.type, designation: l.designation, quantite: q.data, prix_unitaire: p.data, unite: l.unite.trim() || null };
  });

/**
 * Une ligne modifiée en place dans le tableau (CHA-06, CHA-07). Les champs
 * restent des chaînes jusqu'à l'enregistrement : c'est ce qui permet de saisir
 * plusieurs lignes puis d'enregistrer d'un coup sans rien perdre — l'ancien
 * « + Ligne » effaçait les saisies non enregistrées (CHA-53).
 */
export interface BrouillonLigneDpgf {
  id: string;
  type: "ligne" | "chapitre" | "commentaire";
  designation: string;
  quantite: string;
  prix_unitaire: string;
  metier: string;
  /** Une ligne déjà facturée garde sa quantité et son prix (D-CHA-05). */
  figee: boolean;
}

export interface LigneDpgfModifiee {
  id: string;
  designation: string;
  quantite?: number;
  prix_unitaire?: number;
  metier: string | null;
}

export type ValidationLignes = { ok: true; lignes: LigneDpgfModifiee[] } | { ok: false; erreurs: Record<string, string> };

/** Toutes les lignes, ou aucune : une erreur désigne sa ligne par `<id>.<champ>`. */
export function validerLignesDpgf(brouillons: readonly BrouillonLigneDpgf[]): ValidationLignes {
  const erreurs: Record<string, string> = {};
  const lignes: LigneDpgfModifiee[] = [];
  for (const b of brouillons) {
    const designation = b.designation.trim();
    if (b.type === "ligne" && !designation) erreurs[`${b.id}.designation`] = "La désignation est obligatoire.";
    const metier = z.preprocess(videEnNull, z.string().nullable()).parse(b.metier) as string | null;
    if (b.type !== "ligne" || b.figee) {
      lignes.push({ id: b.id, designation, metier });
      continue;
    }
    const q = schemaNombreFr.safeParse(b.quantite);
    const p = schemaNombreFr.safeParse(b.prix_unitaire);
    if (!q.success) erreurs[`${b.id}.quantite`] = "Quantité invalide.";
    if (!p.success) erreurs[`${b.id}.prix_unitaire`] = "Prix invalide.";
    if (q.success && p.success) lignes.push({ id: b.id, designation, quantite: q.data, prix_unitaire: p.data, metier });
  }
  return Object.keys(erreurs).length ? { ok: false, erreurs } : { ok: true, lignes };
}
