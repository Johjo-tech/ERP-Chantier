# Inventaire de la couche TypeScript — ERP Chantier

> Relevé en lecture seule, branche `claude/erp-chantier-react-rewrite-zvhro4` (HEAD `a294c7a`), 24/09/2026.
> Périmètre : `src/api/**` (hors `database.types.ts`, consulté seulement pour vérifier colonnes, vues et RPC) et `src/integrations/**`.
> Contexte lu : `CLAUDE.md`, `docs/*.md` (ARCHITECTURE, API, SCHEMA, WORKFLOWS, AUTHENTICATION, TESTING, AUDIT_CONFORMITE).

## 0. Constats préalables (à lire avant tout le reste)

1. **Aucun fichier de test dans le dépôt.** Ni `*.test.ts`, ni `*.spec.ts`, ni `tests/`, ni `setup.ts` — ni dans `HEAD`, ni dans l'historique git accessible (50 commits, aucune suppression de test). `package.json` lance `vitest --passWithNoTests`. Or `CLAUDE.md`, `regles-totaux.ts` (« les tests en vérifient la parité chiffrée »), `regles-ocr.ts`, `regles-efacture.ts` (« Un test d'intégration les compare »), `html-adapter.ts` (« test de garde » sur `CHAMPS_SOCIETE`) citent des tests qui **n'existent pas ici**. Les vecteurs de parité du §1.9 ont donc été **calculés** en exécutant les modules purs (copie dans le scratchpad, `node --experimental-strip-types`), pas relevés dans des suites existantes.
2. **La doc `docs/` est largement périmée** : `API.md`, `ARCHITECTURE.md`, `WORKFLOWS.md` (24 lignes), `AUTHENTICATION.md` (parle de `members_societe.user_id`, alors que la table est `membres_societe.profile_id`), `queries/README.md` (cite `searchDevis`, `lockFacture`, `scheduleBCByMetier`, `uid()`… qui n'existent pas). `SCHEMA.md` est juste sur l'esprit (77 tables, vues de calcul) mais incomplet (8 vues en réalité, ~45 fonctions).
3. **Écarts à la règle « les calculs qui engagent vivent en base »** : `operations/workflows.ts#calculerSoldeFacture` recalcule le solde côté client (et `efacture.ts#preparerEmission` s'en sert pour BT-113) ; `ajouterReglementEtMajStatut` bascule `payée` côté client. `operations/workflows.ts` importe `integrations/html-adapter` (dépendance inverse du sens `pages → integrations → queries → client`). Commentaires périmés dans `workflows.ts` : « `bons_commande` n'a pas de colonne de rattachement » (faux : `bon_commande_parent_id`) et « `vehicules` n'a aucune colonne de date de CT » (faux : `date_controle_technique`).

---

## 1. Règles métier pures (`src/api/regles-*.ts`)

Toutes sont des **feuilles** (n'importent que des types, sauf exceptions notées). Montants : **nombres JS flottants**, pas de décimal ; le parseur commun est `parseFloat(String(v ?? ""))` → 0 si non fini.

### 1.1 Vue d'ensemble

| Module | Exports principaux | Décide |
|---|---|---|
| `regles-totaux` | `montantLigneHt`, `montantLigneTtc`, `ventilationTvaAffichage`, `totauxDocument`, `sousTotauxChapitres`, `formaterTaux`, `soldeAPayer`, `RETENUE_GARANTIE_USUELLE=5` | HT/TVA/TTC d'un document, remise globale, ventilation par taux, sous-totaux de chapitre, retenue de garantie + acomptes → net à payer |
| `regles-reglements` | `CENTIME=0.01`, `EPSILON=0.005`, `arrondiCentime`, `totalRegle`, `resteAPayer`, `statutReglement`, `statutEnBase`, `refusReglement`, `montantPropose`, `imputer`, `surplusImputation`, `refusImputation` | Solde d'une facture, statut déduit des règlements, contrôle de saisie, répartition d'un virement groupé (FIFO par date puis numéro) |
| `regles-avoir` | `estAvoir`, `signeDocument`, `libelleDocument`, `totauxSignes`, `MOTIFS_AVOIR`, `MODE_REGLEMENT_AVOIR="avoir"`, `MODE_REGLEMENT_IMPUTATION="imputation"`, `resteAImputer`, `statutImputation`, `avoirDisponible`, `montantImputable`, `refusImputationAvoir`, `refusAvoir` | Sens (+/−) d'un document, imputation d'un avoir sur une facture, conditions pour établir un avoir (motif ≥ 5 car.) |
| `regles-filtres-reglements` | `filtrerReglements`, `totalReglements`, `estRapproche`, `criteresVersRequete`, `criteresDepuisRequete`, `CRITERES_REGLEMENTS_VIDES` | Filtres de l'écran Règlements (période ISO incluse, client, mode, chantier, « rapproché » = `reference` non vide), total arrondi au centime, sérialisation URL |
| `regles-verrouillage` | `verrouFacture`, `verrouBonCommande`, `bonEstFacture`, `estAvoirDocument`, `ACTIONS_FACTURE_EMISE` | Facture numérotée = figée (art. L441-9, irréversible) ; `verrouillee` = cadenas d'écran réversible ; BC verrouillé dès qu'une facture liée est **numérotée** |
| `regles-bc` | `blocagesValidationConducteur`, `peutValiderConducteur`, `blocagesChiffrage`, `messageBlocages`, `etapeValidation`, `attenteAvantChiffrage`, `manquesBonCommande`, `lignesDeTravaux`, `essentielsDeLecture`, `refBonCommandeClient`, `lieuIntervention`, `tachesNonValidees`, `tachesNonPointees`, `travauxNonChiffres`, `lignesSansPrix` | Circuit BC : ce qui bloque la validation conducteur / le chiffrage ; champs obligatoires d'un BC ; référence client BT-13 |
| `regles-taches` | `STATUT_INITIAL="planifiee"`, `TRANSITIONS`, `transitionPermise`, `motifTransitionRefusee`, `actionsTache`, `motifLectureSeule`, `prochainActeur`, `refusRetourAuPlanning`, `cibleAPoserLaPiece`, `ciblesALeverLaPiece`, créneaux (`HEURE_DEFAUT="08:00"`, `DUREE_DEFAUT_H=1`, `DUREE_MIN_H=1`, `DUREE_MAX_H=8`, `creneauDeclare`, `finDuCreneau`, `colonnesDuCreneau`, `creneauDeLaTache`, `memeCreneau`, `creneauModifiable`) | Machine à états d'une tâche, droits par rôle sur une tâche, conversion heure+durée ⇄ `heure_debut/heure_fin` |
| `regles-metiers` | `METIER_AUCUN="(aucun)"`, `DISTANCE_MAX=2`, `LONGUEUR_MIN_APPROCHANTE=6`, `normaliserLibelle`, `memeMetier`, `referentielMetiers`, `metierDuChapitre`, `metierDeLaLigne`, `metierAffiche`, `tachesAcreer`, `metiersDesChapitres`, `travauxParMetier`, `travauxDeLaCarte`, `montantsParMetier` | Métier d'un chapitre (choisi > exact > contenu par mots entiers > approchant Levenshtein ≤ 2 sur mots ≥ 6), montants HT par métier (arrondi centime à chaque ajout) |
| `regles-efacture` | identifiants (`sirenValide`, `siretValide` Luhn + exception La Poste `356000000` somme%5, `cleTvaFr` = (12 + 3×(SIREN mod 97)) mod 97), cadres (`B2C`, `B2B_national` défaut, `B2G`, `B2B_international`), `REGIMES_TVA` (`franchise_en_base` ⇒ sans TVA, mention « TVA non applicable, art. 293 B du CGI »), délais (`DELAIS_PREREGLES`, `delaiPaiementRetenu`, `dateEcheance`, `libelleDelaiPaiement`, `delaiHorsPlafond` 60 j net / 45 j FDM), `MODES_REGLEMENT` (virement défaut, cheque, prelevement, carte, especes), `mentionsLegales`, `identifiantsLegaux`, complétude client/société | Tout ce qui est « légal » sur une facture FR et la complétude pour la facture électronique |
| `regles-en16931` | `TYPE_FACTURE=380`, `TYPE_AVOIR=381`, `TYPE_ACOMPTE=386`, `CODES_UNITE` (UNECE Rec 20), `codeUnite` (défaut `C62`), `manquesPourEmettre`, `deductionsDocument`, `totalDeductions`, `ventilationTva`, `codeTypeDocument`, `chargeEN16931`, `CODE_MOTIF_REMISE="95"` | Charge EN 16931 (JSON), remise → déductions BG-20 par taux, BR-CO-10 (tolérance 0,01 €) |
| `regles-cii` | `versCII`, `dateCII` (AAAAMMJJ), `PROFIL_EN16931`, `NOM_FICHIER_FACTURX="factur-x.xml"` | Sérialisation CII XML de la charge |
| `regles-emetteur` | `identiteEmetteur`, `identiteManquante` | Les 9 colonnes `emetteur_*` figées sur la facture (nom = raison sociale légale sinon nom ; SIREN = siren sinon 9 premiers chiffres du SIRET ; pays défaut FR) ; `""` → `null` |
| `regles-liens-facture-bc` | `cleRapprochement`, `construireIndexFactureBC`, `bonsDeLaFacture`, `facturesDuBon`, `apportsDuBon`, `apportsDeLaFacture` | Lien facture ↔ BC par référence client normalisée (O(F+B)) |
| `regles-ocr` | `ETAPES_LECTURE`, `DUREE_HABITUELLE_MS=30000`, `SEUIL_PLUS_LONG_QUE_DHABITUDE_MS=45000`, `DELAI_LECTURE_MS=120000`, `DELAI_BASCULE_ANALYSE_MS=2000`, `etatLecture`, `etatAnnule`, `etatDelaiDepasse`, `etatEchec`, `formaterDuree` | Messages de progression de la lecture OCR (voir §5) |
| `regles-csv` / `regles-encodage` | `lireCsv` (RFC 4180), `rapportRejetsCsv` / `decoderTexte`, `libelleEncodage` | Parseur CSV conforme ; détection BOM UTF-8/UTF-16, sinon UTF-8 strict, sinon Windows-1252 |
| `regles-import-articles` / `-clients` / `-factures` | voir §5 | Imports de fichiers |
| `regles-piece-jointe` | `MIMES_PIECE_JOINTE` (pdf, jpeg, png, webp), `TAILLE_MAX_PIECE_JOINTE=14_000_000`, `verifierPieceJointe`, `nomSurPourStockage`, `apercuDe`, `urlApercuPdf` | Pièce jointe BC |
| `regles-documents-rh` | `TYPES_DOCUMENT_RH` (13 types : contrat, avenant, dpae, pieceIdentite, titreSejour, carteBtp, habilitation, diplome, rib, mutuelle, arretTravail, attestation, autre ; drapeaux `perissable`/`obligatoire`/`multiple`), `etatDocumentRh` (permanent/valide/bientot/expire), `dossierSalarie`, `trierDocumentsRh` | Dossier RH |
| `regles-visite-medicale` | `TYPES_VISITE` (7), `REGIMES_SUIVI` (simple 60 mois, adapte 36, renforce 48 — plafonds), `AVIS_APTITUDE` (apte, apte_amenagements, inapte_temporaire, inapte), `ajouterMois`, `prochaineVisiteSuggeree`, `depasseLePlafondLegal`, `etatVisite` | Suivi médical |
| `regles-referentiels` | `normaliserEntree`, `memeEntree`, `entreesDuDomaine`, `referentielCompose`, `prochainePosition` | Listes de choix par domaine (table `referentiels`) |
| `regles-adresse` | `decouperAdresse` (regex CP 5 chiffres), `completerAdresse` | Découpe rue / CP / ville (miroir de la RPC `decouper_adresse`) |
| `regles-theme` | `ACCENT_DEFAUT="#FF6A1A"`, `SECONDAIRE_DEFAUT="#182233"`, `paletteAccent`, `paletteSecondaire`, `paletteSociete` (contraste AA 4,5) | Couleurs des documents imprimés |

**Arrondis — trois conventions coexistent** (à reproduire telles quelles pour la parité) :
- `regles-totaux` : **aucun arrondi** (flottants bruts ; le formatage se fait à l'affichage).
- `regles-reglements.arrondiCentime` : `sign(n) * round(|n|*100 + EPSILON*100)/100` (corrige 1,005 → 1,01), EPSILON = 0,005 pour « égal à zéro ».
- `regles-avoir.centimes`, `regles-en16931.centimes`, `regles-filtres-reglements.totalReglements`, `regles-metiers.montantsParMetier`, `regles-import-factures.totauxDe` : `Math.round(n*100)/100` (sans correction). EN 16931 : montants en chaîne `toFixed(2)`.

### 1.2 `regles-totaux.ts` — VERBATIM intégral

```ts
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

/**
 * Le montant TTC d'une ligne, à son propre taux de TVA.
 *
 * Le taux se porte ligne par ligne — un même document mêle couramment 10 % sur
 * la rénovation et 20 % sur le neuf. Le TTC d'une ligne n'est donc pas une
 * proportion du TTC du document, et c'est justement ce que le lecteur vient
 * vérifier en face de chaque poste.
 *
 * Avant remise, comme le HT : la remise est globale, elle ne descend pas à la
 * ligne. La somme des TTC de lignes vaut donc `ttcAvant`, pas `ttc`.
 */
export function montantLigneTtc(l: LigneMontant): number {
  const ht = montantLigneHt(l);
  return ht + ht * (nombre(l?.tva) / 100);
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

/** Taux d'usage de la retenue de garantie — loi du 16 juillet 1971. */
export const RETENUE_GARANTIE_USUELLE = 5;

export interface Deductions {
  /** Acomptes déjà versés par le client, en euros. */
  acomptes?: number | string | null;
  /** Part du TTC retenue au titre de la garantie, en pourcentage. */
  retenuePourcentage?: number | string | null;
}

export interface SoldeFacture {
  acomptes: number;
  retenuePourcentage: number;
  retenueMontant: number;
  netAPayer: number;
  /** Faux quand rien n'est déduit : le document n'a alors rien à ajouter. */
  aDesDeductions: boolean;
}

/**
 * Ce qu'il reste réellement à régler, une fois l'acompte et la retenue déduits.
 *
 * La retenue de garantie se calcule sur le **TTC** : elle porte sur le montant
 * du marché, pas sur sa base taxable. Et ce n'est pas une remise — la créance
 * reste entière, seul son versement est différé jusqu'à la levée. D'où un
 * « net à payer » distinct du total, et non un total diminué.
 *
 * Le net ne descend jamais sous zéro : un acompte supérieur au dû est une
 * situation réelle (avenant en moins-value), mais une facture qui réclamerait
 * un montant négatif ne veut rien dire — c'est un avoir qu'il faut alors
 * établir.
 */
export function soldeAPayer(
  totaux: { ttc: number },
  deductions: Deductions = {}
): SoldeFacture {
  const acomptes = Math.max(0, nombre(deductions.acomptes));
  const retenuePourcentage = Math.max(0, Math.min(100, nombre(deductions.retenuePourcentage)));
  const ttc = nombre(totaux?.ttc);

  const retenueMontant = (ttc * retenuePourcentage) / 100;

  return {
    acomptes,
    retenuePourcentage,
    retenueMontant,
    netAPayer: Math.max(0, ttc - acomptes - retenueMontant),
    aDesDeductions: acomptes > 0 || retenueMontant > 0,
  };
}
```

Points à retenir : ligne sans `type` = `"ligne"` ; chapitre/commentaire = 0 ; remise = pourcentage global borné [0,100] appliqué proportionnellement à HT, TVA, TTC (jamais à la ligne) ; la colonne « Total HT » d'une ligne est **avant remise** ; un taux 0 % apparaît dans la ventilation s'il porte une base (autoliquidation). Retenue de garantie **sur le TTC**, net à payer = max(0, TTC − acomptes − retenue).

### 1.3 `regles-reglements.ts` — fonctions de calcul (code verbatim, commentaires de bloc retirés)

```ts
export const CENTIME = 0.01;

export const EPSILON = CENTIME / 2;
function nombre(v: unknown): number {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

export function arrondiCentime(valeur: unknown): number {
  const n = nombre(valeur);
  return Math.sign(n) * Math.round(Math.abs(n) * 100 + Number.EPSILON * 100) / 100;
}

export function totalRegle(
  reglements: ReglementMontant[] | null | undefined,
  sauf?: string | null
): number {
  const somme = (reglements ?? [])
    .filter((r) => !sauf || r?.id !== sauf)
    .reduce((s, r) => s + nombre(r?.montant), 0);
  return arrondiCentime(somme);
}

export function resteAPayer(
  ttc: unknown,
  reglements: ReglementMontant[] | null | undefined,
  sauf?: string | null
): number {
  const reste = arrondiCentime(nombre(ttc) - totalRegle(reglements, sauf));
  return reste < EPSILON ? 0 : reste;
}

export function statutReglement(
  ttc: unknown,
  reglements: ReglementMontant[] | null | undefined
): StatutReglement {
  const total = arrondiCentime(ttc);
  const paye = totalRegle(reglements);
  const reste = resteAPayer(total, reglements);

  if (reste < EPSILON) {
    return { cle: "reglee", label: "Réglée", classe: "success", paye, reste, ttc: total };
  }
  if (paye < EPSILON) {
    return { cle: "non_reglee", label: "Non réglée", classe: "danger", paye, reste, ttc: total };
  }
  return {
    cle: "partiellement_reglee",
    label: "Partiellement réglée",
    classe: "warn",
    paye,
    reste,
    ttc: total,
  };
}

export function statutEnBase(cle: CleStatutReglement): "impayée" | "payée" {
  return cle === "reglee" ? "payée" : "impayée";
}

export function refusReglement(saisie: {
  montant?: number | string | null;
  ttc?: unknown;
  reglements?: ReglementMontant[] | null;
  idModifie?: string | null;
}): string | null {
  const montant = arrondiCentime(saisie?.montant);
  if (montant <= 0) return "Le montant doit être supérieur à 0.";

  const reste = resteAPayer(saisie?.ttc, saisie?.reglements, saisie?.idModifie);
  if (reste <= 0) {
    return "Cette facture est déjà entièrement réglée.";
  }
  if (montant - reste > EPSILON) {
    return `Le montant dépasse le reste à payer (${formaterEuros(reste)}).`;
  }
  return null;
}

export function montantPropose(
  ttc: unknown,
  reglements: ReglementMontant[] | null | undefined,
  idModifie?: string | null
): number {
  return resteAPayer(ttc, reglements, idModifie);
}

function formaterEuros(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} €`;
}

export function imputer(
  montantRecu: unknown,
  factures: FactureAImputer[] | null | undefined
): Imputation[] {
  let reste = arrondiCentime(montantRecu);
  if (reste <= 0) return [];

  const ordre = [...(factures ?? [])]
    .filter((f) => f && arrondiCentime(f.reste) > 0)
    .sort((a, b) => {
      const da = String(a.date ?? "");
      const db = String(b.date ?? "");
      if (da !== db) return da < db ? -1 : 1;
      return String(a.numero ?? "").localeCompare(String(b.numero ?? ""));
    });

  const imputations: Imputation[] = [];
  for (const f of ordre) {
    if (reste < EPSILON) break;
    const du = arrondiCentime(f.reste);
    const part = arrondiCentime(Math.min(du, reste));
    if (part < EPSILON) continue;
    imputations.push({
      id: f.id,
      numero: f.numero,
      montant: part,
      resteApres: arrondiCentime(du - part),
    });
    reste = arrondiCentime(reste - part);
  }
  return imputations;
}

export function surplusImputation(
  montantRecu: unknown,
  factures: FactureAImputer[] | null | undefined
): number {
  const total = imputer(montantRecu, factures).reduce((s, i) => s + i.montant, 0);
  return arrondiCentime(arrondiCentime(montantRecu) - total);
}

export function refusImputation(
  montantRecu: unknown,
  factures: FactureAImputer[] | null | undefined
): string | null {
  const montant = arrondiCentime(montantRecu);
  if (montant <= 0) return "Le montant reçu doit être supérieur à 0.";

  const du = arrondiCentime(
    (factures ?? []).reduce((s, f) => s + Math.max(0, arrondiCentime(f?.reste)), 0)
  );
  if (du <= 0) return "Les factures sélectionnées sont déjà réglées.";
  if (montant - du > EPSILON) {
    return `Le montant reçu dépasse le total dû (${formaterEuros(du)}). Un trop-perçu ne s'impute pas.`;
  }
  return null;
}
```

Règles clés : un trop-perçu n'est pas une dette (reste ≥ 0) ; facture à 0 € = « réglée » (le reste est testé **avant** le payé) ; `sauf`/`idModifie` exclut le règlement en cours d'édition ; en base, `factures.statut` ne connaît que `brouillon | impayée | envoyée | payée` → partiel = `impayée`.

### 1.4 `regles-avoir.ts` — sens et imputation (code verbatim, commentaires retirés)

```ts
const LONGUEUR_MOTIF_MIN = 5;

export function estAvoir(typeDocument: TypeDocument): boolean {
  return String(typeDocument ?? "")
    .toLowerCase()
    .includes("avoir");
}

export function signeDocument(typeDocument: TypeDocument): 1 | -1 {
  return estAvoir(typeDocument) ? -1 : 1;
}

export function libelleDocument(typeDocument: TypeDocument): string {
  const t = String(typeDocument ?? "").toLowerCase();
  if (t.includes("avoir")) return "AVOIR";
  if (t.includes("acompte")) return "FACTURE D'ACOMPTE";
  return "FACTURE";
}

export function totauxSignes(
  totaux: TotauxDocument,
  typeDocument: TypeDocument
): TotauxDocument {
  const signe = signeDocument(typeDocument);
  if (signe === 1) return totaux;

  return {
    ...totaux,
    htAvant: -totaux.htAvant,
    tvaAvant: -totaux.tvaAvant,
    ttcAvant: -totaux.ttcAvant,
    remiseMontantHT: -totaux.remiseMontantHT,
    ht: -totaux.ht,
    tva: -totaux.tva,
    ttc: -totaux.ttc,
    ventilation: totaux.ventilation.map((v) => ({
      taux: v.taux,
      base: -v.base,
      montant: -v.montant,
    })),
  };
}

/**
 * Les motifs usuels d'un avoir dans le bâtiment.
 *
 * Proposés, jamais imposés : le dernier cas ouvre la saisie libre. Une liste
 * fermée obligerait à ranger sous un intitulé faux la rectification qui ne
 * rentre nulle part — et c'est ce texte qui s'imprime sur le document.
function centimes(n: number): number {
  return Math.round(n * 100) / 100;
}

function nombre(v: unknown): number {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

const EPSILON = 0.005;

export function resteAImputer(
  ttcAvoir: unknown,
  reglements: ReglementMontantAvoir[] | null | undefined
): number {
  const credit = Math.abs(centimes(nombre(ttcAvoir)));
  const impute = centimes((reglements ?? []).reduce((s, r) => s + nombre(r?.montant), 0));
  const reste = centimes(credit - impute);
  return reste < EPSILON ? 0 : reste;
}

export interface StatutImputation {
  cle: "disponible" | "partiellement_impute" | "impute";
  label: string;
  classe: string;
  impute: number;
  reste: number;
  ttc: number;
}

export function statutImputation(
  ttcAvoir: unknown,
  reglements: ReglementMontantAvoir[] | null | undefined
): StatutImputation {
  const credit = Math.abs(centimes(nombre(ttcAvoir)));
  const reste = resteAImputer(ttcAvoir, reglements);
  const impute = centimes(credit - reste);
  const ttc = centimes(nombre(ttcAvoir));

  if (reste < EPSILON) {
    return { cle: "impute", label: "Imputé", classe: "success", impute, reste, ttc };
  }
  if (impute < EPSILON) {
    return { cle: "disponible", label: "Disponible", classe: "info", impute, reste, ttc };
  }
  return {
    cle: "partiellement_impute",
    label: "Partiellement imputé",
    classe: "warn",
    impute,
    reste,
    ttc,
  };
}

export function avoirDisponible(
  ttcAvoir: unknown,
  reglements: ReglementMontantAvoir[] | null | undefined
): boolean {
  return resteAImputer(ttcAvoir, reglements) > 0;
}

export function montantImputable(resteFacture: unknown, resteAvoir: unknown): number {
  const f = Math.max(0, centimes(nombre(resteFacture)));
  const a = Math.max(0, centimes(nombre(resteAvoir)));
  return centimes(Math.min(f, a));
}

```

`refusImputationAvoir` (ordre des contrôles et messages exacts) : « Avoir introuvable. » → « Facture introuvable. » → « Ce document n'est pas un avoir. » → « Un avoir ne s'impute pas sur un autre avoir. » → facture sans numéro « Cette facture n'est pas émise : il n'y a rien à solder. » → clients différents (comparaison de `clientNom` trimés, seulement si les deux sont renseignés) « Cet avoir a été établi pour X : il ne peut pas solder une facture de Y. » → montant ≤ 0 → reste avoir ≤ 0 « Cet avoir est déjà entièrement imputé. » → montant − resteAvoir > 0,005 « Cet avoir ne dispose plus que de N,NN €. » → reste facture ≤ 0 → montant − resteFacture > 0,005 « La facture ne doit plus que N,NN €. ».
`refusAvoir` : facture introuvable → pas de numéro (« modifiez-la directement ») → déjà un avoir (« il faut refacturer ») → motif trimé < 5 caractères.
`MOTIFS_AVOIR` : Erreur de facturation (quantité ou montant) ; Prestation non réalisée ; Travaux non conformes ; Remise commerciale accordée après facturation ; Erreur de destinataire ; Double facturation ; Annulation de la commande (+ saisie libre).
Attention : `regles-avoir.estAvoir` teste `includes("avoir")` (insensible à la casse) alors que `regles-verrouillage.estAvoirDocument` teste l'égalité stricte `trim() === "avoir"`.

### 1.5 TVA et remise en EN 16931 (`regles-en16931.ts`, code verbatim, commentaires retirés)

```ts
function centimes(n: number): number {
  return Math.round(n * 100) / 100;
}

export function deductionsDocument(
  lignes: LigneEN16931[],
  remisePourcentage: number | null | undefined
): DeductionEN16931[] {
  const pct = Number(remisePourcentage ?? 0) || 0;
  if (pct <= 0) return [];

  const parTaux = new Map<number, { base: number; categorie: string }>();
  for (const l of lignes) {
    const taux = Number(l.tva ?? 0) || 0;
    const base = Number(l.montantHt ?? 0) || 0;
    if (base === 0) continue;
    const acc = parTaux.get(taux) ?? {
      base: 0,
      categorie: l.tvaCategorie || (taux > 0 ? "S" : "Z"),
    };
    acc.base += base;
    parTaux.set(taux, acc);
  }

  return [...parTaux.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([taux, acc]) => ({
      montant: centimes((acc.base * pct) / 100),
      base: centimes(acc.base),
      pourcentage: pct,
      tvaCategorie: acc.categorie,
      tvaTaux: taux,
      motif: MOTIF_REMISE,
      motifCode: CODE_MOTIF_REMISE,
    }));
}

export function totalDeductions(deductions: DeductionEN16931[]): number {
  return centimes(deductions.reduce((s, d) => s + d.montant, 0));
}

export function ventilationTva(
  lignes: LigneEN16931[],
  deductions: DeductionEN16931[] = []
) {
  const parTaux = new Map<number, { base: number; categorie: string; motif?: string }>();

  for (const l of lignes) {
    const taux = Number(l.tva ?? 0) || 0;
    const base = Number(l.montantHt ?? 0) || 0;
    const acc = parTaux.get(taux) ?? {
      base: 0,
      categorie: l.tvaCategorie || (taux > 0 ? "S" : "Z"),
      motif: l.tvaMotifExoneration ?? undefined,
    };
    acc.base += base;
    parTaux.set(taux, acc);
  }

  const deduitParTaux = new Map<number, number>();
  for (const d of deductions) {
    deduitParTaux.set(d.tvaTaux, (deduitParTaux.get(d.tvaTaux) ?? 0) + d.montant);
  }

  return [...parTaux.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([taux, acc]) => {
      const assiette = centimes(acc.base - (deduitParTaux.get(taux) ?? 0));
      return {
        vat_category_code: acc.categorie,
        vat_category_rate: String(taux),
        vat_category_taxable_amount: montant(assiette),
        vat_category_tax_amount: montant(centimes((assiette * taux) / 100)),
        ...(acc.motif ? { vat_exemption_reason_text: acc.motif } : {}),
      };
    });
}

/**
 * Les mentions que le code de commerce impose sur toute facture française
 * (BR-FR-05). Elles voyagent en notes typées, pas en texte libre : c'est ce qui
 * permet au destinataire de les lire.
```

Catégorie de TVA par défaut d'une ligne : `l.tvaCategorie || (taux > 0 ? "S" : "Z")`. `chargeEN16931` : avoir ⇒ tous les montants et quantités multipliés par −1 (les montants sont **stockés positifs**) ; sans remise, les totaux viennent de la facture (`v_facture_totaux`), avec remise ils sont recalculés (HT = somme lignes − déductions ; TVA = somme des TVA ventilées arrondies) ; BT-113 `paid_amount` = `montantRegle + acomptesDeduits` ; BT-115 = TTC − réglé ; notes légales PMT (indemnité, défaut 40 €), PMD (pénalités, défaut « taux annuel de 10 % »), AAB (escompte, défaut « Pas d'escompte pour paiement anticipé. »), AAI (mentions complémentaires). `manquesPourEmettre` exige BT-1 numéro, BT-2 date, BR-FR-10 SIREN/SIRET émetteur, BT-27, BT-44, BT-49 (seulement si le cadre relève de la facture électronique : pas B2C ni B2B_international), BT-55, BG-25 ≥ 1 ligne, BR-CO-10 |somme lignes − totalHt| ≤ 0,01.

### 1.6 Délais, échéance et mentions (`regles-efacture.ts`)

- `delaiPaiementRetenu(client, societe)` : client (y compris **0** = à réception, `??` et non `||`) → société → `{30, "net"}`. Mode inconnu ⇒ `net`.
- `dateEcheance(date, {jours, mode})` en **UTC** : `net` = date + jours ; `fin_de_mois` = `Date.UTC(a, mois+1, jours)` (jours comptés depuis le **dernier jour du mois** de facture). Date malformée ⇒ `""`. Miroir de la RPC `date_echeance`.
- `DELAIS_PREREGLES` : reception 0/net, net30, net45, net60, fdm30, fdm45, fdm60. `CLE_DELAI_PAR_CADRE = { B2C: "reception" }`.
- `mentionsLegales` : pénalités (défaut « …taux d'intérêt légal majoré de 10 points. »), « Indemnité forfaitaire pour frais de recouvrement : 40.00 € » (toFixed(2), point décimal), franchise 293 B, autoliquidation « article 283-2 nonies du CGI » si `autoliquidation_batiment`, « TVA exigible à l'encaissement » si `tva_sur_encaissements`, assurance décennale.
- `INDEMNITE_RECOUVREMENT_EUR = 40`, `PAYS_DEFAUT = "FR"`, schémas d'adresse électronique ISO 6523 : `0009` SIRET, `0225` SIREN, `0002` immatriculation légale.
- Réglages société par défaut (`integrations/reglages.ts`) : `TAUX_TVA_DEFAUT = [0, 2.1, 5.5, 10, 20]`, `tvaDefaut: 10`, `validiteDevisJours: 30`, `delaiPaiementJours: 30`, `modeDelaiPaiement: "net"`, `UNITES_DEFAUT = ["U","ml","m²","m³","h","j","forfait","kg","l","ens"]`.

### 1.7 Machine à états des tâches et du bon de commande

- Tâche (`regles-taches`) : `planifiee → realisee` (geste `realiser`, depuis `planifiee|refusee`) ; `realisee → validee|refusee` (geste `arbitrer`) ; refus motivé obligatoire (`validerTache`). `actionsTache(statut, role, appartenance)` : `peutPlanifier` = admin|conducteur ; `peutSaisir` = terrain de l'équipe (ou encadrement) et statut ≠ validee ; `peutCloturer` = idem + transition `realiser` permise ; `peutArbitrer` = admin|conducteur + statut realisee. Terrain = `technicien|sous_traitant`. Créneau modifiable seulement si `planifiee|refusee`. Retour au planning refusé s'il existe une tâche `validee` (« ouvrez un SAV »).
- BC (`types.ts` `StatutWorkflowBC`) : `en_cours → pret_a_chiffrer → chiffre → facture`, ou `cloture_gratuit`. `blocagesChiffrage` ordre : `deja_facture` → `cloture_gratuit` → `deja_chiffre` → (hors circuit sinon) `aucune_tache` / `taches_non_validees` → `travaux_non_chiffres` (statut `a_chiffrer`) → `lignes_sans_prix` (ligne type `ligne` avec `prixUnitaire` non > 0). `messageBlocages` cite 5 détails puis « et N autre(s) ». `blocagesValidationConducteur` : `aucune_tache`, `metiers_sans_tache`, `taches_non_pointees` (≠ realisee/validee).
- File de validation (`etapeValidation`) : `hors_file` si validé directeur ou 0 tâche ; `pret` si validé conducteur ; `travaux_en_cours` si au moins une tâche pointée.
- `manquesBonCommande` : adresse d'intervention + ≥ 1 ligne de travaux (type ligne, désignation non vide ; le prix n'est pas exigé). `refBonCommandeClient` : première ligne du `numero_bc`, écarte `""`, `SAV-*`, « Sans BC », « En attente de BC » (miroir SQL `ref_bc_client`).

### 1.8 Tests existants

**Aucun** (voir §0.1). Rien à recopier.

### 1.9 Vecteurs de parité calculés (entrée → sortie, exécution réelle des modules)

Lignes de test `L` = `[chapitre, {ligne 1×100 @20}, {ligne "2"×"50" @10}, {commentaire 5×5 @20}, chapitre, {sans type 3×33.33 @5.5}, {ligne 1×200 @0}]`.

| # | Appel | Résultat |
|---|---|---|
| A1 | `totauxDocument(L, 10)` | htAvant 499.99 ; tvaAvant 35.49945 ; ttcAvant 535.48945 ; remiseMontantHT 49.999 ; ht 449.991 ; tva 31.949505 ; ttc 481.940505 ; ventilation `[{0,180,0},{5.5,89.991,4.949505},{10,90,9},{20,90,18}]` |
| A2 | `totauxDocument(L, 150).remisePct` | 100 (borné) |
| A3 | `sousTotauxChapitres(L)` | `[200, 299.99]` (lignes avant le 1er chapitre ignorées) |
| A4 | `montantLigneTtc({qte:2,prixUnitaire:50,tva:10})` | 110 |
| A5 | `formaterTaux(5.5)` | `"5,5 %"` |
| A6 | `soldeAPayer({ttc:1200},{acomptes:300,retenuePourcentage:5})` | retenue 60, net 840, aDesDeductions true |
| A7 | `soldeAPayer({ttc:100},{acomptes:150})` | net 0 (plancher) |
| B1/B2 | `arrondiCentime(1.005)` / `(-1.005)` | 1.01 / −1.01 |
| B3 | `resteAPayer(100,[{30},{"20.5"}])` | 49.5 |
| B4 | `resteAPayer(100,[{120}])` | 0 |
| B5 | `statutReglement(0,[])` | `reglee` |
| B6/B7 | `statutReglement(100,[])` / `(100,[{40}])` | `non_reglee` reste 100 / `partiellement_reglee` payé 40 reste 60 |
| B8 | `statutReglement(0.1+0.2,[{0.3}])` | `reglee` |
| B10 | `refusReglement({montant:80,ttc:100,reglements:[{id:"a",30}]})` | « Le montant dépasse le reste à payer (70,00 €). » |
| B11 | idem avec `idModifie:"a"` | `null` |
| B12 | `imputer(250,[f3 100 2026-03-01 FAC-3, f1 100 2026-01-01 FAC-1, f2 100 2026-01-01 FAC-0])` | f2 100 (reste 0), f1 100 (0), f3 50 (reste 50) |
| B13/B14 | `surplusImputation(350,[100,200])` / `refusImputation` | 50 / « Le montant reçu dépasse le total dû (300,00 €). Un trop-perçu ne s'impute pas. » |
| C1 | `totauxSignes(totauxDocument([1×568.33@20]),"avoir")` | tous montants négatifs (ttc −681.996), remisePct inchangé |
| C2/C3 | `resteAImputer(-682,[])` / `statutImputation(-682,[{200}])` | 682 / `partiellement_impute` impute 200 reste 482 ttc −682 |
| C5 | `montantImputable(300,682)` | 300 |
| D1 | `dateEcheance("2026-01-15",{45,"fin_de_mois"})` | `2026-03-17` |
| D2 | `dateEcheance("2026-01-31",{30,"net"})` | `2026-03-02` |
| D3 | `dateEcheance("2026-12-15",{30,"fin_de_mois"})` | `2027-01-30` |
| D4 | `dateEcheance("2026-02-10",{0,"fin_de_mois"})` | `2026-02-28` |
| D5/D6 | `delaiPaiementRetenu({delaiPaiementJours:0},{45,fdm})` / `(null,null)` | `{0,net}` / `{30,net}` |
| D9 | `tvaIntracomFr("732829320")` | `FR44732829320` |
| E1 | `deductionsDocument([A 100@20, B 2×50=100@10], 10)` | deux déductions de 10 (taux 10 puis 20), base 100, code 95 |
| E2 | `ventilationTva(idem, E1)` | taux 10 : assiette 90.00 TVA 9.00 ; taux 20 : 90.00 / 18.00 |
| E3 | `chargeEN16931` avoir, remise 10 %, mêmes lignes | sum_lines −200.00, allowance −20.00, HT −180.00, TVA −27.00, TTC −207.00, dû −207.00 |
| E4 | `codeTypeDocument(facture/avoir/acompte)` | 380 / 381 / 386 |
| E5 | `codeUnite("m²","ML","pièce","xyz")` | MTK / MTR / C62 / C62 |

Vecteurs d'import en §5.

---

## 2. Permissions, rôles, sociétés

### 2.1 Source de la matrice

`src/integrations/permissions.ts` **ne contient plus la matrice** : elle est lue au démarrage dans la table `role_permissions(role, module, action)` (`queries/acces.listRolePermissions`, refus si tronquée ou vide) et installée par `installerMatrice()`. `peut()` **lève** si la matrice n'est pas installée. La même table est lue par `a_permission_du_role()` / `a_permission(societe, module, action)` (utilisée par ~249 politiques RLS). Contenu reconstitué depuis `supabase/migrations/20260911110000_matrice_des_droits_en_table.sql` + `20260914120000_catalogue_articles.sql` (module `articles`) :

Légende : V voir · C créer · M modifier · S supprimer · — rien.

| Module | admin | secretaire | conducteur | technicien | sous_traitant | lecture |
|---|---|---|---|---|---|---|
| tableau_de_bord | VCMS | V | V | V | V | V |
| chantiers | VCMS | V | VCMS | V | V | V |
| planning | VCMS | V | VCMS | V | V | V |
| bons_commande | VCMS | V M | VCMS | — | — | V |
| devis | VCMS | VCMS | VCM | — | — | V |
| factures | VCMS | VCMS | V | — | — | V |
| facturation_electronique | VCMS | VCMS | — | — | — | V |
| reglements | VCMS | VCMS | — | — | — | V |
| clients | VCMS | VCMS | V | — | — | V |
| rapports (interventions) | VCMS | V | VCMS | VCM | VCM | V |
| materiel | VCMS | V | VCMS | V M | V | V |
| controle_fournisseurs | VCMS | VCMS | V | — | — | V |
| rh | VCMS | VCMS | V | V | — | V |
| vehicules | VCMS | VCMS | V M | V | — | V |
| statistiques | VCMS | V | V | — | — | V |
| reglages | VCMS | V | V | — | — | V |
| articles | VCMS | VCMS | V | — | — | V |
| utilisateurs | VCMS | — | — | — | — | — |

Rôles (`role_membre`) et libellés : `admin` Administrateur, `secretaire` Secrétaire, `conducteur` Conducteur de travaux, `technicien` Technicien, `lecture` Lecture seule, `sous_traitant` Sous-traitant (entreprise).

`MODULE_PAR_NAV` (onglet → module) : dashboard→tableau_de_bord, planning, bonsCommande→bons_commande, devis, factures, interventions→rapports, chantiers, reglements, clients, catalogue→articles, rh, sousTraitants→rh, vehicules, materiel, piecesCommande→bons_commande, controle→controle_fournisseurs, statistiques, parametres→reglages, plus→tableau_de_bord.

Règles hors matrice (codées en dur, miroirs de la base) :
- `voitLesPrix(role)` = rôle ≠ technicien/sous_traitant (miroir SQL `voit_les_prix()`). Côté base, les vues `v_bons_commande_terrain` (annule `montant`, `montant_par_metier`, `montant_sous_traitant`), `v_bon_commande_lignes_terrain` (`prix_unitaire`), `v_travaux_supplementaires_terrain` (`prix_vente_ht`), `v_salaries_annuaire` (salaire, coût horaire, IBAN, naissance, nationalité, situation familiale, solde CP, mutuelle, retraite, n° SS — critère redéfini le 21/09 sur le droit RH) renvoient `NULL` ; `devis`, `factures`, `articles`, `reglements` et leurs filles sont carrément fermés en SELECT au terrain.
- `actionsFacturation(role)` (session.ts) : `peutValiderPrefacture` = admin ; `peutModifierPrefacture` = admin|secretaire ; `peutFacturer` = admin|secretaire ; `peutFacturerHorsCircuit` = admin (garde réelle : `42501` de la RPC `bc_chiffrage_valide_hors_circuit`, tracé au `workflow_journal`).
- `actionsTache` (§1.7).

### 2.2 Session, société courante, rôle (`integrations/session.ts`, `auth-guard.ts`, `main.ts`)

Séquence de démarrage (`src/main.ts`, via `pages/entry.ts`) : `protectRoute()` (pas de session → `location.replace("/login.html")`) → `injectGlobalFunctions()` (pont données) → `injecterSession()` + catalogue + imports → `setIdentite(email, user.id)` → `chargerSession()` → `chargerIntervenants()` → erreur si aucune société → `watchAuthState(viderCache)` (SIGNED_OUT → login) → `window.__erpBridge.resolve(societes)` qui débloque `app.js`.

`chargerSession()` : 1) `installerMatrice(listRolePermissions())` ; 2) `listMesSocietes()` = `select * from societes order by nom` (la RLS ne rend que les sociétés dont on est membre) ; 3) pour chacune `rpc("mon_role", {p_societe})` (erreur ⇒ `null`) ; 4) `SocieteAccessible = { id: societes.code (code court « kta »), nom, uuid, role }` ; **société courante = la première** (ordre alphabétique du nom) ; `choisirSociete(code)` bascule. Côté pont, `definirSocieteActive(code)` restreint les lectures à cette société (sinon la RLS rendrait toutes celles du membre).

**Multi-sociétés** : oui. Colonne de cloisonnement `societe_id` (uuid) sur les tables racines ; tables filles cloisonnées via le parent (`rls_table_fille`) ; `interlocuteurs` n'a pas de `societe_id` (lu via `clients!inner(societe_id)`). Appartenance : `membres_societe(profile_id, societe_id, role, actif)`. Fonctions : `mes_societes()`, `mon_role(p_societe)`, `role_dans_societe()`, `est_membre()`, `est_admin()`, `peut_ecrire()`. Pas d'entité « entreprise » distincte : « société » = `societes` (identité légale en colonnes + jsonb `societe_settings.infos_entreprise`). Numérotation par (société, type, année) dans `compteurs`.

**« Voir en tant que »** : `simulerRole(role)` — **réservé à l'admin réel**, persisté dans `localStorage["erp.role.simule"]`, restauré à chaque changement de société (effacé si le rôle réel n'est pas admin). `roleEffectif() = roleSimule ?? roleReel()`. N'a **aucun effet en base** (RLS toujours avec le rôle réel) : il ne sert qu'à masquer. Tous les `autorise*`, `affichePrix`, `actionsTache`, `actionsFacturation` utilisent le rôle effectif.

Autres : `definirRoleDuCompte(profileId, role)` (update `membres_societe.role`, RLS : admin) → `change|inchange|absent|refuse` ; `definirMonNom` (update `profiles.nom`, politique `profiles_update_self`) ; `getCurrentUser()` lit `profiles` ; mot de passe oublié → `resetPasswordForEmail` vers `/nouveau-mot-de-passe.html`. Invitations : Edge Function `inviter-salarie` (clé de service côté serveur) puis rattachement automatique en base (`appliquer_invitations`).

**Accès client (portail client)** : **inexistant**. Aucun rôle client, aucune route, aucun lien de partage public ; le seul accès externe est le rôle `sous_traitant` (entreprise sous-traitante, lecture terrain + rapports).

---

## 3. Accès aux données

### 3.1 Client et helpers (`src/api/client.ts`)

- `createClient<Database>(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)` ; erreurs → `SupabaseError(message, code, details)` ; `NO_ROWS = "PGRST116"`.
- Génériques : `listBySociete(table, societeId)` (`eq societe_id`, `order cree_le desc`), `listByParent(table, fk, id, order="position")`, `listByParents` (lots de `LOT_PARENTS = 100` uuid pour ne pas dépasser 16 Ko d'URL), `getOne`, `getByLegacyId`, `insertOne`, `insertMany`, `upsertByLegacyId` (`onConflict: "societe_id,legacy_id"`), `updateOne`, `remove`, `removeByParent`, `dyn()` (échappe au typage pour les noms dynamiques).
- Numérotation : `getNextNumero(societeId, type, annee)` → **RPC `prochain_numero(p_annee, p_societe, p_type)`**, types `devis | facture | intervention | bon_commande | sav`. Format (miroir `apercuNumero`, défaut SQL `numero_suivant_interne`) : `PREFIXE-AAAA-NNNNNN` (6 chiffres). Séries réglables (`SERIES_NUMEROTATION`) : DEV, FAC, INT (et non RAP), SAV ; les BC n'ont pas de série (numéro du client) ; `reglerCompteur` upsert `compteurs` (`onConflict societe_id,type,annee`, `valeur` = dernier numéro attribué). La facture reçoit son numéro **par trigger** (`facture_attribuer_numero`) au passage hors `brouillon`.
- Dates : `todayISO()` / `dateISO(d)` en composantes locales (jamais `toISOString`), `fmtDate` JJ/MM/AAAA, `money` = `Intl.NumberFormat("fr-FR", EUR)`.
- **Storage** : bucket **privé `terrain`**, chemin `<societeId>/<domaine>/<entityId>/<Date.now()>_<nom>` (le 1er segment est la clé des policies Storage). `uploadFile`, `getSignedFileUrl(path, {secondes=3600, telechargement})`, `deleteFile`. Domaines : `bons-commande` (pièce jointe BC), `salaries` (documents RH et attestations de visite). Pas de `getPublicUrl`.
- Temps réel : `onTableChange(table, societeId)` (canal postgres_changes filtré `societe_id=eq.`) — non utilisé par l'écran relevé.

### 3.2 Par fichier `queries/*.ts`

| Fichier | Tables / vues lues | Écrit | RPC / particularités |
|---|---|---|---|
| `acces.ts` | `societes`, `role_permissions` (`count: exact`), `membres_societe` + `profiles(id,nom,email)` | `profiles.nom`, `membres_societe.role` | `mon_role`, `a_permission` |
| `articles.ts` | `articles` (recherche paginée `or(code.ilike,designation.ilike)`, `actif`, `type_article`, `famille` ; familles distinctes ; `getArticleParCode` actif seulement) | CRUD, `desactiverArticle` (`actif=false`, jamais de delete à l'écran), `importerArticles` upsert `onConflict: societe_id,code` par lots de 200 | — |
| `bonCommande.ts` | `bons_commande`, `bon_commande_lignes`, `bon_commande_photos` ; `listSAV` = BC dont `bon_commande_parent_id` = id | insert/update/delete, `replaceBonCommandeLignes` (delete+insert, `position` = index), `replaceBonCommandePhotos` (chemins Storage), `setScheduleParMetier` (jsonb `schedule_par_metier`), `markBCReceived` (`date_reception`) | Pas de numérotation ; `createSAV` recopie l'en-tête (sauf id, dates, legacy_id, numero_bc, numero_interne), `numero_bc = prochain_numero(sav)`, `bon_commande_parent_id` |
| `chantiers.ts` | `chantiers` + `chantier_dpgf_lignes`, `_todos`, `_documents`, `_achats`, `_inspections`, `_comptes_rendus`, `_devis_complementaires` ; vue `v_chantier_avancement` | CRUD chantier et filles | — |
| `clients.ts` | `clients` (`resolveClientByNom` = `ilike nom`), `interlocuteurs`, `clientsRapprochables` (id, nom, siret, siren, cadre_facturation, delai_paiement_jours) | CRUD ; `importerClients` insert par lots de 200 **clés uniformisées** (piège `columns=`), mises à jour une par une | — |
| `devis.ts` | `devis`, `devis_lignes`, vue `v_devis_totaux` | `createDevis` (numéro fourni sinon `prochain_numero("devis")`), `replaceDevisLignes`, statut | Lignes supprimées en cascade |
| `factures.ts` | `factures`, `facture_lignes`, `reglements`, `societes`, vues `v_facture_totaux`, `v_facture_solde` | `createFacture`, `emettreFacture`, `replaceFactureLignes`, `createAvoir`, `createFactureFromDevis`, `createFactureFromBC`, `addReglement`, `imputerAvoir` (2 règlements), `deleteReglement` | voir §4 |
| `factures-import.ts` | `factures.numero` (`numerosDejaPris`, lots de 200) | écriture pièce par pièce en 3 temps (§5) ; `supprimerBrouillonsImport` (`delete … is numero null`) | codes 42501/23502/23505/23503/2201G traduits |
| `interventions.ts` | `interventions`, `intervention_photos`, `intervention_controles` | CRUD, `updateInterventionRapport` (constatations, préconisations), `signIntervention` (`signature_chemin`), replace photos/contrôles | — |
| `invitations.ts` | `invitations` (tri `cree_le desc`) | annuler (update statut), supprimer | envoi par Edge Function (integrations) |
| `parametres.ts` | `societes` (par id / par code), `societe_settings` (upsert `onConflict societe_id`), `compteurs`, `metiers`, `sous_traitants`, `sous_traitant_documents`, `fournisseurs_controle`, `documents_legaux` | CRUD ; `reglerCompteur` | `SERIES_NUMEROTATION`, `apercuNumero` |
| `planning.ts` | `planning_taches` (par société, par BC, par technicien/période, `statut=realisee`), `salaries` (équipe = `technicien_id`), `tache_travaux_supplementaires`, `bons_commande` | `planifierTache` (statut `planifiee`), `updateTache`, `deleteTache`, `affecterSalarieAEquipe`, travaux sup. (statut `a_chiffrer` → `chiffre` → `integre`) | **`tache_sauvegarder_terrain`**, **`tache_marquer_realisee`**, **`tache_valider`**, **`bc_piece_recue`**, **`bc_passer_pret_a_chiffrer`**, **`bc_chiffrage_valide`**, **`bc_chiffrage_valide_hors_circuit`**, **`bc_generer_facture`** (rend l'uuid de la facture), **`bc_cloturer_gratuit`** |
| `rh.ts` | `salaries` + `salarie_habilitations`, `_absences`, `_contrats`, `_formations`, `_documents`, `_visites_medicales` ; `conducteurs`, `techniciens` (= équipes), `vehicules` + `vehicule_controles_periodiques`, `_documents`, `_entretiens` ; `materiels` | CRUD correspondants | — |

Autres lectures directes : `operations/efacture.ts` (`societes`, `clients`, `pdp_connexions`), `auth-guard.ts` (`profiles`), `html-adapter.ts` (§3.3).

**Edge Functions** (`functions.invoke`) : `extraire-bc` (OCR, §5), `inviter-salarie` (`{salarie_id, email, role}` → `{etat}`), `pdp-emit-invoice` (`{facture_id, xml}` → `{depose, identifiant, error}`). Présentes dans `supabase/functions/` mais non appelées depuis la couche TS relevée : `pdp-check-eligibility`, `pdp-disconnect`, `pdp-ereporting`, `pdp-invoice-file`, `pdp-oauth-callback`, `pdp-oauth-start`, `pdp-post-lifecycle`, `pdp-receive`, `pdp-sync-events`, `pdp-webhook`, `prochain-numero`. Les motifs d'erreur sont relus dans `error.context.json().erreur`.

**API externes (navigateur, sans clé)** : `https://api-adresse.data.gouv.fr/search/` (BAN, `adresse.ts`), `https://recherche-entreprises.api.gouv.fr/search` (annuaire SIREN/SIRET, `entreprise.ts`).

### 3.3 Le pont `integrations/html-adapter.ts`

Surface posée sur `window` : `stGet`, `stSet`, `stDelete`, `stListKeys`, `dernierRefus`, `echecsDeLecture`, `oublierEchecsDeLecture`, `uuidDeLaCle`, `retirerDatesSupplementaires`, `definirSocieteActive`, `nextNumero`, `nextSAVNumero`, `loadAllData`, `exportAllData`. Clés `préfixe:id` (ancien kv_store), `settings:<code>` pour les réglages.

Registre `COLLECTIONS` (préfixe → table) :

| Préfixe | Table | Vue de lecture | Filles | Particularités |
|---|---|---|---|---|
| devis | devis | — | devis_lignes (`montant_ht` écrit) | client_nom |
| facture | factures | — | facture_lignes (`montant_ht`) | client_nom ; émission différée |
| bonCommande | bons_commande | **v_bons_commande_terrain** | bon_commande_lignes (lecture **v_bon_commande_lignes_terrain**), bon_commande_photos | alias `bonCommandeId → bon_commande_parent_id` ; pièce jointe ; circuit tâches |
| intervention | interventions | — | intervention_photos | `rapport{constatations,preconisations}` ⇄ 2 colonnes |
| client, article, reglement, conducteur, referentiel, sousTraitant, fournisseur, vehicule, materiel | clients, articles, reglements, conducteurs, referentiels, sous_traitants, fournisseurs, vehicules, materiels | — | — | — |
| interlocuteur | interlocuteurs | — | — | société via `clients!inner(societe_id)` |
| technicien | techniciens | — | — | alias `nom1 → nom` |
| metierPerso | metiers | — | — | alias `nom → libelle` |
| chantier | chantiers | — | chantier_achats | — |
| salarie | salaries | **v_salaries_annuaire** | — | — |
| document | documents_legaux | — | — | — |
| fournisseurControle | fournisseurs_controle | — | — | — |

Lecture (`chargerCollection`) : `select *` avec `count: exact` sur la vue ou la table, filtre `societe_id` de la société active ; **refus si tronqué** (plafond « Max rows ») ; échec noté dans `echecsDeLecture()` (dont session expirée PGRST301/401/JWT) au lieu d'un écran vide ; conversion `versLegacy` (snake → camel, `id` exposé = **uuid**, `legacyId`, `createdAt = cree_le`, `societeId = code`, `client = client_nom`). Filles attachées par `listByParents`. Pour les BC, `reconstituerWorkflow` lit `planning_taches` et **dérive** : `metiersFait[m]`, `dateOrigineFait`, `nbTaches`, `tachesNonPointees`, `valideConducteur` (toutes validées), `dateValideConducteur`, `valideDirecteur` (`statut_workflow ∈ {chiffre, facture}`), état pièce (`etatPieceDuBon`), `technicienCommentaire`, `technicienDessin`, `sousTraitant` (nom depuis uuid), `datesSupplementaires`. Recalculé **au chargement seulement**.

Écriture (`stSet`) : `versDb` (camel → snake, `SNAKE_OVERRIDES` numeroBC/sansBC/enAttenteBC, aliases) ; champs sans colonne **écartés par `colonnesDe()`** (sinon PostgREST rejette tout) avec avertissement unique ; `normaliser` : `""` → `null` sauf `client_nom`, `designation`, `nom`, `libelle` ; valeur hors énumération (`valeursEnum`, ex. `interventions.metier` limité à plomberie/electricite/etancheite) → `null` ; `societe_id` résolu depuis le code ; `rattacherClient` pose `client_id`, `client_siret`, `client_siren`, `client_tva_intracom`, `client_pays_code`, `client_code_service`, `client_code_routage`, `cadre_facturation` d'après la fiche de même `nom`. Id uuid → `row.id`, sinon uuid retrouvé par `legacy_id`, sinon `legacy_id = id`. `upsert(row)` puis filles par `remplacerEnfants` (**compare d'abord** via `enfantsIdentiques` — `String(v ?? "")`, `montant_ht` exclu — puis delete + insert). Facture demandée émise sans numéro ⇒ écrite `brouillon`, lignes posées, puis `update statut` (numéro par trigger, relu dans le cache). Pour un BC : `rangerPieceJointe` (upload Storage puis update des 3 colonnes `piece_jointe_*`, suppression de l'ancien fichier après) et `appliquerWorkflow` (traduit les cases de l'écran en RPC/updates sur `planning_taches` : création des tâches par métier/date, `marquerRealisee`, constats terrain, sous-traitant, équipe, date, créneau). Motif de refus exposé par `dernierRefus()` (`details || hint || message`).

Lignes (`ligneVersDb`) : `type` (défaut ligne), `designation` (`""` défaut), `commentaire`, `quantite`, `prix_unitaire`, `tva` (**0 si absent, jamais NULL** — colonnes NOT NULL + piège `columns=`), `unite`, `article_reference`, `metier` (`?? null`, sentinelle `(aucun)` conservée), `position`. `unite_code` et `tva_categorie` **ne sont pas écrits** (dérivés à l'usage).

Réglages (`settings:<code>`) : `CHAMPS_SOCIETE` (liste blanche → colonnes de `societes` : adresse, codePostal, ville, telephone, email, siret, nom, siren, tvaIntracom, raisonSocialeLegale, formeJuridique, codeNaf, capitalSocial (nombre), rcsNumero, rcsVille, paysCode, regimeTva, ereportingRegime, tvaSurEncaissements (bool), autoliquidationBatiment (bool), indemniteRecouvrement (nombre), mentionPenalitesRetard, assuranceDecennaleNom/Police, adresseElectroniqueSchema/Valeur, iban, bic) ; tout le reste part dans `societe_settings.infos_entreprise` (jsonb, dont `reglages` fusionné avec `REGLAGES_DEFAUT`) ; `notifs_traitees` à part.

### 3.4 Pièges documentés (récapitulatif)

`""` → `null` (énumérations, dates, numériques) ; `colonnesDe()` avant envoi ; champ absent ≠ défaut de colonne (union des clés `columns=` → NULL → 23502) ; `toISOString()` interdit ; trois collections lues par vue (ajouter une colonne ⇒ refaire la vue à partir de `pg_get_viewdef`, ajouts en fin seulement) ; `conducteur` texte réécrit par trigger depuis `conducteur_id` ; champs BC dérivés des tâches (recharger après `validerTache`, `marquerRealisee`, `sauvegarderTerrain`) ; `montant_ht` exclu de la comparaison des lignes (facture figée) ; `metier` à 3 états (`NULL` / nom / `(aucun)`, jamais `""`) ; facture numérotée : en-tête gelé (`factures_entete_figee`, liste blanche), lignes figées (`facture_lignes_figees`), suppression interdite (`facture_numero_immuable`), numéro refusé sans ligne (BG-25) ; `factures.statut` a pour défaut `impayée` (ne rien préciser = émettre) ; totaux à lire dans `v_facture_totaux` (351/410 factures ont `total_*` à 0) ; `legacy_id` de facture unique **globalement** (d'où préfixe `compta:`) ; plafond « Max rows » PostgREST ; URL `in(...)` > 16 Ko.

---

## 4. Workflows

### 4.1 `docs/WORKFLOWS.md` (tel quel, très sommaire)

BC : CREATE → ADD_LIGNES → PLAN_TECHNICIENS → VALIDATE → CREATE_FACTURE → TRACK_RECEPTION → CLOSE · Devis → Facture : CREATE → SEND → ACCEPT/REFUSE → CREATE_FACTURE → EMIT → PAY · Intervention : CREATE → ADD_PHOTOS → SIGN → CREATE_FACTURE → PDF · RH : ADD_SALARIE → HABILITATIONS → ABSENCES → DOCUMENTS.

### 4.2 Enchaînements réellement codés

**Devis** : `createDevis` (numéro `DEV-AAAA-NNNNNN` immédiat) → statuts `brouillon | envoyé | accepté | refusé` → `accepterDevisEtCreerFacture` = `updateDevisStatut("accepté")` + `createFactureFromDevis` (recopie client, interlocuteur, conducteur(_id), remise, devis_id, intervention_id, chantier_id, adresse et logement ; lignes sans id/cree_le/devis_id ; `date = todayISO()`).

**Facture** (`createFacture`) : identité émetteur figée (`identiteManquante(input, identiteEmetteur(societe))`) ; si statut voulu ≠ brouillon et pas de numéro : insert `brouillon` → lignes → update statut (le trigger numérote `FAC-AAAA-NNNNNN`). `emettreFacture(id)` : refuse si déjà numérotée, complète l'identité émetteur, `statut = "impayée"`. Statut de règlement déduit (§1.3), écrit via `statutEnBase`.

**Avoir** : `createAvoir(societe, factureId, motif)` → `refusAvoir` → `createFacture` avec `type_document: "avoir"`, `facture_rectifiee_id`, `motif_rectification`, copie de l'en-tête (sans devis/BC/intervention), identité émetteur **de la facture d'origine**, mêmes lignes (montants positifs) ; numéroté dans la série « AV » (commentaire session.ts). Imputation : `imputerAvoir` → lit `v_facture_totaux` + règlements des deux pièces → `refusImputationAvoir` → **deux règlements** : sur la facture (`mode "avoir"`, `reference` = n° avoir) et sur l'avoir (`mode "imputation"`, `reference` = n° facture), même montant, même date.

**Règlements** : `addReglement` (table `reglements` : date, mode texte libre, montant > 0 (CHECK), reference, facture_id). `ajouterReglementEtMajStatut` (operations) : insert puis `calculerSoldeFacture` (**recalcul client** : Σ ligne `type="ligne"` q×pu×(1+tva/100), moins remise % sur TTC, moins encaissé, `toFixed(2)`) → `payée` si ≤ 0. Virement groupé : `imputer()` (§1.3), un règlement par facture.

**Bon de commande → facture (circuit)** :
1. Réception : `createBonCommande` (numéro = celui du client, ou « Sans BC » / « En attente de BC » ; `numero_interne` attribué par la base), éventuellement préremplie par OCR ; `manquesBonCommande` bloque sans adresse d'intervention ni ligne de travaux.
2. Planification : `schedule_par_metier` (jsonb par métier : technicien, sous_traitant, dates, heure, durée) + `planning_taches` (une tâche par métier et par journée ; `tacheDuBonCommande` la matérialise ; `technicien_id` = équipe).
3. Terrain : `sauvegarderTerrain` (RPC, constats/croquis/pièce à commander) ; `marquerRealisee` (RPC, `planifiee|refusee → realisee`, seulement l'équipe) ; pièce à commander → `pieceRecue` (RPC `bc_piece_recue`, refusée si une tâche est validée) ; travaux supplémentaires (`a_chiffrer`).
4. Conducteur : `validerTache(ok, motif)` (RPC `tache_valider`) ; `validerAffaireConducteur` (contrôle `blocagesValidationConducteur` puis valide toutes les `realisee`).
5. Chiffrage : `validerChiffrage` = contrôles `blocagesChiffrage` → si `en_cours` : `bc_passer_pret_a_chiffrer` → `bc_chiffrage_valide` (`chiffre`). Variante admin `validerChiffrageHorsCircuit` (RPC dédiée). Travaux sup. chiffrés (`prix_vente_ht`, quantité, unité, tva) puis `integre`.
6. Pré-facture / facture : `validerPrefacture` = `validerChiffrage` + **RPC `bc_generer_facture`** (crée la facture brouillon en base, recopie lignes avec `montant_ht`, `adresse` → `adresse_locataire` « Lieu d'intervention », `ref_bon_commande_client` = `ref_bc_client(numero_bc)`, émetteur, échéance `date_echeance`) → reprise par la secrétaire → émission. Alternative client : `createFactureFromBC` / `facturerBonCommande` (operations).
7. Sortie sans facture : `cloturerGratuit` (RPC `bc_cloturer_gratuit`, motif) → `cloture_gratuit`.
8. SAV : `createSAV` (nouveau BC `SAV-AAAA-NNNNNN`, `bon_commande_parent_id`).
Verrous : BC figé dès qu'une facture liée est numérotée (`verrouBonCommande`).

**Intervention** : `createIntervention` (numéro `INT-…` via série `intervention`) → rapport (`updateInterventionRapport`), photos (Storage), contrôles (`intervention_controles` cle/coche/precision_autre), signature (`signature_chemin`) → `completerRapportEtCreerFacture` (exige ≥ 1 ligne).

**Facture électronique** (`operations/efacture.ts`) : `preparerEmission(factureId)` = facture + lignes facturables (hors chapitre/commentaire/titre ; `montant_ht` recalculé q×pu si NULL) + `societes` + `clients` + facture rectifiée → émetteur (colonnes `emetteur_*` sinon société), destinataire (colonnes figées `client_*`/facturation sinon fiche ; `cadre_facturation` : **fiche d'abord**) → totaux **depuis `v_facture_totaux`** → `montantRegle = TTC − calculerSoldeFacture` → `chargeEN16931` + `manquesPourEmettre`. `transmettreFacture` → `versCII(charge)` → Edge `pdp-emit-invoice`. PDF Factur-X : `integrations/facturx.ts` (`pdf-lib`, pièce jointe `factur-x.xml` relation `Data`, profil « EN 16931 », profil sRGB PDF/A) branché par `facturx-pont.ts` au téléchargement. `etatPlateforme` lit `pdp_connexions` (`etat = "connecte"`).

**Autres opérations** : `planifierBCMultiMetier`, `cloturerChantier` (`date_fin`), `calculerNotifications` (échéances ≤ 30 j : carte carburant, télépéage, documents légaux, carte BTP, visite médicale, habilitations — seuils réels de l'écran dans `alertes.SEUILS` : vehiculeCarte 30, vehiculeControle 30, documentLegal 30, carteBtp 60, visiteMedicale 45, habilitation 60, conducteurSansRdv 7), `sauvegarderSociete` / `exportAllData` (JSON `version: 2`).

---

## 5. OCR et imports

### 5.1 OCR de bon de commande (`integrations/ocr.ts`, `regles-ocr.ts`)

- Edge Function **`extraire-bc`** : OCR Mistral puis structuration JSON stricte (clé API dans les secrets Supabase ; budget serveur 110 s). Corps envoyé : `{ fichierBase64, mimeType }` ; réponse `{ extraction: ExtractionBC }`. Contrat miroir de `supabase/functions/_shared/contrat-bc.ts`.
- Préparation (`preparer`) : formats `application/pdf`, `image/jpeg`, `image/png`, `image/webp` ; image hors format (HEIC…) ou > 3 Mo → recompression JPEG qualité 0,85, côté max 2200 px ; PDF > 14 Mo refusé. Base64 par `FileReader.readAsDataURL`.
- `ExtractionBC` : `client, numeroBC, dateBC, referenceChantier, natureTravaux, dateFinTravaux, interlocuteur, adresse, codePostal, ville` (= lieu d'intervention), `facturationAdresse/CodePostal/Ville, numeroLogement, logementStatut, occupant, etage, notes, montantTotalHT, lignes[{type ligne|chapitre|commentaire, designation, qte, unite, prixUnitaire, tva}], avertissements[]`. Les avertissements sont complétés par `essentielsDeLecture` (numéro BC, adresse chantier, ≥ 1 ligne de travaux).
- `versSaisieBonCommande` : mappe vers le formulaire (`sansBC = !numeroBC`, `dateReception = dateBC ?? todayISO()`, `logementStatut` ∈ {occupé, vacant, commune} sinon ignoré, `montant = montantTotalHT`, lignes `id = ocr-<ts>-<i>`). **Rien n'est enregistré automatiquement.**
- `rapprocherClient(nomLu, clients)` : normalisation (NFD sans accents, majuscules, retrait SA/SAS/SASU/SARL/EURL/SCI/OPH/HLM/SA HLM/OFFICE PUBLIC DE L HABITAT), exact → inclusion unique → score de mots-clés (mots > 2 lettres hors DE/DU/DES/LA/LE/LES/ET/L/D) ≥ 0,8 et unique ; sinon 8 suggestions.
- Progression (`regles-ocr`) : étapes preparation/encodage (« Préparation du document »), envoi, analyse (« Lecture par le modèle ») ; bascule envoi→analyse à 2 s ; alerte « plus long que d'habitude » à 45 s ; délai client 120 s (`TimeoutError`) ; évènements serveur `saturation`/`bascule` de modèle ; erreurs nommées `AbortError` / `TimeoutError`.

### 5.2 Import d'articles (`regles-import-articles.ts`, `integrations/catalogue.ts`, `queries/articles.ts`)

- Fichier d'un logiciel de gestion, **découpé sur `;` uniquement** (guillemets non échappés `Tube 1/2"`), encodage constaté (`decoderTexte`), CRLF/LF, BOM retiré de l'en-tête. Colonnes lues **par nom** ; requises `CodeArticle`, `Libelle1` ; chaque ligne doit avoir autant de champs que l'en-tête.
- `COLONNES_ATTENDUES` : Actif, TypeArt, CodeArticle, PVHT, Libelle1, PVTTC, BlocNote, Mesure, Date de création, Date de modification, FamilleArt1, PANet, FamilleTVA, FamilleComptableArt, GereEnStock, FamilleArt2, FamilleArt3, FamilleTarifs.
- **Codes TVA (`FamilleTVA`) → taux** : `INTER` → **10**, `NORMA` → **20**, `EXO` → **0**, `"0"` → 0 (casse ignorée) ; inconnu → 20 + signalement ; colonne absente → 20 partout. (La catégorie EN 16931 n'est pas posée : elle se déduit à l'usage, `S` si > 0 sinon `Z`.)
- **Unités (`Mesure`)** : UNI→u, M→m, M2→m², M3→m³, HR→h, PC→pièce, MM→mm, JOUR→jour ; inconnue (ex. `ML`) → vide + signalement. Codes UNECE ensuite : u→C62, m→MTR, m²→MTK, m³→MTQ, h→HUR, pièce→C62, mm→MMT, jour→DAY.
- Mapping : `code`, `designation` (Libelle1, sinon 80 premiers caractères de BlocNote), `description` (BlocNote), `prix_unitaire` (PVHT, virgule décimale, défaut 0), `prix_achat` (PANet), `unite`, `type_article` (`BIEN` → bien, sinon service), `tva`, `actif` (`"1"`, colonne absente ⇒ true), `gere_en_stock` (`"1"`), `famille` (FamilleArt1). Doublon de code dans le fichier : premier gardé. Écriture : upsert `(societe_id, code)` par lots de 200 ; créés / mis à jour comptés d'après `codesExistants`.
- Vecteur calculé : `A1;Tube 1/2";12,50;INTER;ML;BIEN;1` → `{A1, 'Tube 1/2"', 12.5, tva 10, unite null, bien, actif}` ; `NORMA`/`M2` → 20/m² ; `EXO`/`PC` → 0/pièce ; `TVA55` → 20 + signalement ; code répété → rejet ; 8 champs pour 7 → rejet « les colonnes seraient décalées ».

### 5.3 Import de clients (`regles-import-clients.ts`, `integrations/clients-import.ts`)

- Export CSV conforme RFC 4180 (`lireCsv`, `;`), encodage constaté, colonnes par nom (38 colonnes type Vertuoza : « Nom de l'entreprise » requise, Email, Téléphone, Numéro de tva, Rue/Numéro/Code postal/Localité/Pays, adresse de facturation, Siren, SIREN (9), SIRET établissement (14), Conditions de paiement…). Colonnes versées en notes : Email (bis), Description, Commentaire, Métier, Conditions particulières, Identifiant comptable, Site web, Source, Commercial, Vertuoza ID, Confiance / source. **Écartées** : BIC, IBAN (pas de colonne), TVA (ambiguë), Profil, Franco, Montant franco, IDE, Language, Pays facturation.
- Pays : FRANCE→FR, BELGIQUE/BELGIUM→BE, SUISSE→CH, LUXEMBOURG→LU, ALLEMAGNE→DE, ESPAGNE→ES, ITALIE→IT, défaut FR. Mots d'alerte dans le commentaire : ALERTE, DOUBLON, NE PAS CONFONDRE, PERSONNE PHYSIQUE.
- `delaiDesConditions` : « réception/comptant/immédiat » → 0 net ; sinon premier nombre (1-3 chiffres) ; « fin de mois »/« fdm » → fin_de_mois. Ex. « 30 jours fin de mois » → {30, fdm} ; « 45j » → {45, net}.
- Rapprochement (`rapprocher`) : SIRET (chiffres nus) unique → mise à jour ; sinon nom normalisé (`cleNom` : sans accents, minuscules, espaces réduits) ; plusieurs → ambigu ; sinon création. `sansImmatriculation` signalé. Écriture : créations par lots de 200 (clés uniformisées), mises à jour une par une.

### 5.4 Import de facturation historique (`regles-import-factures.ts`, `integrations/factures-import.ts`, `queries/factures-import.ts`)

- Deux fichiers : **en-têtes** (requis) + **lignes** (facultatif ; sans lui, une ligne unique « Facturation (historique) » porte le total). Séparateur constaté (`;` ou `,`), nombre avec `.` ou `,` (les deux ⇒ illisible), dates **ISO seulement**. Nature du fichier devinée par colonnes exclusives (`natureDuFichier`).
- Alias : numero_facture|numero ; type|type_document ; date_facture|date ; date_echeance|echeance ; code_client|client_code_externe ; client|client_nom ; montant_ht|total_ht ; montant_tva|total_tva ; taux_tva ; montant_ttc|total_ttc ; fichier_pdf|pdf_origine. Lignes : numero_facture|numero, num_ligne|ordre|position, designation|libelle, compte_produit|compte_comptable|compte, montant_ht, taux_tva. Colonnes non reprises : statut (« importee »), source, fichier_pdf/pdf_origine.
- Contrôles (tolérance **0,011**), un écart ⇒ pièce rejetée et fichier marqué `incoherent` (l'écriture est interdite dès qu'une pièce est écartée) : signe du HT cohérent avec le type ; |HT×taux/100 − TVA| ; |HT+TVA − TTC| ; somme des lignes = HT ; numéro unique ; type absent ⇒ déduit du signe (signalé).
- **Taux 0 %** : refusé sans `options.categorieTauxZero` ∈ `E` (Exonérée), `AE` (Autoliquidation), `Z` (Taux zéro), `O` (Hors champ) ; sinon catégorie `S`. Énumération base `tva_categorie` : S, Z, E, AE, K, G, O.
- Désignation par racine de compte : 706 Prestations de services, 707 Ventes de marchandises, 708 Produits des activités annexes, 701 Ventes de produits finis, 704 Travaux, 705 Études (+ « (historique) »).
- Montants stockés **en valeur absolue** (le signe vient du type). `legacy_id = "compta:" + numero` (unicité globale). Statut par défaut à l'import : `payée`. Client : `rapprocherClient` exact → préfixe à frontière de mot → ambigu/aucun (fiche à créer). Mapping ligne : `quantite 1`, `prix_unitaire = montant_ht = HT ligne`, `tva`, `tva_categorie`, `article_reference = compte comptable`. En-tête : `client_id`, `client_nom` du **fichier**, `date`, `echeance` (écartée si antérieure), `type_document`, `cadre_facturation` (fiche, défaut B2B_national), `devise EUR`, `total_*`, `net_a_payer = TTC`.
- Écriture pièce par pièce en 3 temps : INSERT facture brouillon sans numéro → INSERT lignes → UPDATE `numero + statut` en un ordre (le trigger ne consomme pas le compteur quand le numéro est fourni). Échec aux étapes 2/3 ⇒ brouillon orphelin supprimable (`supprimerBrouillonsImport`).
- Vecteur calculé (en-têtes seuls) : `FAC1 facture 100/20/20/120` ✓ ; `AV1 avoir -50/20/-10/-60` → stocké 50/10/60 ; `FAC2 100/20/19/119` → rejet « TVA incohérente : 19 annoncé, 20.00 attendu » ; `FAC3 taux 0` → rejet sans catégorie, `AE` avec option ; `FAC4 type vide -10/10/-1/-11` → avoir déduit. Totaux signés : ht 40, tva 9, ttc 49 ; `incoherent: true`.
