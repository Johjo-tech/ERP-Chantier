/**
 * L'import de facturation historique : du fichier jusqu'à l'écriture.
 *
 * Calqué sur `clients-import.ts`, et pour les mêmes raisons : la société vient
 * de la session, l'écran n'a pas à la passer et ne peut donc pas se tromper de
 * cloisonnement ; la lecture des fichiers vit dans un module de règles sans
 * base ni DOM ; l'écran ne fait que déclencher.
 *
 * ── CE QUI SE DÉCIDE À L'APERÇU, ET POURQUOI LÀ ────────────────────────────
 * Tout. Rapprochement des clients, collisions de numéros, totaux reconstitués.
 * Aucune de ces questions ne peut se poser après coup : une facture numérotée
 * ne se modifie plus et ne se supprime plus. L'aperçu n'est pas un confort,
 * c'est la seule occasion de voir avant que ce soit définitif.
 *
 * ── LE STATUT, ET POURQUOI CE N'EST PAS ANODIN ─────────────────────────────
 * Le fichier ne dit rien des règlements. Prendre le défaut de la colonne
 * (« impayée ») ferait apparaître à l'écran l'intégralité du TTC importé en
 * créances ouvertes — 362 792 € pour l'année 2025 — qui n'existent pas.
 * `STATUT_IMPORT_DEFAUT` vaut donc « payée » : l'exercice repris est clos, et
 * les avoirs du fichier se compensent déjà. L'appelant peut en décider
 * autrement, mais jamais par omission.
 */

import * as queries from "@/api/queries";
import {
  analyserExportFactures,
  DESIGNATION_SANS_LIGNES,
  estPieceHistorique,
  legacyDuNumero,
  natureDuFichier,
  rapprocherClient,
  totauxDe,
  type CategorieTva,
  type ClientConnu,
  type FactureImportee,
  type RapportImportFactures,
  type TotauxFichier,
} from "@/api/regles-import-factures";
import { cleNom } from "@/api/regles-import-clients";
import type { PieceAEcrire } from "@/api/queries/factures-import";
import type { FactureStatut, Uuid } from "@/api/types";
import { societeActive } from "./session";

export { estPieceHistorique };

/** Voir l'en-tête du module : l'omission serait un accident, pas un choix. */
export const STATUT_IMPORT_DEFAUT: FactureStatut = "payée";

function societeUuid(): Uuid {
  const societe = societeActive();
  if (!societe) throw new Error("Aucune société active : impossible d'importer des factures.");
  return societe.uuid;
}

/** Un client du fichier, et ce qu'on en a fait. */
export interface ClientDuFichier {
  code: string | null;
  nom: string;
  pieces: number;
  /** Net et signé : le poids de ce client dans ce qui s'importe. */
  ht: number;
  /** `aucun` et `ambigu` appellent une fiche neuve ; `prefixe` se montre. */
  rapprochement: "exact" | "prefixe" | "ambigu" | "aucun";
  /** Le nom de la fiche retenue, quand il diffère de celui du fichier. */
  versNom: string | null;
}

export interface ApercuImportFactures {
  totaux: TotauxFichier;
  /** Ce qui partirait réellement, collisions déduites. */
  aEcrire: number;
  totauxAEcrire: TotauxFichier;
  /** Numéros déjà présents en base : ces pièces ne sont pas réécrites. */
  collisions: string[];
  /** Tous les clients du fichier, du plus lourd au plus léger. */
  clients: ClientDuFichier[];
  /** Ceux qu'il faudra créer — sous-ensemble de `clients`. */
  clientsACreer: ClientDuFichier[];
  rejets: RapportImportFactures["rejets"];
  signalements: RapportImportFactures["signalements"];
  incoherent: boolean;
  /**
   * L'import est-il autorisé ? Faux dès qu'une pièce a été écartée : un
   * historique amputé en silence ne se voit qu'à la révision des comptes.
   */
  ecriturePossible: boolean;
  pieces: PieceAEcrire[];
  /**
   * Pour chaque pièce, la clé du client à créer — ou `null` si sa fiche
   * existe déjà. Parallèle à `pieces`, et résolu au moment d'écrire.
   */
  clientACreerParPiece: (string | null)[];
}

