/**
 * Règles de chiffrage d'un bon de commande.
 *
 * Ce qui interdit de valider une pré-facture est décidé ici, une fois, et non
 * dans chaque écran : la couche `queries` s'en sert pour refuser, l'interface
 * pour expliquer. Sans ce partage, le message affiché et le refus réel finissent
 * par diverger — c'est ce qui s'est produit sur l'écran directeur, où le refus
 * de la base était avalé pendant que l'interface annonçait un succès.
 *
 * Module feuille : il n'importe que des types. C'est ce qui lui permet d'être
 * appelé aussi bien depuis `queries` que depuis `integrations`, sans inverser le
 * sens des dépendances.
 *
 * Ces règles restent un **miroir** de ce que la base autorise. L'autorité est la
 * RLS et les fonctions SQL ; ici on ne fait qu'éviter à l'utilisateur un aller-
 * retour dont on connaît déjà l'issue.
 */

const STATUT_TACHE_VALIDEE = "validee";
const STATUT_TACHE_REALISEE = "realisee";
const STATUT_TACHE_DEFAUT = "planifiee";
const STATUT_TRAVAIL_A_CHIFFRER = "a_chiffrer";
const STATUT_BC_FACTURE = "facture";
const TYPE_LIGNE_DEFAUT = "ligne";

/** Nombre de désignations citées avant de résumer le reste. */
const DETAILS_CITES = 5;

/** Ce que la règle a besoin de savoir d'une tâche, quelle qu'en soit la source. */
export interface TacheArbitrable {
  statut?: string | null;
  libelle?: string | null;
  metier?: string | null;
}

export interface TravailChiffrable {
  statut?: string | null;
  libelle?: string | null;
}

/**
 * Une ligne de document, dans la forme historique de l'application.
 * Les lignes venues de la base sont converties par l'appelant : c'est une
 * projection d'un champ, pas une règle métier.
 */
export interface LigneChiffrable {
  type?: string | null;
  designation?: string | null;
  prixUnitaire?: number | null;
}

export type CodeBlocage =
  | "deja_facture"
  | "aucune_tache"
  | "metiers_sans_tache"
  | "taches_non_pointees"
  | "taches_non_validees"
  | "travaux_non_chiffres"
  | "lignes_sans_prix";

export interface Blocage {
  code: CodeBlocage;
  libelle: string;
  /** Ce qui bloque, nommé : un compte seul n'aide personne à corriger. */
  details: string[];
}

export interface DossierChiffrage {
  statutWorkflow?: string | null;
  taches: TacheArbitrable[];
  travaux: TravailChiffrable[];
  lignes: LigneChiffrable[];
}

/** Une tâche sans statut n'a pas encore été touchée : elle est planifiée. */
export function tachesNonValidees(taches: TacheArbitrable[]): TacheArbitrable[] {
  return (taches ?? []).filter(
    (t) => (t.statut ?? STATUT_TACHE_DEFAUT) !== STATUT_TACHE_VALIDEE
  );
}

/**
 * Tâches que le terrain n'a pas encore déclarées faites.
 *
 * Une affaire porte souvent plusieurs métiers confiés à des équipes
 * différentes : le sol un jour, la peinture un autre. Tant qu'un métier n'est
 * pas pointé, il n'y a rien à arbitrer dessus — et clore l'affaire reviendrait
 * à valider un travail que personne n'a déclaré terminé.
 *
 * Une tâche `refusee` compte aussi : elle attend une reprise.
 */
export function tachesNonPointees(taches: TacheArbitrable[]): TacheArbitrable[] {
  return (taches ?? []).filter((t) => {
    const statut = t.statut ?? STATUT_TACHE_DEFAUT;
    return statut !== STATUT_TACHE_REALISEE && statut !== STATUT_TACHE_VALIDEE;
  });
}

export function travauxNonChiffres(
  travaux: TravailChiffrable[]
): TravailChiffrable[] {
  return (travaux ?? []).filter((t) => t.statut === STATUT_TRAVAIL_A_CHIFFRER);
}

/**
 * Chapitres et commentaires sont écartés : ils structurent le document et n'ont
 * pas de prix par nature. Une ligne à 0 € est retenue — c'est précisément le cas
 * qu'on veut faire remonter au directeur, la gratuité assumée passant par la
 * clôture en gratuité.
 */
