/**
 * Les montants d'un document : par ligne, par chapitre, par taux de TVA.
 *
 * Cette arithmétique vivait dans `index.html`, qui n'a aucun test. Elle décide
 * pourtant de ce qui est facturé. Elle est reprise ici à l'identique — les
 * tests en vérifient la parité chiffrée — et l'écran en devient client.
 *
 * Module feuille : il n'importe que des types, ce qui lui permet de servir la
 * couche `queries` comme l'interface.
 */

const TYPE_LIGNE = "ligne";
const TYPE_COMMENTAIRE = "commentaire";
const TYPE_CHAPITRE = "chapitre";

/** Une ligne dans la forme de l'app historique. */
export interface LigneMontant {
  type?: string | null;
  qte?: number | string | null;
  prixUnitaire?: number | string | null;
  tva?: number | string | null;
}

export interface TauxVentile {
  taux: number;
  /** Base HT soumise à ce taux, remise déduite. */
  base: number;
  /** TVA due à ce taux, remise déduite. */
  montant: number;
}

export interface TotauxDocument {
  htAvant: number;
  tvaAvant: number;
  ttcAvant: number;
  remisePct: number;
  remiseMontantHT: number;
  ht: number;
  tva: number;
  ttc: number;
  /** Un poste par taux rencontré, trié par taux croissant. */
  ventilation: TauxVentile[];
}

/** L'app historique passe parfois des chaînes ; `parseFloat` est son contrat. */
function nombre(v: unknown): number {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

function estLigne(l: LigneMontant): boolean {
  return (l.type || TYPE_LIGNE) === TYPE_LIGNE;
}

/**
 * Le montant HT d'une ligne : quantité × prix unitaire, **avant remise**.
 *
 * Zéro pour un chapitre ou un commentaire — ils structurent le document, ils ne
 * portent aucun montant. C'est aussi ce qu'écrit `bc_generer_facture` dans
 * `facture_lignes.montant_ht`, et les deux doivent rester au centime près :
 * sinon deux populations de lignes cohabitent dans la même table.
 */
export function montantLigneHt(l: LigneMontant): number {
  if (!l || !estLigne(l)) return 0;
  return nombre(l.qte) * nombre(l.prixUnitaire);
}

/** Le pourcentage de remise, borné — l'écran laisse saisir n'importe quoi. */
function pourcentageRemise(remisePct: unknown): number {
  return Math.max(0, Math.min(100, nombre(remisePct)));
}

/**
 * La TVA détaillée par taux, remise appliquée.
 *
 * Aucun arrondi ici : le même facteur de remise s'applique à chaque poste, si
 * bien que la somme des bases égale exactement le total HT et la somme des
 * taxes le total TVA. Arrondir poste par poste puis sommer dériverait d'un
 * centime du « Total TVA » imprimé juste en dessous — l'écart qui fait douter
 * du document entier. Le formatage reste au bord, dans l'écran.
 *
 * Un taux à 0 % apparaît s'il porte une base : c'est l'autoliquidation, et elle
 * doit se lire sur la facture.
 */
export function ventilationTvaAffichage(
  lignes: LigneMontant[] | null | undefined,
  remisePct: unknown = 0
): TauxVentile[] {
  const facteur = 1 - pourcentageRemise(remisePct) / 100;
  const parTaux = new Map<number, TauxVentile>();

  for (const l of lignes ?? []) {
    if (!estLigne(l)) continue;
    const base = montantLigneHt(l) * facteur;
    if (base === 0) continue;

    const taux = nombre(l.tva);
    const poste = parTaux.get(taux) ?? { taux, base: 0, montant: 0 };
    poste.base += base;
    poste.montant += base * (taux / 100);
    parTaux.set(taux, poste);
  }

  return [...parTaux.values()].sort((a, b) => a.taux - b.taux);
}

/**
 * Les totaux d'un document, remise comprise.
 *
 * Reprise fidèle de `computeTotalsAvecRemise` : la remise est un pourcentage
 * global appliqué proportionnellement au HT, à la TVA et au TTC. Elle ne
 * descend pas au niveau ligne — c'est pourquoi la colonne « Total HT » en face
 * de chaque ligne reste le montant **avant** remise.
 */
export function totauxDocument(
  lignes: LigneMontant[] | null | undefined,
  remisePct: unknown = 0
): TotauxDocument {
  let ht = 0;
  let tva = 0;
  for (const l of lignes ?? []) {
    if (!estLigne(l)) continue;
    const lht = montantLigneHt(l);
    ht += lht;
    tva += lht * (nombre(l.tva) / 100);
  }

  const pct = pourcentageRemise(remisePct);
  const facteur = 1 - pct / 100;

  return {
    htAvant: ht,
    tvaAvant: tva,
    ttcAvant: ht + tva,
    remisePct: pct,
    remiseMontantHT: (ht * pct) / 100,
    ht: ht * facteur,
    tva: tva * facteur,
    ttc: (ht + tva) * facteur,
    ventilation: ventilationTvaAffichage(lignes, pct),
  };
}

/**
 * Le sous-total de chaque chapitre, dans l'ordre où ils apparaissent.
 *
 * Avant remise, comme les lignes qu'ils regroupent. Un document sans chapitre
 * ne rend rien — il n'y a alors qu'un total, et il est déjà en pied.
 */
export function sousTotauxChapitres(lignes: LigneMontant[] | null | undefined): number[] {
  const liste = lignes ?? [];
  if (!liste.some((l) => (l.type || TYPE_LIGNE) === TYPE_CHAPITRE)) return [];

  const sommes: number[] = [];
  let courant = 0;
  let commence = false;

  for (const l of liste) {
    const type = l.type || TYPE_LIGNE;
    if (type === TYPE_CHAPITRE) {
      if (commence) sommes.push(courant);
      courant = 0;
      commence = true;
    } else if (type !== TYPE_COMMENTAIRE) {
      courant += montantLigneHt(l);
    }
  }
  if (commence) sommes.push(courant);
  return sommes;
}

/** « 5,5 % », « 20 % » — la virgule décimale, comme partout ailleurs. */
export function formaterTaux(taux: number): string {
  return `${String(nombre(taux)).replace(".", ",")} %`;
}