/**
 * Ce qu'on écrira pour une pièce.
 *
 * `quantite = 1` et `prix_unitaire = montant HT` ne sont pas un pis-aller :
 * `v_facture_totaux` et l'écran (`app.js:803`) recalculent tous deux depuis
 * `quantite × prix_unitaire` et ignorent les colonnes `total_*`. Une ligne qui
 * ne porterait que son total s'afficherait à 0,00 € partout.
 */
export function pieceAEcrire(
  f: FactureImportee,
  client: ClientConnu | null,
  statut: FactureStatut
): PieceAEcrire {
  return {
    numero: f.numero,
    statut,
    entete: {
      client_id: (client?.id as Uuid) ?? null,
      /* Le nom du FICHIER, jamais celui de la fiche : une pièce comptable dit
         qui a été facturé à l'époque, pas comment on l'appelle aujourd'hui. */
      client_nom: f.nomClient,
      date: f.date,
      echeance: f.echeance,
      type_document: f.typeDocument,
      cadre_facturation: (client?.cadre as never) ?? "B2B_national",
      devise: "EUR",
      total_ht: f.totalHt,
      total_tva: f.totalTva,
      total_ttc: f.totalTtc,
      net_a_payer: f.totalTtc,
      tva_categorie: f.categorieTva as never,
      /* Le marqueur d'origine, et il DOIT être posé ici : `legacy_id` n'est ni
         dans `v_libres` ni dans `v_completables`, donc gelé dès l'étape 3. */
      legacy_id: legacyDuNumero(f.numero),
    },
    lignes: f.lignes.map((l) => ({
      position: l.position,
      type: "ligne" as const,
      designation: l.designation,
      quantite: 1,
      prix_unitaire: l.montantHt,
      montant_ht: l.montantHt,
      tva: l.tauxTva,
      tva_categorie: f.categorieTva as never,
      /* Le compte comptable ne doit pas se perdre : c'est lui qui permettra de
         confronter une pièce au grand livre dans six mois. */
      article_reference: l.compte || null,
    })),
  };
}

const APERCU_VIDE: Omit<ApercuImportFactures, "totaux" | "rejets" | "signalements" | "incoherent"> =
  {
    aEcrire: 0,
    totauxAEcrire: totauxDe([]),
    collisions: [],
    clients: [],
    clientsACreer: [],
    ecriturePossible: false,
    pieces: [],
    clientACreerParPiece: [],
  };

/**
 * Lit le ou les fichiers, confronte à la base, et rend ce qui sera écrit.
 *
 * Rien n'est écrit ici.
 */
export async function previsualiserImportFactures(
  octetsEntetes: ArrayBuffer | Uint8Array,
  /* Facultatif : l'en-tête porte déjà HT, TVA et TTC. Sans lui, chaque facture
     reçoit une ligne unique — les totaux restent exacts, la ventilation par
     compte comptable se perd. */
  octetsLignes: ArrayBuffer | Uint8Array | null | undefined,
  options: { categorieTauxZero?: CategorieTva; statut?: FactureStatut } = {}
): Promise<ApercuImportFactures> {
  const societe = societeUuid();
  const statut = options.statut ?? STATUT_IMPORT_DEFAUT;

  const rapport = analyserExportFactures(octetsEntetes, octetsLignes, {
    categorieTauxZero: options.categorieTauxZero,
  });

  if (!rapport.factures.length) {
    return {
      ...APERCU_VIDE,
      totaux: rapport.totaux,
      rejets: rapport.rejets,
      signalements: rapport.signalements,
      incoherent: rapport.incoherent,
    };
  }

  const [existantsBruts, pris] = await Promise.all([
    queries.clientsRapprochables(societe),
    queries.numerosDejaPris(
      societe,
      rapport.factures.map((f) => f.numero)
    ),
  ]);

  const existants: ClientConnu[] = existantsBruts.map((c) => ({
    id: c.id,
    nom: c.nom ?? "",
    cadre: c.cadre_facturation ?? null,
  }));

  /* Le rapprochement se calcule UNE fois par nom distinct, pas une fois par
     pièce : 768 pièces pour douze clients feraient 768 balayages inutiles. */
  const parNom = new Map<string, ReturnType<typeof rapprocherClient>>();
  const resoudre = (nom: string) => {
    const cle = cleNom(nom);
    let r = parNom.get(cle);
    if (!r) {
      r = rapprocherClient(nom, existants);
      parNom.set(cle, r);
    }
    return r;
  };

  const clients = new Map<string, ClientDuFichier>();
  const pieces: PieceAEcrire[] = [];
  const clientACreerParPiece: (string | null)[] = [];
  const retenues: FactureImportee[] = [];
  const collisions: string[] = [];

  for (const f of rapport.factures) {
    if (pris.has(f.numero)) {
      collisions.push(f.numero);
      continue;
    }

    const r = resoudre(f.nomClient);
    const trouve = r.type === "exact" || r.type === "prefixe" ? r.client : null;
    const cle = cleNom(f.nomClient);

    const vu = clients.get(cle) ?? {
      code: f.codeClient,
      nom: f.nomClient,
      pieces: 0,
      ht: 0,
      rapprochement: r.type,
      versNom: trouve && cleNom(trouve.nom) !== cle ? trouve.nom : null,
    };
    vu.pieces++;
    vu.ht += (f.typeDocument === "avoir" ? -1 : 1) * f.totalHt;
    clients.set(cle, vu);

    retenues.push(f);
    pieces.push(pieceAEcrire(f, trouve, statut));
    clientACreerParPiece.push(trouve ? null : cle);
  }

  const tous = [...clients.values()].sort((a, b) => Math.abs(b.ht) - Math.abs(a.ht));

  return {
    totaux: rapport.totaux,
    aEcrire: pieces.length,
    totauxAEcrire: totauxDe(retenues),
    collisions,
    clients: tous,
    clientsACreer: tous.filter((c) => c.rapprochement === "aucun" || c.rapprochement === "ambigu"),
    rejets: rapport.rejets,
    signalements: rapport.signalements,
    incoherent: rapport.incoherent,
    /* Tolérer un rejet reviendrait à importer un historique amputé sans que
       personne ne s'en aperçoive avant la révision des comptes. */
    ecriturePossible: !rapport.incoherent && rapport.rejets.length === 0 && pieces.length > 0,
    pieces,
    clientACreerParPiece,
  };
}