export function lignesSansPrix(lignes: LigneChiffrable[]): LigneChiffrable[] {
  return (lignes ?? []).filter((l) => {
    if ((l.type ?? TYPE_LIGNE_DEFAUT) !== TYPE_LIGNE_DEFAUT) return false;
    return !(Number(l.prixUnitaire) > 0);
  });
}

/** Ce qui identifie une tâche à l'écran, à défaut de libellé. */
function nommerTache(t: TacheArbitrable): string {
  return t.libelle || t.metier || "tâche sans libellé";
}

function nommerTravail(t: TravailChiffrable): string {
  return t.libelle || "travail sans libellé";
}

function nommerLigne(l: LigneChiffrable): string {
  return l.designation || "ligne sans désignation";
}

/**
 * Ce qui empêche le conducteur de clore l'affaire.
 *
 * La règle est celle du métier : on ne valide pas une affaire tant que **toutes**
 * ses tâches ne sont pas passées. Le conducteur peut arbitrer le sol dès qu'il
 * est pointé, mais l'affaire ne part au directeur que lorsqu'il ne reste rien.
 */
export function blocagesValidationConducteur(
  taches: TacheArbitrable[],
  metiersDuBon: string[] = []
): Blocage[] {
  const liste = taches ?? [];

  if (!liste.length) {
    return [
      {
        code: "aucune_tache",
        libelle:
          "Aucune tâche n'a été planifiée : il n'y a rien à valider sur cette affaire.",
        details: [],
      },
    ];
  }

  const blocages: Blocage[] = [];

  /* Un métier annoncé sur le bon mais jamais planifié n'apparaît dans aucune
     tâche : sans ce contrôle, une affaire PEINTURE+SOL dont seule la peinture a
     été planifiée serait validée en entier. */
  const metiersPlanifies = new Set(
    liste.map((t) => t.metier).filter((m): m is string => !!m)
  );
  const sansTache = (metiersDuBon ?? []).filter(
    (m) => m && !metiersPlanifies.has(m)
  );
  if (sansTache.length) {
    blocages.push({
      code: "metiers_sans_tache",
      libelle: `${sansTache.length} métier(s) du bon n'ont encore aucune tâche planifiée.`,
      details: sansTache,
    });
  }

  const enAttente = tachesNonPointees(liste);
  if (enAttente.length) {
    blocages.push({
      code: "taches_non_pointees",
      libelle: `${enAttente.length} tâche(s) n'ont pas encore été pointées par le terrain.`,
      details: enAttente.map(nommerTache),
    });
  }

  return blocages;
}

export function peutValiderConducteur(
  taches: TacheArbitrable[],
  metiersDuBon: string[] = []
): boolean {
  return blocagesValidationConducteur(taches, metiersDuBon).length === 0;
}

/**
 * Tout ce qui empêche de valider, dans l'ordre où l'utilisateur doit le traiter :
 * inutile de lui signaler un prix manquant si le bon est déjà facturé.
 */
export function blocagesChiffrage(dossier: DossierChiffrage): Blocage[] {
  const blocages: Blocage[] = [];

  if (dossier.statutWorkflow === STATUT_BC_FACTURE) {
    blocages.push({
      code: "deja_facture",
      libelle: "Ce bon de commande a déjà été facturé.",
      details: [],
    });
    /* Les autres contrôles n'ont plus d'objet : le document est figé. */
    return blocages;
  }

  const taches = dossier.taches ?? [];
  if (!taches.length) {
    blocages.push({
      code: "aucune_tache",
      libelle:
        "Aucune tâche n'a été planifiée : rien n'atteste que les travaux ont été réalisés.",
      details: [],
    });
  } else {
    const enAttente = tachesNonValidees(taches);
    if (enAttente.length) {
      blocages.push({
        code: "taches_non_validees",
        libelle: `${enAttente.length} tâche(s) ne sont pas encore validées par le conducteur.`,
        details: enAttente.map(nommerTache),
      });
    }
  }

  const aChiffrer = travauxNonChiffres(dossier.travaux ?? []);
  if (aChiffrer.length) {
    blocages.push({
      code: "travaux_non_chiffres",
      libelle: `${aChiffrer.length} travail(aux) supplémentaire(s) restent à chiffrer.`,
      details: aChiffrer.map(nommerTravail),
    });
  }

  const sansPrix = lignesSansPrix(dossier.lignes ?? []);
  if (sansPrix.length) {
    blocages.push({
      code: "lignes_sans_prix",
      libelle: `${sansPrix.length} ligne(s) n'ont pas de prix.`,
      details: sansPrix.map(nommerLigne),
    });
  }

  return blocages;
}

