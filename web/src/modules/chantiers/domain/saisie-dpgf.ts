import { z } from "zod";
import { schemaNombreFr } from "@/lib/nombres";

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
