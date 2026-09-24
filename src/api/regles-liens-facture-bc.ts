/**
 * Ce qui rapproche une facture de son bon de commande.
 *
 * `factures.bon_commande_id` existe, mais n'est posé que par trois des chemins
 * qui créent une facture — `bc_generer_facture`, `transformerBonCommandeEnFacture`
 * et `createFactureFromBC`. Le motif dominant en production est une facture qui
 * porte le NUMÉRO DU BON EN TEXTE, dans `ref_bon_commande_client`, sans la clé.
 * Une recherche qui ne suivrait que la clé manquerait donc la majorité des
 * factures, et se tairait au lieu de le dire.
 *
 * D'où deux voies, dans cet ordre : la clé quand elle existe, le rapprochement
 * par numéro sinon.
 *
 * ── CE QUE CE MODULE N'EST PAS ──────────────────────────────────────────────
 * Le rapprochement par texte sert à CHERCHER, jamais à AFFIRMER un lien. Il ne
 * doit alimenter ni le badge « 🔒 Facturé », ni la ligne « Facture liée », ni le
 * verrou qui refuse de modifier un bon déjà facturé. Verrouiller un bon parce
 * qu'une facture partage un numéro de texte serait un refus faux, et personne
 * ne saurait pourquoi. Ces trois-là continuent de ne lire que la clé.
 *
 * Feuille au sens de CLAUDE.md : elle ne connaît ni `state`, ni le DOM, ni la
 * base. Elle reçoit deux tableaux et rend des index.
 */

import { lieuIntervention, refBonCommandeClient } from "./regles-bc";

/** Le minimum qu'un bon doit porter pour entrer dans l'index. */
export interface BonRapprochable {
  id: string;
  numeroBC?: string | null;
  numeroInterne?: string | null;
  natureTravaux?: string | null;
  referenceChantier?: string | null;
  adresse?: string | null;
  adresseLocataire?: string | null;
  codePostal?: string | null;
  ville?: string | null;
  occupant?: string | null;
  ancienLocataire?: string | null;
  numeroLogement?: string | null;
  etage?: string | null;
}

/** Le minimum qu'une facture doit porter. */
export interface FactureRapprochable {
  id: string;
  numero?: string | null;
  bonCommandeId?: string | null;
  refBonCommandeClient?: string | null;
  occupant?: string | null;
  adresseLocataire?: string | null;
}

export interface IndexFactureBC {
  bonsParId: Map<string, BonRapprochable>;
  /** Plusieurs bons peuvent citer le même numéro client — d'où un tableau. */
  bonsParCle: Map<string, BonRapprochable[]>;
  facturesParBonId: Map<string, FactureRapprochable[]>;
  facturesParCle: Map<string, FactureRapprochable[]>;
}

/**
 * La clé sur laquelle une facture et un bon se reconnaissent.
 *
 * Elle délègue la règle MÉTIER à `refBonCommandeClient`, qui se déclare miroir
 * exact de la fonction SQL `public.ref_bc_client` : première ligne seulement —
 * le champ est un textarea —, et neutralisation de « Sans BC », « En attente de
 * BC » et des numéros SAV, qui appartiennent à notre propre série.
 *
 * S'appliquant DES DEUX CÔTÉS — sur `numeroBC` et sur `refBonCommandeClient` —
 * c'est elle qui garantit que la clé et le texte désignent le même bon. Une
 * normalisation qui divergerait d'un côté rendrait le rapprochement asymétrique,
 * et donc faux dans un sens seulement : le pire des deux cas, puisqu'il se
 * remarque tard.
 *
 * Ne s'y ajoute que la tolérance de SAISIE — casse, accents, espaces multiples.
 * Elle est nécessaire parce que `refBonCommandeClient` d'une facture peut venir
 * du formulaire, tapé à la main, là où celui d'un bon vient de la base.
 */
export function cleRapprochement(numero?: string | null): string | null {
  const reference = refBonCommandeClient(numero);
  if (!reference) return null;
  const propre = reference
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return propre || null;
}

/**
 * Les deux index, construits en une passe sur chaque collection.
 *
 * O(F + B), à appeler UNE FOIS par chargement et non par document : résoudre le
 * bon d'une facture par un `find` coûtait, à l'échelle de la production,
 * ~830 × ~1 800 comparaisons à chaque frappe.
 *
 * Les collections reçues doivent déjà être restreintes à la société active :
 * deux bailleurs peuvent employer la même série de numéros, et un index par
 * numéro qui les mélangerait rapprocherait la facture de l'un du bon de l'autre.
 */
export function construireIndexFactureBC(donnees: {
  factures: FactureRapprochable[];
  bons: BonRapprochable[];
}): IndexFactureBC {
  const bonsParId = new Map<string, BonRapprochable>();
  const bonsParCle = new Map<string, BonRapprochable[]>();
  const facturesParBonId = new Map<string, FactureRapprochable[]>();
  const facturesParCle = new Map<string, FactureRapprochable[]>();

  const ranger = <T>(carte: Map<string, T[]>, cle: string, valeur: T) => {
    const deja = carte.get(cle);
    if (deja) deja.push(valeur);
    else carte.set(cle, [valeur]);
  };

  for (const bon of donnees.bons ?? []) {
    if (!bon?.id) continue;
    bonsParId.set(bon.id, bon);
    const cle = cleRapprochement(bon.numeroBC);
    if (cle) ranger(bonsParCle, cle, bon);
  }

  for (const facture of donnees.factures ?? []) {
    if (!facture?.id) continue;
    if (facture.bonCommandeId) ranger(facturesParBonId, facture.bonCommandeId, facture);
    const cle = cleRapprochement(facture.refBonCommandeClient);
    if (cle) ranger(facturesParCle, cle, facture);
  }

  return { bonsParId, bonsParCle, facturesParBonId, facturesParCle };
}

