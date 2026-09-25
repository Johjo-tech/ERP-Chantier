/**
 * Un devis rattaché au chantier nourrit son DPGF (CHA-15) : ses lignes, hors
 * commentaires et lignes sans désignation, y sont recopiées avec un avancement
 * nul et la référence du devis source (app.js l. 4697, `syncDevisLignesVersDpgf`).
 *
 * L'ancien écran commençait par RETIRER toutes les lignes déjà venues du même
 * devis — y compris celles déjà facturées en situation, dont l'avancement et
 * l'historique partaient avec elles. Écart voulu (D-CHA-06) : dès qu'une ligne
 * venue du devis est facturée ou planifiée, la reprise ne touche plus à rien
 * (`conservees` > 0) — mêler anciennes et nouvelles lignes doublerait le DPGF.
 * Sinon, les lignes du devis remplacent celles qu'il avait déjà apportées.
 */
export interface LigneDevisSource {
  type: string | null;
  designation: string | null;
  quantite: number | string | null;
  prix_unitaire: number | string | null;
  unite?: string | null;
}

export interface LigneDpgfExistante {
  id: string;
  devis_source_id: string | null;
  avancement_cumule: number | string;
}

export interface RepriseDevis {
  aRetirer: string[];
  aAjouter: { type: "ligne" | "chapitre"; designation: string; quantite: number; prix_unitaire: number; unite: string | null; devis_source_id: string }[];
  conservees: number;
}

export function repriseDevis(
  devisId: string,
  lignesDevis: readonly LigneDevisSource[],
  dpgf: readonly LigneDpgfExistante[],
  lignesPlanifiees: ReadonlySet<string>
): RepriseDevis {
  const venues = dpgf.filter((l) => l.devis_source_id === devisId);
  const figees = venues.filter((l) => Number(l.avancement_cumule) > 0 || lignesPlanifiees.has(l.id));
  const aRetirer = venues.filter((l) => !figees.includes(l)).map((l) => l.id);
  const aAjouter = figees.length
    ? []
    : lignesDevis
        .filter((l) => l.type !== "commentaire" && !!l.designation)
        .map((l) => ({
          type: l.type === "chapitre" ? ("chapitre" as const) : ("ligne" as const),
          designation: l.designation ?? "",
          quantite: Number(l.quantite) || 0,
          prix_unitaire: Number(l.prix_unitaire) || 0,
          unite: l.unite ?? null,
          devis_source_id: devisId,
        }));
  return { aRetirer: figees.length ? [] : aRetirer, aAjouter, conservees: figees.length };
}
