import { z } from "zod";
import { videEnNull } from "@/lib/validation";
import { ligneVide, type LigneBase, type LigneEdition } from "@/modules/documents/domain/lignes";
import { nettoyerLogement } from "@/modules/documents/domain/logement";
import { modeDuBon, numeroAEnregistrer, numeroSaisissable, type ModeBon } from "./regles";

const statutLogement = z.enum(["occupé", "vacant", "commune"]).nullable();

/**
 * Un bon LU PAR LA VUE `v_bons_commande_terrain` : `montant` et
 * `montant_par_metier` y valent NULL pour le technicien et le sous-traitant
 * (BC-56). Le téléphone du locataire n'y figure pas (BC-93) : il n'est donc ni
 * lu ni réécrit.
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
  /** Lue pour la pièce imprimée : la carte « Adresse du chantier » de l'ancien gabarit (D-PDF-01). */
  adresse_locataire: z.string().nullish(),
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
  devis_id: z.string().nullable(),
  probleme_description: z.string().nullable(),
  facturation_adresse: z.string().nullable(),
  facturation_code_postal: z.string().nullable(),
  facturation_ville: z.string().nullable(),
  piece_jointe_chemin: z.string().nullable(),
  piece_jointe_nom: z.string().nullable(),
  piece_jointe_mime: z.string().nullable(),
  metier: z.string().nullable(),
  /** jsonb : l'ancienne app y met un tableau de noms ; la prudence reste (`metiersDuBon`). */
  metiers: z.unknown(),
  /** jsonb `{ métier: montant }`, validé à l'usage (`montantsSaisisParMetier`). */
  montant_par_metier: z.unknown(),
  gratuite: z.boolean(),
  gratuite_motif: z.string().nullable(),
  /** jsonb des appels et SMS sans réponse (`tentativesDuBon`). */
  tentatives_contact: z.unknown(),
  rappel_date: z.string().nullable(),
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
  devis_id: texte,
  /** Où envoyer la facture quand ce n'est pas le siège : `bc_generer_facture` les recopie dans `factures.facturation_*`. */
  facturation_adresse: texte,
  facturation_code_postal: texte,
  facturation_ville: texte,
  /** « Ce qui ne va pas » : la raison d'être d'un SAV. */
  probleme_description: texte,
});
export type SaisieBon = z.infer<typeof schemaSaisieBon>;
export type ValeursBon = Record<keyof SaisieBon, string>;

/**
 * Ce qu'un autre écran (la lecture automatique d'un bon) peut préremplir, par
 * l'état de navigation. Validé ici : l'état de navigation n'est pas une donnée sûre.
 */
const nombreOuTexte = z.union([z.number(), z.string()]).nullish();
export const schemaPreRemplissage = z.object({
  client_id: z.string().nullish(),
  interlocuteur: z.string().nullish(),
  /** `sans_bc` quand la lecture n'a trouvé aucun numéro (versSaisieBonCommande : `sansBC = !numeroBC`). */
  mode: z.enum(["normal", "sans_bc", "attente_bc"]).nullish(),
  numero_bc: z.string().nullish(),
  reference_chantier: z.string().nullish(),
  date_reception: z.string().nullish(),
  date_fin_travaux: z.string().nullish(),
  adresse_locataire: z.string().nullish(),
  code_postal: z.string().nullish(),
  ville: z.string().nullish(),
  nature_travaux: z.string().nullish(),
  notes: z.string().nullish(),
  logement_statut: statutLogement.nullish().catch(null),
  occupant: z.string().nullish(),
  etage: z.string().nullish(),
  numero_logement: z.string().nullish(),
  facturation_adresse: z.string().nullish(),
  facturation_code_postal: z.string().nullish(),
  facturation_ville: z.string().nullish(),
  montant: nombreOuTexte,
  lignes: z
    .array(
      z.object({
        type: z.enum(["ligne", "chapitre", "commentaire"]).nullish(),
        designation: z.string().nullish(),
        quantite: nombreOuTexte,
        unite: z.string().nullish(),
        prix_unitaire: nombreOuTexte,
        tva: nombreOuTexte,
      })
    )
    .nullish(),
});
export type PreRemplissageBon = z.infer<typeof schemaPreRemplissage>;

export function lirePreRemplissage(etat: unknown): PreRemplissageBon | null {
  const prefill = typeof etat === "object" && etat !== null && "prefill" in etat ? etat.prefill : undefined;
  if (prefill === undefined) return null;
  const r = schemaPreRemplissage.safeParse(prefill);
  if (!r.success) console.error("Préremplissage du bon ignoré : forme inattendue", r.error.issues);
  return r.success ? r.data : null;
}

/**
 * Le document lu par la lecture automatique, retenu comme pièce jointe du bon
 * (OCR-04). Un `File` traverse l'état de navigation (clonage structuré) ; tout
 * autre chose est ignoré.
 */
export function lireFichierRetenu(etat: unknown): File | null {
  const f = typeof etat === "object" && etat !== null && "fichier" in etat ? etat.fichier : null;
  return f instanceof File ? f : null;
}

