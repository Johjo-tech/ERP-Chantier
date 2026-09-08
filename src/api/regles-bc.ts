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
