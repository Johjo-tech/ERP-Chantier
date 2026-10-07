import { PHOTOS_MAX, STATUT_DEFAUT, type CategoriePhoto, type LogementStatut, type MetierRapport, type SaisieRapport } from "./rapport";

/** L'assistant en quatre étapes, tel que l'écran le tient avant l'enregistrement. */
export interface PhotoEdition {
  cle: string;
  /** En base, ou `null` pour une photo prise depuis l'ouverture. */
  id: string | null;
  apercu: string;
  /** Contenu nouveau (photo prise, dupliquée ou annotée), à déposer. */
  dataUrl: string | null;
  categorie: CategoriePhoto | null;
}

/** Ce qu'un bon apporte au rapport qu'on rédige pour lui : le client et le lieu. */
export interface BonSource {
  id: string;
  client_id: string | null;
  client_nom: string;
  interlocuteur: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  logement_statut: LogementStatut | null;
  occupant: string | null;
  etage: string | null;
  numero_logement: string | null;
  conducteur_id: string | null;
}

export interface RapportSource {
  client_id: string | null;
  client_nom: string;
  interlocuteur: string | null;
  bon_commande_id: string | null;
  logement_statut: LogementStatut | null;
  occupant: string | null;
  etage: string | null;
  numero_logement: string | null;
  precision_commune: string | null;
  ancien_locataire: string | null;
  adresse_locataire: string | null;
  code_postal: string | null;
  ville: string | null;
  date: string;
  heure: string | null;
  metier: MetierRapport | null;
  conducteur_id: string | null;
  constatations: string | null;
  preconisations: string | null;
  statut: string | null;
}

const t = (v: string | null | undefined) => v ?? "";

export function saisieInitiale(aujourdhui: string, heure: string, r: RapportSource | null, controles: Record<string, boolean> = {}, precisionAutre = ""): SaisieRapport {
  return {
    client_id: r?.client_id ?? null,
    client_nom: t(r?.client_nom),
    interlocuteur: t(r?.interlocuteur),
    bon_commande_id: r?.bon_commande_id ?? null,
    logement_statut: r?.logement_statut ?? null,
    occupant: t(r?.occupant),
    etage: t(r?.etage),
    numero_logement: t(r?.numero_logement),
    precision_commune: t(r?.precision_commune),
    ancien_locataire: t(r?.ancien_locataire),
    adresse_locataire: t(r?.adresse_locataire),
    code_postal: t(r?.code_postal),
    ville: t(r?.ville),
    date: r?.date ?? aujourdhui,
    heure: r?.heure ?? heure,
    metier: r?.metier ?? null,
    conducteur_id: r?.conducteur_id ?? null,
    constatations: t(r?.constatations),
    preconisations: t(r?.preconisations),
    controles,
    precision_autre: precisionAutre,
    statut: r?.statut ?? STATUT_DEFAUT,
  };
}

/**
 * Lier un bon, c'est reprendre ce qu'il sait — client, lieu, logement,
 * conducteur — sans écraser ce qui a déjà été saisi : le rapporteur a pu
 * préciser le lieu mieux que le bon.
 */
export function avecLeBon(s: SaisieRapport, b: BonSource | null): SaisieRapport {
  if (!b) return { ...s, bon_commande_id: null };
  const garde = (actuel: string, du: string | null) => actuel || (du ?? "");
  return {
    ...s,
    bon_commande_id: b.id,
    client_id: s.client_id ?? b.client_id,
    client_nom: garde(s.client_nom, b.client_nom),
    interlocuteur: garde(s.interlocuteur, b.interlocuteur),
    adresse_locataire: garde(s.adresse_locataire, b.adresse),
    code_postal: garde(s.code_postal, b.code_postal),
    ville: garde(s.ville, b.ville),
    logement_statut: s.logement_statut ?? b.logement_statut,
    occupant: garde(s.occupant, b.occupant),
    etage: garde(s.etage, b.etage),
    numero_logement: garde(s.numero_logement, b.numero_logement),
    conducteur_id: s.conducteur_id ?? b.conducteur_id,
  };
}

/** Combien de photos on peut encore ajouter, et ce qu'on refuse (« maximum 3 »). */
export function placesPhotos(photos: readonly PhotoEdition[], demandees: number): { acceptees: number; message: string | null } {
  const restantes = Math.max(0, PHOTOS_MAX - photos.length);
  if (!restantes) return { acceptees: 0, message: `Maximum ${PHOTOS_MAX} photos par intervention.` };
  if (demandees > restantes) return { acceptees: restantes, message: `Seules ${restantes} photo(s) ont été ajoutées (maximum ${PHOTOS_MAX} au total).` };
  return { acceptees: demandees, message: null };
}

/** Recliquer sur la même catégorie la retire (`setPhotoCategorie`). */
export function basculerCategorie(p: PhotoEdition, categorie: CategoriePhoto): PhotoEdition {
  return { ...p, categorie: p.categorie === categorie ? null : categorie };
}

/** Dupliquer une photo juste après elle : c'est une nouvelle photo, à déposer. */
export function dupliquer(photos: readonly PhotoEdition[], cle: string, nouvelleCle: string): PhotoEdition[] {
  const i = photos.findIndex((p) => p.cle === cle);
  const source = photos[i];
  if (!source || photos.length >= PHOTOS_MAX) return [...photos];
  const copie: PhotoEdition = { ...source, cle: nouvelleCle, id: null, dataUrl: source.dataUrl ?? source.apercu };
  return [...photos.slice(0, i + 1), copie, ...photos.slice(i + 1)];
}
