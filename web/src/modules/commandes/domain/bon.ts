import { z } from "zod";
import { videEnNull } from "@/lib/validation";
import { ligneVide, type LigneBase, type LigneEdition } from "@/modules/documents/domain/lignes";
import { nettoyerLogement } from "@/modules/documents/domain/logement";
import { modeDuBon, numeroAEnregistrer, numeroSaisissable, type ModeBon } from "./regles";

const statutLogement = z.enum(["occupé", "vacant", "commune"]).nullable();

/**
 * Un bon LU PAR LA VUE `v_bons_commande_terrain` : `montant` y vaut NULL pour
 * le technicien et le sous-traitant (BC-56). Le téléphone du locataire n'y
 * figure pas (BC-93) : il n'est donc ni lu ni réécrit.
 */
export const schemaBon = z.object({
  id: z.string(),
  societe_id: z.string(),
  numero_interne: z.string().nullable(),
  numero_bc: z.string().nullable(),
  sans_bc: z.boolean(),
  en_attente_bc: z.boolean(),
  bon_commande_parent_id: z.string().nullable(),
  client_id: z.string().nullable(),
  client_nom: z.string(),
  interlocuteur: z.string().nullable(),
  adresse: z.string().nullable(),
  code_postal: z.string().nullable(),
  ville: z.string().nullable(),
  logement_statut: statutLogement,
  occupant: z.string().nullable(),
  etage: z.string().nullable(),
  numero_logement: z.string().nullable(),
  precision_commune: z.string().nullable(),
  ancien_locataire: z.string().nullable(),
  date: z.string(),
  date_reception: z.string().nullable(),
  date_fin_travaux: z.string().nullable(),
  nature_travaux: z.string().nullable(),
  reference_chantier: z.string().nullable(),
  notes: z.string().nullable(),
  montant: z.number().nullable(),
  statut: z.string().nullable(),
  statut_workflow: z.string().nullable(),
  conducteur_id: z.string().nullable(),
  conducteur: z.string().nullable(),
});
export type EnteteBon = z.infer<typeof schemaBon>;

/** Une ligne lue par `v_bon_commande_lignes_terrain` : prix NULL pour le terrain. */
export const schemaLigneBon = z.object({
  id: z.string(),
  position: z.number(),
  type: z.enum(["ligne", "chapitre", "commentaire"]),
  designation: z.string(),
  quantite: z.number(),
  prix_unitaire: z.number().nullable(),
  unite: z.string().nullable(),
  tva: z.number(),
  article_reference: z.string().nullable(),
  commentaire: z.string().nullable(),
  metier: z.string().nullable(),
});
export type LigneBonLue = z.infer<typeof schemaLigneBon>;

/** Pour l'éditeur : seul un rôle qui voit les prix édite, et il les lit tous. */
export const versLigneBase = (l: LigneBonLue): LigneBase => ({ ...l, prix_unitaire: l.prix_unitaire ?? 0 });

export const estSav = (b: Pick<EnteteBon, "bon_commande_parent_id">) => b.bon_commande_parent_id !== null;

const texte = z.preprocess(videEnNull, z.string().trim().nullable());
const date = z.preprocess(videEnNull, z.iso.date({ message: "Date invalide." }).nullable());

/** L'en-tête saisi : le client est obligatoire, brouillon compris (app.js l. 8440). */
export const schemaSaisieBon = z.object({
  client_id: z.string().min(1, "Choisissez un client."),
  interlocuteur: texte,
  conducteur_id: texte,
  numero_bc: z.string(),
  reference_chantier: texte,
  date_reception: date,
  date_fin_travaux: date,
  nature_travaux: texte,
  notes: texte,
  montant: z.string(),
  adresse_locataire: texte,
  code_postal: texte,
  ville: texte,
  telephone_locataire: z.string(),
  logement_statut: z.preprocess(videEnNull, statutLogement),
  occupant: texte,
  etage: texte,
  numero_logement: texte,
  precision_commune: texte,
  ancien_locataire: texte,
});
export type SaisieBon = z.infer<typeof schemaSaisieBon>;
export type ValeursBon = Record<keyof SaisieBon, string>;

/**
 * Ce qu'un autre écran (la lecture automatique d'un bon) peut préremplir, par
 * l'état de navigation. Validé ici : l'état de navigation n'est pas une donnée sûre.
 */
