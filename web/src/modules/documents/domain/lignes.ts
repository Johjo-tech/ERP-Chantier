import Big from "big.js";
import { z } from "zod";
import { schemaNombreFr } from "@/lib/nombres";
import type { TypeLigne } from "./totaux";

/**
 * Une ligne de document EN COURS D'ÉDITION : les nombres restent des chaînes
 * (ce que rend un champ), et ne deviennent des nombres qu'à l'enregistrement,
 * par `lignesPourEnregistrement` — qui refuse ce qui est illisible au lieu d'en
 * faire 0 comme l'ancien `parseFloat(...)||0`.
 */
export interface LigneEdition {
  /** Clé d'affichage, jamais envoyée en base. */
  cle: string;
  /** Identifiant en base ; null pour une ligne nouvelle (l'uuid vient de la base). */
  id: string | null;
  type: TypeLigne;
  designation: string;
  quantite: string;
  prix_unitaire: string;
  unite: string;
  tva: string;
  article_reference: string;
  commentaire: string;
  /** Conservé tel quel : NULL (lu sur le titre), un nom, ou la sentinelle « (aucun) » — jamais "". */
  metier: string | null;
}

export interface LigneBase {
  id: string;
  type: TypeLigne;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  unite: string | null;
  tva: number;
  article_reference: string | null;
  commentaire: string | null;
  metier: string | null;
}

let compteur = 0;
const nouvelleCle = () => `l${Date.now().toString(36)}${(compteur++).toString(36)}`;

const enTexte = (n: number) => String(n).replace(".", ",");

export function ligneVide(tvaDefaut: number, type: TypeLigne = "ligne"): LigneEdition {
  return {
    cle: nouvelleCle(),
    id: null,
    type,
    designation: "",
    quantite: type === "ligne" ? "1" : "0",
    prix_unitaire: "0",
    unite: type === "ligne" ? "u" : "",
    tva: type === "ligne" ? enTexte(tvaDefaut) : "0",
    article_reference: "",
    commentaire: "",
    metier: null,
  };
}

export function depuisBase(l: LigneBase): LigneEdition {
  return {
    cle: nouvelleCle(),
    id: l.id,
    type: l.type,
    designation: l.designation,
    quantite: enTexte(l.quantite),
    prix_unitaire: enTexte(l.prix_unitaire),
    unite: l.unite ?? "",
    tva: enTexte(l.tva),
    article_reference: l.article_reference ?? "",
    commentaire: l.commentaire ?? "",
    metier: l.metier,
  };
}

/** Copie profonde, SANS identifiant : la copie est une ligne nouvelle. */
export function dupliquer(lignes: readonly LigneEdition[], index: number): LigneEdition[] {
  const l = lignes[index];
  if (!l) return [...lignes];
  const copie = { ...l, cle: nouvelleCle(), id: null };
  return [...lignes.slice(0, index + 1), copie, ...lignes.slice(index + 1)];
}

/** Retirer la dernière ligne en laisse une vide : un document garde toujours une ligne à saisir. */
export function retirer(lignes: readonly LigneEdition[], index: number, tvaDefaut: number): LigneEdition[] {
  const reste = lignes.filter((_, i) => i !== index);
  return reste.length ? reste : [ligneVide(tvaDefaut)];
}

/** Déplacer d'un cran (remplace le glisser-déposer : utilisable au clavier). */
export function deplacer(lignes: readonly LigneEdition[], index: number, sens: -1 | 1): LigneEdition[] {
  const cible = index + sens;
  if (cible < 0 || cible >= lignes.length) return [...lignes];
  const copie = [...lignes];
  const [l] = copie.splice(index, 1);
  if (l) copie.splice(cible, 0, l);
  return copie;
}

export function modifier(lignes: readonly LigneEdition[], index: number, champ: keyof LigneEdition, valeur: string): LigneEdition[] {
  return lignes.map((l, i) => (i === index ? { ...l, [champ]: valeur } : l));
}

export interface LigneAEnregistrer {
  id: string | null;
  position: number;
  type: TypeLigne;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  unite: string | null;
  tva: number;
  article_reference: string | null;
  commentaire: string | null;
  metier: string | null;
  /** Qté × PU sans arrondi, 0 pour un chapitre ou un commentaire (convention de bc_generer_facture). */
  montant_ht: number;
}

export interface ErreurLigne {
  index: number;
  champ: "quantite" | "prix_unitaire" | "tva" | "designation";
  message: string;
}

const tauxTva = schemaNombreFr.pipe(z.number().min(0, "Taux négatif.").max(100, "Taux au-delà de 100 %."));

/**
 * Convertit les lignes saisies en lignes à écrire, ou rend les erreurs par ligne.
 * Les lignes entièrement vides sont écartées (la ligne vide d'office n'est pas une donnée).
 */
export function lignesPourEnregistrement(lignes: readonly LigneEdition[]): { lignes: LigneAEnregistrer[]; erreurs: ErreurLigne[] } {
  const erreurs: ErreurLigne[] = [];
  const sortie: LigneAEnregistrer[] = [];
  const utiles = lignes
    .map((l, index) => ({ l, index }))
    .filter(({ l }) => l.type !== "ligne" || l.designation.trim() !== "" || !["", "0"].includes(l.prix_unitaire.trim()));

  for (const { l, index } of utiles) {
    const texte = {
      designation: l.designation.trim(),
      unite: l.unite.trim() || null,
      article_reference: l.article_reference.trim() || null,
      commentaire: l.commentaire.trim() || null,
    };
    if (l.type !== "ligne") {
      if (!texte.designation) erreurs.push({ index, champ: "designation", message: "Titre ou texte obligatoire." });
      sortie.push({ id: l.id, position: sortie.length, type: l.type, ...texte, quantite: 0, prix_unitaire: 0, tva: 0, metier: l.metier, montant_ht: 0 });
      continue;
    }
    const q = schemaNombreFr.safeParse(l.quantite);
    const p = schemaNombreFr.safeParse(l.prix_unitaire);
    const t = tauxTva.safeParse(l.tva);
    if (!texte.designation) erreurs.push({ index, champ: "designation", message: "Désignation obligatoire." });
    if (!q.success) erreurs.push({ index, champ: "quantite", message: "Quantité invalide." });
    if (!p.success) erreurs.push({ index, champ: "prix_unitaire", message: "Prix invalide." });
    if (!t.success) erreurs.push({ index, champ: "tva", message: "Taux de TVA invalide." });
    if (q.success && p.success && t.success) {
      sortie.push({
        id: l.id,
        position: sortie.length,
        type: "ligne",
        ...texte,
        quantite: q.data,
        prix_unitaire: p.data,
        tva: t.data,
        metier: l.metier,
        // Produit exact en décimal, puis nombre JSON : 3 × 0,1 part 0.3, pas 0.30000000000000004.
        montant_ht: Number(new Big(q.data).times(p.data).toString()),
      });
    }
  }
  return { lignes: sortie, erreurs };
}
