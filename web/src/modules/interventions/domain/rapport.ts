import { z } from "zod";
import { correspond } from "@/lib/recherche";

/**
 * Le rapport d'intervention (« recherche de fuite ») : quatre étapes — infos,
 * contrôles par métier, photos et signatures, rapport rédigé.
 *
 * Port de `app.js` l. 11405-11985 (METIERS, CONTROLES_PAR_METIER,
 * cleanLogementFields, parsePreconisationsEnLignes, saveIntervention) ;
 * parité : tests/parite/rapports.essai.ts.
 */

/** Les trois métiers du rapport : ceux de l'énumération `metier_type` de la base. */
export const METIERS_RAPPORT = [
  { valeur: "plomberie", libelle: "Plomberie" },
  { valeur: "electricite", libelle: "Électricité" },
  { valeur: "etancheite", libelle: "Étanchéité" },
] as const;
export type MetierRapport = (typeof METIERS_RAPPORT)[number]["valeur"];

export interface PointDeControle {
  cle: string;
  libelle: string;
}

export const CONTROLES_PAR_METIER: Record<MetierRapport, readonly PointDeControle[]> = {
  plomberie: [
    { cle: "alim_froide", libelle: "Alimentation eau froide" },
    { cle: "alim_chaude", libelle: "Alimentation eau chaude" },
    { cle: "evacuations", libelle: "Évacuations" },
    { cle: "appareils", libelle: "Appareils sanitaires" },
    { cle: "joints", libelle: "Joints (silicone, faïence)" },
    { cle: "colonne", libelle: "Colonne / gaine technique" },
    { cle: "pression", libelle: "Test de pression" },
    { cle: "compteur", libelle: "Compteur d’eau" },
    { cle: "autre", libelle: "Autre contrôle" },
  ],
  electricite: [
    { cle: "tableau", libelle: "Tableau électrique" },
    { cle: "disjoncteurs", libelle: "Disjoncteurs / différentiels" },
    { cle: "prises", libelle: "Prises et interrupteurs" },
    { cle: "eclairage", libelle: "Éclairage" },
    { cle: "mise_terre", libelle: "Mise à la terre" },
    { cle: "continuite", libelle: "Continuité des circuits" },
    { cle: "isolement", libelle: "Isolement électrique" },
    { cle: "autre", libelle: "Autre contrôle" },
  ],
  etancheite: [
    { cle: "revetement", libelle: "Revêtement d’étanchéité" },
    { cle: "releves", libelle: "Relevés d’étanchéité" },
    { cle: "evacuations_ep", libelle: "Évacuations eaux pluviales" },
    { cle: "joints_dilatation", libelle: "Joints de dilatation" },
    { cle: "infiltrations", libelle: "Traces d’infiltration" },
    { cle: "ventilation", libelle: "Ventilation / points singuliers" },
    { cle: "autre", libelle: "Autre contrôle" },
  ],
};

/** Trois photos au plus par rapport, comme l'ancien écran. */
export const PHOTOS_MAX = 3;
export const STATUT_DEFAUT = "en cours";
export const ETAPES = ["Infos", "Contrôles", "Photos", "Rapport"] as const;

export type LogementStatut = "occupé" | "vacant" | "commune";
export type CategoriePhoto = "constatation" | "preconisation";

export function libelleMetier(m: string | null | undefined): string {
  return METIERS_RAPPORT.find((x) => x.valeur === m)?.libelle ?? "";
}

export interface ChampsLogement {
  logement_statut: LogementStatut | null;
  occupant: string | null;
  etage: string | null;
  numero_logement: string | null;
  precision_commune: string | null;
  ancien_locataire: string | null;
}

/** Ne garde que les champs qui ont un sens pour ce type de logement (`cleanLogementFields`). */
export function nettoyerLogement(l: ChampsLogement): ChampsLogement {
  const s = l.logement_statut;
  const garde = (ok: boolean, v: string | null) => (ok && v?.trim() ? v : null);
  return {
    logement_statut: s,
    occupant: garde(s === "occupé", l.occupant),
    etage: garde(s === "occupé" || s === "vacant", l.etage),
    numero_logement: garde(s === "occupé" || s === "vacant", l.numero_logement),
    precision_commune: garde(s === "commune", l.precision_commune),
    ancien_locataire: garde(s === "vacant", l.ancien_locataire),
  };
}