/** Les bons qu'une facture désigne : par la clé, puis par le numéro en texte. */
export function bonsDeLaFacture(
  facture: FactureRapprochable,
  index: IndexFactureBC
): BonRapprochable[] {
  const trouves: BonRapprochable[] = [];
  const vus = new Set<string>();

  const ajouter = (bon?: BonRapprochable) => {
    if (!bon || vus.has(bon.id)) return;
    vus.add(bon.id);
    trouves.push(bon);
  };

  if (facture?.bonCommandeId) ajouter(index.bonsParId.get(facture.bonCommandeId));
  const cle = cleRapprochement(facture?.refBonCommandeClient);
  if (cle) for (const bon of index.bonsParCle.get(cle) ?? []) ajouter(bon);

  return trouves;
}

/** Les factures d'un bon. La cardinalité réelle est 1 bon → 0..N factures. */
export function facturesDuBon(
  bon: BonRapprochable,
  index: IndexFactureBC
): FactureRapprochable[] {
  const trouvees: FactureRapprochable[] = [];
  const vues = new Set<string>();

  const ajouter = (facture?: FactureRapprochable) => {
    if (!facture || vues.has(facture.id)) return;
    vues.add(facture.id);
    trouvees.push(facture);
  };

  if (bon?.id) for (const f of index.facturesParBonId.get(bon.id) ?? []) ajouter(f);
  const cle = cleRapprochement(bon?.numeroBC);
  if (cle) for (const f of index.facturesParCle.get(cle) ?? []) ajouter(f);

  return trouvees;
}

/**
 * Ce qu'un bon apporte à la recherche d'une facture.
 *
 * Les paires portent une ÉTIQUETTE parce que l'écran doit pouvoir dire d'où
 * vient la correspondance — « 🔎 BC 2024-0187 » sous une facture trouvée par le
 * numéro de son bon. Une liste de chaînes nues obligerait à refaire le travail
 * une seconde fois pour l'afficher.
 *
 * Les LIGNES du bon sont volontairement écartées : la facture porte les siennes,
 * que le module de recherche lit déjà, et une prestation du bon qui n'a pas été
 * facturée ne doit pas rendre la facture trouvable — elle lui prêterait un
 * contenu qu'elle n'a pas.
 */
export function apportsDuBon(bon: BonRapprochable): { etiquette: string; valeur: string }[] {
  const lieu = lieuIntervention(bon);
  const locataire = [bon.occupant, bon.ancienLocataire, bon.numeroLogement, bon.etage]
    .filter(Boolean)
    .join(" ");

  return [
    /* Le numéro BRUT, et non sa première ligne : un bon qui en cite deux doit
       rester trouvable par le second, que `refBonCommandeClient` écarte. */
    { etiquette: "BC", valeur: (bon.numeroBC ?? "").trim() },
    { etiquette: "BC interne", valeur: (bon.numeroInterne ?? "").trim() },
    { etiquette: "Nature", valeur: (bon.natureTravaux ?? "").trim() },
    { etiquette: "Réf. chantier", valeur: (bon.referenceChantier ?? "").trim() },
    { etiquette: "Lieu", valeur: lieu.renseigne ? lieu.texte : "" },
    { etiquette: "Locataire", valeur: locataire },
  ].filter((a) => a.valeur !== "");
}

/**
 * Ce qu'une facture apporte à la recherche d'un bon.
 *
 * `facture.adresse` n'y figure JAMAIS : sur une facture, c'est le siège du
 * client, pas le lieu des travaux. La pousser sur un bon ferait ressortir tous
 * les chantiers d'un bailleur dès qu'on tape l'adresse de son siège.
 *
 * Le locataire de la facture n'est repris que si le bon n'en porte pas : il en
 * est la copie, et le citer deux fois ferait croire à un apport là où il n'y en
 * a pas.
 */
export function apportsDeLaFacture(
  facture: FactureRapprochable,
  bon: BonRapprochable,
  montants: string[]
): { etiquette: string; valeur: string }[] {
  const apports = [
    { etiquette: "Facture", valeur: (facture.numero ?? "").trim() },
    { etiquette: "Montant", valeur: montants.filter(Boolean).join(" ") },
  ];

  if (!(bon.occupant ?? "").trim()) {
    apports.push({ etiquette: "Locataire", valeur: (facture.occupant ?? "").trim() });
  }
  if (!(bon.adresseLocataire ?? "").trim() && !(bon.adresse ?? "").trim()) {
    apports.push({ etiquette: "Lieu", valeur: (facture.adresseLocataire ?? "").trim() });
  }

  return apports.filter((a) => a.valeur !== "");
}
