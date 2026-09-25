/**
 * De web/ vers les noms de champ de l'ancien gabarit : les lignes de la base
 * (`quantite`, `prix_unitaire`) deviennent `qte`, `prixUnitaire` ; le lieu
 * passe en camelCase comme le faisait html-adapter.ts. Et la pièce prête à
 * imprimer : son HTML, son nom de fichier, ses couleurs.
 */
import { z } from "zod";
import type { IdentiteEmettrice } from "../domain/identite";
import { renderPrintDoc, NOM_FICHIER_DEFAUT, type ContexteImpression, type DocImprimable, type LigneImprimable, type SocieteImprimable } from "./gabarit";
import type { PieceImprimee } from "./zone";

export interface LigneDeBase {
  type: string;
  designation: string;
  quantite: number;
  prix_unitaire: number;
  unite: string | null;
  tva: number;
}

export function lignesImprimables(lignes: readonly LigneDeBase[]): LigneImprimable[] {
  return lignes.map((l) => ({ type: l.type, designation: l.designation, qte: l.quantite, unite: l.unite, prixUnitaire: l.prix_unitaire, tva: l.tva }));
}

export interface LieuDeBase {
  adresse_locataire?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  logement_statut?: string | null;
  occupant?: string | null;
  etage?: string | null;
  numero_logement?: string | null;
  precision_commune?: string | null;
  ancien_locataire?: string | null;
  telephone_locataire?: string | null;
}

export function lieuImprimable(r: LieuDeBase): DocImprimable {
  return {
    adresseLocataire: r.adresse_locataire,
    codePostal: r.code_postal,
    ville: r.ville,
    logementStatut: r.logement_statut,
    occupant: r.occupant,
    etage: r.etage,
    numeroLogement: r.numero_logement,
    precisionCommune: r.precision_commune,
    ancienLocataire: r.ancien_locataire,
    telephoneLocataire: r.telephone_locataire,
  };
}

/** Ce que l'émetteur apporte à toute pièce : `state.settings[societe]`, son nom d'usage, ses couleurs. */
export interface EmetteurImprimable {
  s: SocieteImprimable;
  nomSociete: string;
  variables: Record<string, string>;
}

/**
 * L'émetteur vu de l'espace client : il ne lit que l'identité légale publiée
 * par la vue `v_mes_acces_clients` — ni réglages d'impression, ni couleurs,
 * que la RLS ne lui ouvre pas (D-FAC-10) ; le gabarit retombe alors sur ses
 * défauts, comme l'ancien sur une société sans réglage.
 */
export function emetteurDepuisIdentite(i: IdentiteEmettrice): EmetteurImprimable {
  return {
    s: {
      raisonSocialeLegale: i.nom, formeJuridique: i.formeJuridique, adresse: i.adresse, codePostal: i.codePostal, ville: i.ville,
      telephone: i.telephone, email: i.email, siret: i.siret, siren: i.siren, tvaIntracom: i.tvaIntracom, capitalSocial: i.capitalSocial,
      rcsNumero: i.rcsNumero, rcsVille: i.rcsVille, codeNaf: i.codeNaf, iban: i.iban, bic: i.bic, logo: i.logo, reglages: { documents: {} },
    },
    nomSociete: i.nom,
    variables: {},
  };
}

/** `printDocument` : le HTML de `renderPrintDoc` et le nom `doc.numero || NOM_FICHIER_DEFAUT[type]`. */
export function pieceImprimee(c: ContexteImpression, variables: Record<string, string>): PieceImprimee {
  return { html: renderPrintDoc(c), nomFichier: c.doc.numero || NOM_FICHIER_DEFAUT[c.type] || "document", variables };
}

/* Les colonnes de `societes` que `lireSettings` recopie (CHAMPS_SOCIETE, html-adapter.ts). */
const COLONNES: [keyof SocieteImprimable, string][] = [
  ["adresse", "adresse"], ["codePostal", "code_postal"], ["ville", "ville"], ["telephone", "telephone"], ["email", "email"],
  ["siret", "siret"], ["siren", "siren"], ["tvaIntracom", "tva_intracom"], ["raisonSocialeLegale", "raison_sociale_legale"],
  ["formeJuridique", "forme_juridique"], ["codeNaf", "code_naf"], ["capitalSocial", "capital_social"], ["rcsNumero", "rcs_numero"],
  ["rcsVille", "rcs_ville"], ["iban", "iban"], ["bic", "bic"],
];

const valeurLibre = z.union([z.string(), z.number(), z.null()]);

/**
 * `lireSettings` : les colonnes (vide → ""), puis le JSON libre qui les
 * recouvre — l'ancien écran lisait ainsi l'adresse ou l'IBAN saisis dans ses
 * réglages avant ceux des colonnes. Seules les clés que le gabarit lit passent.
 */
export function societeImprimable(colonnes: Record<string, unknown>, infosEntreprise: unknown, logo: string | null, documents: SocieteImprimable["reglages"]): SocieteImprimable {
  const s: SocieteImprimable = {};
  const libres = z.record(z.string(), z.unknown()).safeParse(infosEntreprise);
  for (const [champ, colonne] of COLONNES) {
    const lu = valeurLibre.safeParse(colonnes[colonne] ?? "");
    const libre = libres.success && champ in libres.data ? valeurLibre.safeParse(libres.data[champ]) : null;
    const v = libre?.success ? libre.data : lu.success ? lu.data : "";
    (s as Record<string, unknown>)[champ] = v;
  }
  s.logo = logo;
  s.reglages = documents;
  return s;
}