/** Personne à faire signer dans un logement vide ou une partie commune (PLN-21). */
export function signatureClientDemandee(statut: LogementStatut | null | undefined): boolean {
  return statut !== "vacant" && statut !== "commune";
}

const texte = z.string().trim();
export const schemaSaisieRapport = z.object({
  client_id: z.string().nullable(),
  client_nom: texte.min(1, "Le nom du client est requis (étape Infos)."),
  interlocuteur: texte,
  bon_commande_id: z.string().nullable(),
  logement_statut: z.enum(["occupé", "vacant", "commune"]).nullable(),
  occupant: texte,
  etage: texte,
  numero_logement: texte,
  precision_commune: texte,
  ancien_locataire: texte,
  adresse_locataire: texte,
  code_postal: texte.regex(/^(\d{5})?$/, "Code postal à 5 chiffres."),
  ville: texte,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  heure: texte,
  metier: z.enum(["plomberie", "electricite", "etancheite"]).nullable(),
  conducteur_id: z.string().nullable(),
  constatations: z.string(),
  preconisations: z.string(),
  controles: z.record(z.string(), z.boolean()),
  precision_autre: texte,
  statut: texte,
});
export type SaisieRapport = z.infer<typeof schemaSaisieRapport>;

export interface RapportListe {
  id: string;
  numero: string | null;
  client_nom: string;
  interlocuteur: string | null;
  adresse: string | null;
  adresse_locataire: string | null;
  code_postal: string | null;
  ville: string | null;
  numero_logement: string | null;
  occupant: string | null;
  logement_statut: string | null;
  conducteur: string | null;
  metier: string | null;
  constatations: string | null;
  preconisations: string | null;
  sous_traitant_id: string | null;
}

export type Emetteur = "internes" | "sous_traitants" | "tous";

export interface FiltresRapports {
  recherche: string;
  conducteur: string;
  logement: string;
  emetteur: Emetteur;
}

/**
 * La liste des rapports (`renderInterventionsListHTML`). Les rapports d'un
 * sous-traitant sont à part : la base ne les montre qu'à lui (proposition
 * 20260926052000, défaut PLN-52), l'encadrement les retrouve par « Émetteur ».
 */
export function filtrerRapports<R extends RapportListe>(liste: readonly R[], f: FiltresRapports): R[] {
  return liste.filter(
    (r) =>
      (f.emetteur === "tous" || (f.emetteur === "sous_traitants") === !!r.sous_traitant_id) &&
      (!f.conducteur || r.conducteur === f.conducteur) &&
      (!f.logement || r.logement_statut === f.logement) &&
      correspond(f.recherche, r.numero, r.client_nom, r.interlocuteur, r.adresse, r.adresse_locataire, r.code_postal, r.ville, r.numero_logement, r.occupant, r.conducteur, libelleMetier(r.metier), r.constatations, r.preconisations)
  );
}

/** Le corps du courriel (`envoyerRapportEmail`), avec les lignes du logement. */
export function courrielDuRapport(r: Pick<RapportListe, "client_nom" | "adresse" | "adresse_locataire" | "code_postal" | "ville" | "logement_statut" | "occupant" | "numero_logement" | "constatations" | "preconisations"> & { date: string; ancien_locataire: string | null }): { objet: string; corps: string } {
  const lieu = [r.adresse_locataire || r.adresse, [r.code_postal, r.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const lignes = [
    lieu && `Adresse : ${lieu}`,
    r.logement_statut === "occupé" && r.occupant ? `Locataire : ${r.occupant}` : r.logement_statut === "vacant" && r.ancien_locataire ? `Ancien locataire : ${r.ancien_locataire}` : "",
    r.numero_logement ? `N° de logement : ${r.numero_logement}` : "",
  ].filter(Boolean);
  const date = r.date.split("-").reverse().join("/");
  return {
    objet: `Rapport d'intervention — ${r.client_nom}`,
    corps: `Client : ${r.client_nom}\n${lignes.join("\n")}\nDate : ${date}\n\nConstatations :\n${r.constatations ?? ""}\n\nPréconisations :\n${r.preconisations ?? ""}`,
  };
}