/**
 * Écrit ce que l'aperçu a montré, et rien d'autre.
 *
 * Les fiches clients manquantes sont créées D'ABORD, et c'est le bon ordre :
 * une facture porte `client_id` dans son en-tête, et l'en-tête est gelé dès le
 * numéro posé. Rattacher après coup serait impossible — `client_id` est bien
 * dans `v_completables`, mais seulement de vide vers non-vide, et seulement
 * tant que personne n'a besoin du reste.
 *
 * Un client créé ici est minimal — un nom, et le marqueur d'origine. Il n'est
 * pas question d'inventer une adresse : l'import de clients existe pour ça, et
 * une fiche vide se complète, quand une fiche fausse se propage.
 */
export async function ecrireImportFactures(
  apercu: ApercuImportFactures,
  onProgress?: (faites: number, total: number) => void
) {
  if (!apercu.ecriturePossible) {
    throw new Error("L'aperçu n'autorise pas l'écriture : des pièces ont été écartées.");
  }
  const societe = societeUuid();

  const parCle = new Map<string, Uuid>();
  for (const c of apercu.clientsACreer) {
    const cree = await queries.createClient(societe, { nom: c.nom });
    parCle.set(cleNom(c.nom), cree.id as Uuid);
  }

  const pieces = apercu.pieces.map((p, i) => {
    const cle = apercu.clientACreerParPiece[i];
    const id = cle ? parCle.get(cle) : null;
    return id ? { ...p, entete: { ...p.entete, client_id: id } } : p;
  });

  const resultat = await queries.importerFactures(societe, pieces, onProgress);
  return { ...resultat, clientsCrees: parCle.size };
}

export function injecterImportFactures() {
  if (typeof window === "undefined") return;
  const w = window as unknown as Record<string, unknown>;
  /* L'écran n'a pas à savoir lire un en-tête de CSV : il demande. */
  w.natureDuFichier = natureDuFichier;
  w.previsualiserImportFactures = previsualiserImportFactures;
  w.ecrireImportFactures = ecrireImportFactures;
  w.supprimerBrouillonsImport = queries.supprimerBrouillonsImport;
  /* L'écran doit pouvoir reconnaître une pièce historique sans redéfinir la
     règle : c'est elle qui masque le bouton de transmission. */
  w.estPieceHistorique = estPieceHistorique;
  /* Le libellé annoncé à l'aperçu doit être CELUI qui sera écrit : deux
     définitions du même texte divergeraient à la première retouche. */
  w.DESIGNATION_SANS_LIGNES = DESIGNATION_SANS_LIGNES;
}
