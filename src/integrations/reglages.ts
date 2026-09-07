/**
 * Réglages par société.
 *
 * Un seul document, rangé dans `societe_settings.infos_entreprise.reglages`.
 * L'identité légale (adresse, SIRET…) reste dans les colonnes de `societes` :
 * on ne duplique pas ce que la base sait déjà.
 *
 * Toute valeur absente retombe sur `REGLAGES_DEFAUT`, si bien qu'une société
 * qui n'a rien personnalisé voit exactement le comportement d'avant.
 */

import { SEUILS, type Seuils } from "./alertes";

export interface ReglagesDocuments {
  validiteDevisJours: number;
  delaiPaiementJours: number;
  tvaDefaut: number;
  modeReglementDefaut: string;
  conditionsDevis: string;
  piedDePage: string;
  mentionAcceptation: string;
  mentionsComplementaires: string;
  /** Rappeler les coordonnées bancaires sur les factures. */
  afficherIban: boolean;
  /** Couleur d'accent des documents imprimés. */
  couleurAccent: string;
}

export interface ReglagesSociete {
  documents: ReglagesDocuments;
  /** Unités proposées dans les lignes et le catalogue. */
  unites: string[];
  /** Métiers proposés en plus de ceux de la table `metiers`. */
  metiers: string[];
  /** Jours avant échéance à partir desquels une alerte apparaît. */
  seuils: Seuils;
  notifications: { actives: boolean; destinataires: string };
}

export const UNITES_DEFAUT = ["U", "ml", "m²", "m³", "h", "j", "forfait", "kg", "l", "ens"];

export const REGLAGES_DEFAUT: ReglagesSociete = {
  documents: {
    validiteDevisJours: 30,
    delaiPaiementJours: 30,
    tvaDefaut: 10,
    modeReglementDefaut: "virement",
    conditionsDevis: "",
    piedDePage: "",
    mentionAcceptation: "Bon pour accord — date et signature",
    mentionsComplementaires: "",
    afficherIban: true,
    couleurAccent: "#FF6A1A",
  },
  unites: UNITES_DEFAUT,
  metiers: [],
  seuils: SEUILS,
  notifications: { actives: true, destinataires: "" },
};

type Brut = Record<string, unknown> | undefined;

const texte = (v: unknown, defaut = ""): string => (v == null ? defaut : String(v));

const nombre = (v: unknown, defaut: number): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : defaut;
};

const booleen = (v: unknown, defaut: boolean): boolean =>
  typeof v === "boolean" ? v : defaut;

/** Liste de chaînes non vides ; un tableau vide retombe sur le défaut. */
const liste = (v: unknown, defaut: string[]): string[] => {
  if (!Array.isArray(v)) return defaut;
  const nettoyee = v.map((x) => String(x).trim()).filter(Boolean);
  return nettoyee.length ? nettoyee : defaut;
};

function fusionnerSeuils(v: Brut): Seuils {
  const out = { ...SEUILS };
  for (const cle of Object.keys(SEUILS) as (keyof Seuils)[]) {
    out[cle] = Math.max(0, nombre(v?.[cle], SEUILS[cle]));
  }
  return out;
}

/**
 * Reconstitue des réglages complets à partir du document stocké.
 *
 * Tolérant par construction : un document partiel, ancien ou corrompu ne doit
 * jamais empêcher l'application de démarrer.
 */
export function fusionnerReglages(brut: unknown): ReglagesSociete {
  const r = (brut ?? {}) as Record<string, unknown>;
  const doc = (r.documents ?? {}) as Record<string, unknown>;
  const notif = (r.notifications ?? {}) as Record<string, unknown>;
  const d = REGLAGES_DEFAUT.documents;

  return {
    documents: {
      validiteDevisJours: nombre(doc.validiteDevisJours, d.validiteDevisJours),
      delaiPaiementJours: nombre(doc.delaiPaiementJours, d.delaiPaiementJours),
      tvaDefaut: nombre(doc.tvaDefaut, d.tvaDefaut),
      modeReglementDefaut: texte(doc.modeReglementDefaut, d.modeReglementDefaut),
      conditionsDevis: texte(doc.conditionsDevis, d.conditionsDevis),
      piedDePage: texte(doc.piedDePage, d.piedDePage),
      mentionAcceptation: texte(doc.mentionAcceptation, d.mentionAcceptation),
      mentionsComplementaires: texte(
        doc.mentionsComplementaires,
        d.mentionsComplementaires
      ),
      afficherIban: booleen(doc.afficherIban, d.afficherIban),
      couleurAccent: texte(doc.couleurAccent, d.couleurAccent),
    },
    unites: liste(r.unites, UNITES_DEFAUT),
    metiers: liste(r.metiers, []),
    seuils: fusionnerSeuils(r.seuils as Brut),
    notifications: {
      actives: booleen(notif.actives, true),
      destinataires: texte(notif.destinataires),
    },
  };
}

/** Libellés des seuils, pour l'écran de réglages. */
export const LIBELLES_SEUILS: Record<keyof Seuils, string> = {
  vehiculeCarte: "Cartes carburant et télépéage",
  vehiculeControle: "Contrôles périodiques véhicule",
  documentLegal: "Documents légaux",
  carteBtp: "Cartes BTP",
  visiteMedicale: "Visites médicales",
  habilitation: "Habilitations",
};
