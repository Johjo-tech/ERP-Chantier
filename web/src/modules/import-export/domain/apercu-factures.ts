/**
 * Ce qu'une reprise d'historique écrira, décidé AVANT d'écrire (IMP-20 à
 * IMP-22) — port de `pieceAEcrire` et `previsualiserImportFactures`
 * (src/integrations/factures-import.ts), sans accès base.
 *
 * Tout se décide ici : rapprochement des clients, collisions de numéros,
 * totaux reconstitués. Une facture numérotée ne se modifie plus et ne se
 * supprime plus : l'aperçu est la seule occasion de voir.
 */
import type { CadreFacturation } from "@/modules/clients/domain/client";
import { estAvoir, MODE_REGLEMENT_IMPUTATION } from "@/modules/facturation/domain/avoir";
import { cleNom } from "./clients";
import { legacyDuNumero } from "./historique";
import { rapprocherClient, totauxDe, type CategorieTva, type ClientConnu, type FactureImportee, type RapportImportFactures, type TotauxFichier } from "./factures";

export type StatutFacture = "brouillon" | "impayée" | "envoyée" | "payée";

/**
 * « payée » : le fichier ne dit rien des règlements, et le défaut de la
 * colonne (« impayée ») ferait apparaître tout le TTC repris — 362 792 € pour
 * 2025 — en créances qui n'existent pas. L'exercice repris est clos.
 */
export const STATUT_IMPORT_DEFAUT: StatutFacture = "payée";

export interface EnteteAEcrire {
  client_id: string | null;
  client_nom: string;
  date: string;
  echeance: string | null;
  type_document: "facture" | "avoir";
  cadre_facturation: CadreFacturation;
  devise: string;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  net_a_payer: number;
  tva_categorie: CategorieTva;
  /** Posé ICI : `legacy_id` est gelé dès que le numéro est posé. */
  legacy_id: string;
}

export interface LigneAEcrire {
  position: number;
  type: "ligne";
  designation: string;
  quantite: number;
  prix_unitaire: number;
  montant_ht: number;
  tva: number;
  tva_categorie: CategorieTva;
  article_reference: string | null;
}

export interface PieceAEcrire {
  numero: string;
  statut: StatutFacture;
  entete: EnteteAEcrire;
  lignes: LigneAEcrire[];
}

const CADRES: readonly CadreFacturation[] = ["B2C", "B2B_national", "B2G", "B2B_international"];
const cadreConnu = (c: string | null | undefined): CadreFacturation => (CADRES as readonly (string | null | undefined)[]).includes(c) ? (c as CadreFacturation) : "B2B_national";

/**
 * `quantite = 1`, `prix_unitaire = HT` : `v_facture_totaux` et l'écran
 * recalculent depuis `quantite × prix_unitaire` et ignorent `total_*`.
 * Le nom du FICHIER, jamais celui de la fiche : une pièce comptable dit qui a
 * été facturé à l'époque. Le compte comptable part dans `article_reference`.
 */
export function pieceAEcrire(f: FactureImportee, client: ClientConnu | null, statut: StatutFacture): PieceAEcrire {
  return {
    numero: f.numero,
    statut,
    entete: {
      client_id: client?.id ?? null,
      client_nom: f.nomClient,
      date: f.date,
      echeance: f.echeance,
      type_document: f.typeDocument,
      cadre_facturation: cadreConnu(client?.cadre),
      devise: "EUR",
      total_ht: f.totalHt,
      total_tva: f.totalTva,
      total_ttc: f.totalTtc,
      net_a_payer: f.totalTtc,
      tva_categorie: f.categorieTva,
      legacy_id: legacyDuNumero(f.numero),
    },
    lignes: f.lignes.map((l) => ({
      position: l.position,
      type: "ligne",
      designation: l.designation,
      quantite: 1,
      prix_unitaire: l.montantHt,
      montant_ht: l.montantHt,
      tva: l.tauxTva,
      tva_categorie: f.categorieTva,
      article_reference: l.compte || null,
    })),
  };
}

export interface ClientDuFichier {
  code: string | null;
  nom: string;
  pieces: number;
  /** Net et signé : le poids de ce client dans ce qui s'importe. */
  ht: number;
  /** `aucun` et `ambigu` appellent une fiche neuve ; `contenu` se rattache, mais « probablement ». */
  rapprochement: "exact" | "prefixe" | "contenu" | "ambigu" | "aucun";
  /** Le nom de la fiche retenue, quand il diffère de celui du fichier. */
  versNom: string | null;
}

export interface ApercuImportFactures {
  totaux: TotauxFichier;
  aEcrire: number;
  totauxAEcrire: TotauxFichier;
  /** Numéros déjà en base : ces pièces ne sont pas réécrites. */
  collisions: string[];
  clients: ClientDuFichier[];
  clientsACreer: ClientDuFichier[];
  rejets: RapportImportFactures["rejets"];
  signalements: RapportImportFactures["signalements"];
  incoherent: boolean;
  /** Faux dès qu'une pièce a été écartée : un historique amputé ne se voit qu'à la révision des comptes (IMP-21). */
  ecriturePossible: boolean;
  pieces: PieceAEcrire[];
  /** Parallèle à `pieces` : la clé du client à créer, ou `null` si sa fiche existe. */
  clientACreerParPiece: (string | null)[];
}

/**
 * Dit AVANT d'écrire qu'un avoir repris arrive déjà imputé (production
 * 3c6bc02) : son crédit a été consommé dans l'ancien logiciel, il ne soldera
 * pas une facture d'aujourd'hui. Libellé recopié de l'ancien.
 */