const nombreOuTexte = z.union([z.number(), z.string()]).optional();
export const schemaPreRemplissage = z.object({
  client_id: z.string().optional(),
  numero_bc: z.string().optional(),
  reference_chantier: z.string().optional(),
  date_reception: z.string().optional(),
  date_fin_travaux: z.string().optional(),
  adresse_locataire: z.string().optional(),
  code_postal: z.string().optional(),
  ville: z.string().optional(),
  nature_travaux: z.string().optional(),
  lignes: z
    .array(z.object({ designation: z.string().optional(), quantite: nombreOuTexte, unite: z.string().optional(), prix_unitaire: nombreOuTexte }))
    .optional(),
});
export type PreRemplissageBon = z.infer<typeof schemaPreRemplissage>;

export function lirePreRemplissage(etat: unknown): PreRemplissageBon | null {
  const prefill = typeof etat === "object" && etat !== null && "prefill" in etat ? etat.prefill : undefined;
  if (prefill === undefined) return null;
  const r = schemaPreRemplissage.safeParse(prefill);
  if (!r.success) console.error("Préremplissage du bon ignoré : forme inattendue", r.error.issues);
  return r.success ? r.data : null;
}

const enTexte = (n: number | string | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

/** Les lignes lues ailleurs deviennent des lignes à relire, à la TVA par défaut de la société. */
export function lignesDepuisPreRemplissage(p: PreRemplissageBon | null, tvaDefaut: number): LigneEdition[] {
  return (p?.lignes ?? []).map((l) => {
    const vide = ligneVide(tvaDefaut);
    return {
      ...vide,
      designation: l.designation ?? "",
      quantite: l.quantite === undefined ? vide.quantite : enTexte(l.quantite),
      unite: l.unite ?? vide.unite,
      prix_unitaire: l.prix_unitaire === undefined ? vide.prix_unitaire : enTexte(l.prix_unitaire),
    };
  });
}

export function valeursDepuis(b: EnteteBon | null, p: PreRemplissageBon | null): ValeursBon {
  return {
    client_id: b?.client_id ?? p?.client_id ?? "",
    interlocuteur: b?.interlocuteur ?? "",
    conducteur_id: b?.conducteur_id ?? "",
    numero_bc: b ? numeroSaisissable(b.numero_bc) : (p?.numero_bc ?? ""),
    reference_chantier: b?.reference_chantier ?? p?.reference_chantier ?? "",
    date_reception: b?.date_reception ?? p?.date_reception ?? "",
    date_fin_travaux: b?.date_fin_travaux ?? p?.date_fin_travaux ?? "",
    nature_travaux: b?.nature_travaux ?? p?.nature_travaux ?? "",
    notes: b?.notes ?? "",
    montant: enTexte(b?.montant ?? 0),
    // Le lieu des travaux d'un bon vit dans `adresse` (et non `adresse_locataire`) : c'est elle que lit bc_generer_facture.
    adresse_locataire: b?.adresse ?? p?.adresse_locataire ?? "",
    code_postal: b?.code_postal ?? p?.code_postal ?? "",
    ville: b?.ville ?? p?.ville ?? "",
    telephone_locataire: "",
    logement_statut: b?.logement_statut ?? "",
    occupant: b?.occupant ?? "",
    etage: b?.etage ?? "",
    numero_logement: b?.numero_logement ?? "",
    precision_commune: b?.precision_commune ?? "",
    ancien_locataire: b?.ancien_locataire ?? "",
  };
}

export const modeInitial = (b: EnteteBon | null): ModeBon => (b ? modeDuBon(b) : "normal");

/**
 * L'en-tête à écrire. `conducteur` part à null : l'étiquette est tenue par un
 * déclencheur d'après `conducteur_id`, et un nom écrit seul serait réécrit.
 * La date de réception vide vaut aujourd'hui, comme dans l'ancien écran.
 */
export function enteteAEnregistrer(s: SaisieBon, client: { nom: string }, mode: ModeBon, montant: number, aujourdhui: string) {
  const { montant: _m, adresse_locataire, telephone_locataire: _t, numero_bc, ...reste } = s;
  return nettoyerLogement({
    ...reste,
    ...numeroAEnregistrer(mode, numero_bc),
    client_nom: client.nom,
    adresse: adresse_locataire,
    date_reception: s.date_reception ?? aujourdhui,
    montant,
    conducteur: null,
  });
}
export type EnteteAEnregistrer = ReturnType<typeof enteteAEnregistrer>;
