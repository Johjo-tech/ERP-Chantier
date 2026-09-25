import type { LigneAEnregistrer } from "@/modules/documents/domain/lignes";

/**
 * Un rapport d'intervention devient un devis (DEV-17) : chaque ligne de
 * préconisation devient une ligne de devis, et « … x25 m² » en fin de ligne
 * se lit comme quantité et unité. Port de `parsePreconisationsEnLignes`
 * (app.js l. 4268) — parité : tests/parite/devis.essai.ts.
 */
export interface LignePreconisee {
  designation: string;
  quantite: number;
  unite: string;
}

const QUANTITE_EN_FIN = /^(.*?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*([a-zA-Zµ²³%]*)\s*$/i;

export function lignesDesPreconisations(texte: string | null | undefined, repli = ""): LignePreconisee[] {
  const lignes = (texte ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lignes.length) return [{ designation: repli, quantite: 1, unite: "u" }];
  return lignes.map((l) => {
    const m = QUANTITE_EN_FIN.exec(l);
    if (!m) return { designation: l, quantite: 1, unite: "u" };
    // `parseFloat(...) || 1` de l'ancien : « x0 » redevient 1.
    const q = Number.parseFloat((m[2] ?? "").replace(",", ".")) || 1;
    return { designation: (m[1] ?? "").trim(), quantite: q, unite: m[3] || "u" };
  });
}

/**
 * Les lignes du devis : préconisations s'il y en a, sinon les constatations
 * (ou le métier) en une seule ligne — comme `transformerInterventionEn`.
 * Prix à 0 : le chiffrage reste à faire.
 */
export function lignesDevisDuRapport(r: { preconisations: string | null; constatations: string | null; metier: string | null }, tvaDefaut: number): LigneAEnregistrer[] {
  const lues = r.preconisations?.trim() ? lignesDesPreconisations(r.preconisations) : [{ designation: r.constatations || r.metier || "", quantite: 1, unite: "u" }];
  return lues.map((l, position) => ({
    id: null,
    position,
    type: "ligne",
    designation: l.designation,
    quantite: l.quantite,
    prix_unitaire: 0,
    unite: l.unite,
    tva: tvaDefaut,
    article_reference: null,
    commentaire: null,
    metier: null,
    montant_ht: 0,
  }));
}