/** Les premières désignations, puis le reste résumé — une liste de 40 lignes ne se lit pas. */
function resumerDetails(details: string[]): string {
  if (!details.length) return "";
  const cites = details.slice(0, DETAILS_CITES).join(", ");
  const reste = details.length - DETAILS_CITES;
  return reste > 0 ? ` (${cites}, et ${reste} autre(s))` : ` (${cites})`;
}

export function messageBlocages(blocages: Blocage[]): string {
  return (blocages ?? [])
    .map((b) => b.libelle + resumerDetails(b.details))
    .join("\n");
}

// ============ LA FILE DE VALIDATION ============

/**
 * Ce que l'écran connaît d'un bon sans relire ses tâches.
 *
 * `reconstituerWorkflow` pose ces champs sur le bon à chaque chargement : le
 * nombre de tâches, celles qui ne sont pas encore pointées, et si toutes sont
 * validées. Cela suffit à situer le bon dans la file.
 */
export interface BonEnFile {
  valideConducteur?: boolean;
  valideDirecteur?: boolean;
  nbTaches?: number;
  /** Tâches ni réalisées ni validées, désignées par leur métier ou leur date. */
  tachesNonPointees?: string[];
}

export type EtapeValidation = "pret" | "travaux_en_cours" | "hors_file";

/**
 * Où se situe un bon dans la file de validation.
 *
 * L'onglet ne montrait que les bons entièrement validés — 122 sur 496 en
 * production. Le directeur ne voyait donc rien venir : ni les 88 bons dont les
 * travaux ont commencé sans être terminés, ni la raison de leur attente. Un bon
 * dont toutes les tâches sont *réalisées* mais qu'aucune n'a été arbitrée est
 * précisément ce qu'il faut voir — c'est lui qui attend une décision.
 *
 * Restent dehors les bons déjà chiffrés, qui ont dépassé cette étape, et ceux
 * dont personne n'a encore touché une tâche : ils n'appellent aucune décision,
 * ils appellent une intervention.
 */
export function etapeValidation(bon: BonEnFile): EtapeValidation {
  if (bon.valideDirecteur) return "hors_file";

  const total = bon.nbTaches ?? 0;
  if (total === 0) return "hors_file";
  if (bon.valideConducteur) return "pret";

  const nonPointees = (bon.tachesNonPointees ?? []).length;
  // Au moins une tâche déclarée faite : les travaux ont commencé.
  return total > nonPointees ? "travaux_en_cours" : "hors_file";
}

/**
 * Pourquoi ce bon n'est pas encore chiffrable, en clair.
 *
 * `null` quand il l'est. La formulation dit ce qui manque, pas ce qui va mal :
 * un chantier en cours n'est pas une anomalie.
 */
export function attenteAvantChiffrage(bon: BonEnFile): string | null {
  if (etapeValidation(bon) !== "travaux_en_cours") return null;

  const restantes = (bon.tachesNonPointees ?? []).length;
  if (restantes > 0) {
    const quoi = (bon.tachesNonPointees ?? []).slice(0, 2).join(", ");
    return restantes === 1
      ? `Travaux non terminés — reste ${quoi}`
      : `Travaux non terminés — reste ${restantes} tâches (${quoi}…)`;
  }
  // Tout est déclaré fait, rien n'est arbitré : c'est le conducteur qu'on attend.
  return "Travaux déclarés faits — en attente d'arbitrage du conducteur";
}

// ============ CE QU'UN BON DE COMMANDE DOIT PORTER ============

export type CodeManque = "adresse_intervention" | "ligne_travaux" | "numero_bc";

export interface Manque {
  code: CodeManque;
  libelle: string;
}

/** Ce que la règle a besoin de savoir du bon saisi. */
export interface SaisieBonCommande {
  /** L'adresse d'intervention : le chantier, jamais le siège du client. */
  adresse?: string | null;
  lignes?: LigneChiffrable[] | null;
}

/**
 * Une ligne de travaux est une ligne qui **dit ce qu'il y a à faire**.
 *
 * Le prix n'entre pas dans le compte : un bon arrive souvent avant tout
 * chiffrage, et l'exiger reviendrait à interdire de l'enregistrer au moment où
 * on le reçoit. Un chapitre ou un commentaire ne compte pas davantage : ils
 * structurent le document, ils ne décrivent aucun travail.
 */