const enTexte = (n: number | string | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

/** Les lignes lues ailleurs deviennent des lignes à relire, à la TVA lue sinon à celle de la société. */
export function lignesDepuisPreRemplissage(p: PreRemplissageBon | null, tvaDefaut: number): LigneEdition[] {
  return (p?.lignes ?? []).map((l) => {
    const vide = ligneVide(tvaDefaut, l.type ?? "ligne");
    return {
      ...vide,
      designation: l.designation ?? "",
      quantite: l.quantite == null ? vide.quantite : enTexte(l.quantite),
      unite: l.unite ?? vide.unite,
      prix_unitaire: l.prix_unitaire == null ? vide.prix_unitaire : enTexte(l.prix_unitaire),
      tva: l.tva == null ? vide.tva : enTexte(l.tva),
    };
  });
}

export function valeursDepuis(b: EnteteBon | null, p: PreRemplissageBon | null): ValeursBon {
  return {
    client_id: b?.client_id ?? p?.client_id ?? "",
    interlocuteur: b?.interlocuteur ?? p?.interlocuteur ?? "",
    conducteur_id: b?.conducteur_id ?? "",
    numero_bc: b ? numeroSaisissable(b.numero_bc) : (p?.numero_bc ?? ""),
    reference_chantier: b?.reference_chantier ?? p?.reference_chantier ?? "",
    date_reception: b?.date_reception ?? p?.date_reception ?? "",
    date_fin_travaux: b?.date_fin_travaux ?? p?.date_fin_travaux ?? "",
    nature_travaux: b?.nature_travaux ?? p?.nature_travaux ?? "",
    notes: b?.notes ?? p?.notes ?? "",
    montant: enTexte(b?.montant ?? p?.montant ?? 0),
    // Le lieu des travaux d'un bon vit dans `adresse` (et non `adresse_locataire`) : c'est elle que lit bc_generer_facture.
    adresse_locataire: b?.adresse ?? p?.adresse_locataire ?? "",
    code_postal: b?.code_postal ?? p?.code_postal ?? "",
    ville: b?.ville ?? p?.ville ?? "",
    telephone_locataire: "",
    logement_statut: b?.logement_statut ?? p?.logement_statut ?? "",
    occupant: b?.occupant ?? p?.occupant ?? "",
    etage: b?.etage ?? p?.etage ?? "",
    numero_logement: b?.numero_logement ?? p?.numero_logement ?? "",
    precision_commune: b?.precision_commune ?? "",
    ancien_locataire: b?.ancien_locataire ?? "",
    devis_id: b?.devis_id ?? "",
    facturation_adresse: b?.facturation_adresse ?? p?.facturation_adresse ?? "",
    facturation_code_postal: b?.facturation_code_postal ?? p?.facturation_code_postal ?? "",
    facturation_ville: b?.facturation_ville ?? p?.facturation_ville ?? "",
    probleme_description: b?.probleme_description ?? "",
  };
}

export const modeInitial = (b: EnteteBon | null, p: PreRemplissageBon | null = null): ModeBon => (b ? modeDuBon(b) : (p?.mode ?? "normal"));

/** Les montants par métier relus en base, en texte de saisie ; une valeur illisible est ignorée, pas inventée. */
export function montantsSaisisParMetier(brut: unknown): Record<string, string> {
  if (typeof brut !== "object" || brut === null || Array.isArray(brut)) return {};
  const sortie: Record<string, string> = {};
  for (const [metier, v] of Object.entries(brut)) if (typeof v === "number" || typeof v === "string") sortie[metier] = enTexte(v);
  return sortie;
}

/** L'adresse de facturation se replie tant qu'elle est vide : dépliée d'office dès qu'elle porte quelque chose (BC-05). */
export const facturationRenseignee = (v: Pick<ValeursBon, "facturation_adresse" | "facturation_code_postal" | "facturation_ville">) =>
  [v.facturation_adresse, v.facturation_code_postal, v.facturation_ville].some((x) => x.trim() !== "");

/** Ce que la saisie des métiers apporte à l'en-tête : la liste et la ventilation. */
export interface MetiersAEnregistrer {
  metiers: string[];
  montantParMetier: Record<string, number> | null;
}

/**
 * L'en-tête à écrire. `conducteur` part à null : l'étiquette est tenue par un
 * déclencheur d'après `conducteur_id`, et un nom écrit seul serait réécrit.
 * La date de réception vide vaut aujourd'hui, comme dans l'ancien écran.
 * `metier` = le premier métier coché (BC-35), jamais `""`. Un SAV garde son
 * numéro de notre série et reste « sans BC » (saveBonCommande, `isSAV`).
 */
export function enteteAEnregistrer(
  s: SaisieBon,
  client: { nom: string },
  mode: ModeBon,
  montant: number,
  aujourdhui: string,
  m: MetiersAEnregistrer = { metiers: [], montantParMetier: null },
  numeroSav: string | null = null
) {
  const { montant: _m, adresse_locataire, telephone_locataire: _t, numero_bc, ...reste } = s;
  const numero = numeroSav ? { numero_bc: numeroSav, sans_bc: true, en_attente_bc: false } : numeroAEnregistrer(mode, numero_bc);
  return nettoyerLogement({
    ...reste,
    ...numero,
    client_nom: client.nom,
    adresse: adresse_locataire,
    date_reception: s.date_reception ?? aujourdhui,
    montant,
    metiers: m.metiers,
    metier: m.metiers.at(0) ?? null,
    montant_par_metier: m.montantParMetier,
    conducteur: null,
  });
}
export type EnteteAEnregistrer = ReturnType<typeof enteteAEnregistrer>;