export function motifAvoirsImputes(n: number): string {
  return (
    `${n} avoir${n > 1 ? "s" : ""} ${n > 1 ? "seront marqués" : "sera marqué"} ` +
    `DÉJÀ IMPUTÉ${n > 1 ? "S" : ""} : leur crédit a été consommé avant la reprise, ` +
    `et ils ne pourront pas solder une facture d'aujourd'hui.`
  );
}

/**
 * Ce qu'on lit dans le livre des règlements en face d'un avoir repris — en
 * clair : quelqu'un relira cette ligne dans six mois (recopié de l'ancien).
 */
export const REFERENCE_AVOIR_REPRIS = "Reprise d'historique — avoir déjà utilisé avant la reprise";

/**
 * L'imputation qui consomme un avoir repris (production 3c6bc02) : son TTC,
 * au jour de la pièce, mode « imputation » — ce que compte `resteAImputer`,
 * l'écran n'a donc aucune règle de plus à connaître. Rien pour une facture,
 * ni pour un avoir à zéro.
 */
export function imputationDeReprise(piece: PieceAEcrire): { date: string; montant: number; mode: typeof MODE_REGLEMENT_IMPUTATION; reference: string } | null {
  if (!estAvoir(piece.entete.type_document)) return null;
  const credit = Math.abs(Number(piece.entete.total_ttc ?? 0));
  if (!(credit > 0)) return null;
  return { date: piece.entete.date, montant: credit, mode: MODE_REGLEMENT_IMPUTATION, reference: REFERENCE_AVOIR_REPRIS };
}

/** Ce que l'aperçu et le rapport disent d'un client (`telechargerRapportFactures`). */
export function issueDuClient(c: Pick<ClientDuFichier, "rapprochement" | "versNom">): string {
  if (c.rapprochement === "exact") return "fiche trouvée";
  if (c.rapprochement === "prefixe") return `rapproché de « ${c.versNom} »`;
  if (c.rapprochement === "contenu") return `probablement « ${c.versNom} » (nom retrouvé dans la raison sociale)`;
  return "aucune fiche : elle sera créée";
}

export function construireApercuFactures(
  rapport: RapportImportFactures,
  existants: readonly ClientConnu[],
  numerosPris: ReadonlySet<string>,
  statut: StatutFacture = STATUT_IMPORT_DEFAUT
): ApercuImportFactures {
  const commun = { totaux: rapport.totaux, rejets: rapport.rejets, signalements: rapport.signalements, incoherent: rapport.incoherent };
  // Une fois par nom distinct : 768 pièces pour douze clients ne font pas 768 balayages.
  const parNom = new Map<string, ReturnType<typeof rapprocherClient>>();
  const resoudre = (nom: string) => {
    const cle = cleNom(nom);
    const r = parNom.get(cle) ?? rapprocherClient(nom, existants);
    parNom.set(cle, r);
    return r;
  };

  const clients = new Map<string, ClientDuFichier>();
  const pieces: PieceAEcrire[] = [];
  const clientACreerParPiece: (string | null)[] = [];
  const retenues: FactureImportee[] = [];
  const collisions: string[] = [];

  for (const f of rapport.factures) {
    if (numerosPris.has(f.numero)) {
      collisions.push(f.numero);
      continue;
    }
    const r = resoudre(f.nomClient);
    // Le sigle ou le début de nom retrouvé compte comme une fiche trouvée : l'aperçu le dit « probablement ».
    const trouve = r.type === "exact" || r.type === "prefixe" || r.type === "contenu" ? r.client : null;
    const cle = cleNom(f.nomClient);
    const vu = clients.get(cle) ?? { code: f.codeClient, nom: f.nomClient, pieces: 0, ht: 0, rapprochement: r.type, versNom: trouve && cleNom(trouve.nom) !== cle ? trouve.nom : null };
    vu.pieces++;
    vu.ht += (f.typeDocument === "avoir" ? -1 : 1) * f.totalHt;
    clients.set(cle, vu);
    retenues.push(f);
    pieces.push(pieceAEcrire(f, trouve, statut));
    clientACreerParPiece.push(trouve ? null : cle);
  }

  const tous = [...clients.values()].sort((a, c) => Math.abs(c.ht) - Math.abs(a.ht));
  const avoirs = retenues.filter((f) => f.typeDocument === "avoir").length;
  return {
    ...commun,
    signalements: avoirs > 0 ? [...rapport.signalements, { ligne: 0, motif: motifAvoirsImputes(avoirs) }] : rapport.signalements,
    aEcrire: pieces.length,
    totauxAEcrire: totauxDe(retenues),
    collisions,
    clients: tous,
    clientsACreer: tous.filter((c) => c.rapprochement === "aucun" || c.rapprochement === "ambigu"),
    ecriturePossible: !rapport.incoherent && rapport.rejets.length === 0 && pieces.length > 0,
    pieces,
    clientACreerParPiece,
  };
}

/** Le rapport téléchargeable : rejets, décisions, collisions et clients, triés par ligne. */
export function lignesRapportFactures(a: ApercuImportFactures): { ligne: number; motif: string; contenu: string }[] {
  const lignes = [
    ...a.rejets,
    ...a.signalements.map((s) => ({ ligne: s.ligne, motif: s.motif, contenu: s.code ? `pièce ${s.code}` : "en-tête du fichier" })),
    ...a.collisions.map((n) => ({ ligne: 0, motif: "Numéro déjà présent en base : la pièce n'est pas réécrite.", contenu: `pièce ${n}` })),
    ...a.clients.map((c) => ({
      ligne: 0,
      motif: `Client « ${c.nom} » — ${issueDuClient(c)} (${c.pieces} pièces)`,
      contenu: c.code ?? "",
    })),
  ];
  return lignes.sort((x, y) => x.ligne - y.ligne);
}