export function lignesDeTravaux(lignes: LigneChiffrable[] | null | undefined) {
  return (lignes ?? []).filter(
    (l) =>
      (l.type ?? TYPE_LIGNE_DEFAUT) === TYPE_LIGNE_DEFAUT &&
      (l.designation ?? "").trim() !== ""
  );
}

/**
 * Ce qui manque à un bon de commande pour être enregistrable.
 *
 * Deux exigences, et elles ne sont pas de confort :
 *
 * L'**adresse d'intervention** est le lieu des travaux, pas le siège du client.
 * C'est elle que `bc_generer_facture` recopie dans `factures.adresse_locataire`,
 * et c'est elle seule qui remplit le bloc « Lieu d'intervention » du document
 * imprimé. Un bon sans adresse produit donc une facture qui ne dit pas où le
 * travail a eu lieu — sur 394 factures de production, 4 en portaient une.
 *
 * Au moins une **ligne de travaux**, parce que sans elle la facture s'invente
 * la sienne : faute de lignes, `bc_generer_facture` insère « Travaux — BC n°… »
 * au montant global. Le client reçoit une facture qui ne décrit rien, et
 * personne ne peut plus rapprocher ce qui a été fait de ce qui a été payé.
 *
 * Les messages disent quoi faire, pas ce qui est faux : ils s'affichent à
 * quelqu'un qui est en train de saisir.
 */
export function manquesBonCommande(bon: SaisieBonCommande): Manque[] {
  const manques: Manque[] = [];

  if ((bon.adresse ?? "").trim() === "") {
    manques.push({
      code: "adresse_intervention",
      libelle:
        "L'adresse d'intervention est obligatoire : c'est le lieu des travaux, " +
        "pas l'adresse du client. Elle est reportée sur la facture sous « Lieu " +
        "d'intervention ».",
    });
  }

  if (!lignesDeTravaux(bon.lignes).length) {
    manques.push({
      code: "ligne_travaux",
      libelle:
        "Au moins une ligne de travaux est obligatoire : décrivez en gros ce " +
        "qu'il y a à faire. Le prix peut attendre le chiffrage, la description " +
        "non — sans elle, la facture ne dira pas ce qui a été fait.",
    });
  }

  return manques;
}

/**
 * Ce qu'une lecture automatique doit avoir ramené pour être exploitable.
 *
 * Trois choses, et elles se voient toutes en aval :
 *
 * - le **numéro du bon**, la référence sous laquelle le client connaît
 *   l'affaire — sans elle, personne ne rapproche la facture de la commande ;
 * - l'**adresse du chantier**, qui devient le « Lieu d'intervention » du
 *   document (`bons_commande.adresse` → `factures.adresse_locataire`) ;
 * - au moins une **ligne de travaux**, faute de quoi la facture s'invente la
 *   sienne au montant global.
 *
 * Cette vérification est faite ici, après coup, et non laissée au modèle :
 * `avertissements` est rempli à sa discrétion, et il se tait précisément quand
 * il n'a rien vu. L'écran, lui, doit dire ce qui manque même — surtout — quand
 * la lecture s'est crue complète.
 *
 * Le numéro ne bloque pas l'enregistrement, à la différence des deux autres
 * (`manquesBonCommande`) : « Sans BC » et « En attente de BC » sont des cas
 * réels du métier. Il se signale, il ne se refuse pas.
 */
export function essentielsDeLecture(lu: {
  numeroBC?: string | null;
  adresse?: string | null;
  lignes?: LigneChiffrable[] | null;
}): Manque[] {
  const manques: Manque[] = [];

  if ((lu.numeroBC ?? "").trim() === "") {
    manques.push({
      code: "numero_bc",
      libelle:
        "numéro de bon non lu — vérifiez-le sur le document, ou cochez " +
        "« Sans BC » / « En attente de BC »",
    });
  }

  if ((lu.adresse ?? "").trim() === "") {
    manques.push({
      code: "adresse_intervention",
      libelle:
        "adresse du chantier non lue — c'est elle qui devient le « Lieu " +
        "d'intervention » de la facture",
    });
  }

  if (!lignesDeTravaux(lu.lignes).length) {
    manques.push({
      code: "ligne_travaux",
      libelle: "aucune ligne de travaux lue — décrivez en gros ce qu'il y a à faire",
    });
  }

  return manques;
}
