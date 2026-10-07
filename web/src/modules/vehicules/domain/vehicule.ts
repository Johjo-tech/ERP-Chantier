import { z } from "zod";
import { correspond } from "@/lib/recherche";
import { videEnNull } from "@/lib/validation";

/** Une fiche véhicule telle que la base la rend (`vehicules`). */
export const schemaVehicule = z.object({
  id: z.string(),
  societe_id: z.string(),
  nom: z.string().nullable(),
  immatriculation: z.string().nullable(),
  marque: z.string().nullable(),
  modele: z.string().nullable(),
  type_vehicule: z.string().nullable(),
  tva_applicable: z.boolean().nullable(),
  motorisation: z.string().nullable(),
  taille_pneus: z.string().nullable(),
  kilometrage: z.number().nullable(),
  date_achat: z.string().nullable(),
  date_controle_technique: z.string().nullable(),
  conducteur_salarie_id: z.string().nullable(),
  telepeage_fournisseur: z.string().nullable(),
  telepeage_numero: z.string().nullable(),
  telepeage_validite: z.string().nullable(),
  carte_carburant_fournisseur: z.string().nullable(),
  carte_carburant_numero: z.string().nullable(),
  carte_carburant_validite: z.string().nullable(),
  vendu: z.boolean(),
  date_vente: z.string().nullable(),
  prix_vente: z.number().nullable(),
  facture_vente_id: z.string().nullable(),
});
export type Vehicule = z.infer<typeof schemaVehicule>;

/** Les trois types de l'ancien formulaire ; CTTE par défaut (app.js l. 15088). */
export const TYPES_VEHICULE = [
  { code: "CTTE", libelle: "Véhicule CTTE" },
  { code: "VP", libelle: "Véhicule VP" },
  { code: "Tourisme", libelle: "Véhicule de tourisme" },
] as const;
export const TYPE_PAR_DEFAUT = "CTTE";

/** Les types du menu ; un type inconnu déjà porté par la fiche y reste, sinon l'enregistrer le changerait. */
export function typesProposes(courant: string): { valeur: string; libelle: string }[] {
  const connus = TYPES_VEHICULE.map((t) => ({ valeur: t.code as string, libelle: t.libelle as string }));
  return courant && !connus.some((t) => t.valeur === courant) ? [{ valeur: courant, libelle: courant }, ...connus] : connus;
}

/** `vehiculeTypeLabel` : le code court, ou la valeur telle quelle si elle est inconnue. */
export function libelleType(t: string | null): string {
  return ({ CTTE: "CTTE", VP: "VP", Tourisme: "Tourisme" } as Record<string, string>)[t ?? ""] ?? t ?? "";
}

/**
 * Comment on désigne un véhicule (`libelleVehicule`, app.js l. 15065).
 * L'IMMATRICULATION fait foi (unique par société en base) ; marque et modèle
 * décrivent. `nom`, qui n'est plus saisi, reste montré : un surnom d'usage
 * (« Camion 3 ») y a peut-être été écrit.
 */
export function libelleVehicule(v: Pick<Vehicule, "immatriculation" | "marque" | "modele" | "nom"> | null | undefined): string {
  if (!v) return "";
  const plaque = (v.immatriculation ?? "").trim();
  const modele = [v.marque, v.modele].map((x) => (x ?? "").trim()).filter(Boolean).join(" ");
  const surnom = (v.nom ?? "").trim();
  const parts = [plaque || surnom || modele || "Véhicule sans immatriculation"];
  if (plaque && modele) parts.push(modele);
  else if (plaque && surnom) parts.push(surnom);
  return parts.join(" · ");
}

export type FiltreVehicules = "actifs" | "vendus" | "tous";

/** Le filtre AVANT la recherche : chercher dans « Vendus » ne ressuscite pas un véhicule en service. */
export function filtrerVehicules<V extends Pick<Vehicule, "vendu">>(liste: readonly V[], filtre: FiltreVehicules): V[] {
  if (filtre === "tous") return [...liste];
  return liste.filter((v) => (filtre === "vendus" ? v.vendu : !v.vendu));
}

export function compterVehicules(liste: readonly Pick<Vehicule, "vendu">[]): Record<FiltreVehicules, number> {
  const vendus = liste.filter((v) => v.vendu).length;
  return { actifs: liste.length - vendus, vendus, tous: liste.length };
}

export function chercherVehicules<V extends Vehicule>(liste: readonly V[], recherche: string, conducteur: (v: V) => string | null): V[] {
  return liste.filter((v) =>
    correspond(recherche, v.immatriculation, v.marque, v.modele, v.nom, v.type_vehicule, v.motorisation, v.taille_pneus, conducteur(v))
  );
}

const texte = z.preprocess(videEnNull, z.string().trim().nullable());
const date = z.preprocess(videEnNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.").nullable());

/**
 * La saisie de la fiche. L'immatriculation est OBLIGATOIRE et mise en
 * capitales : « ab-123-cd » et « AB-123-CD » désigneraient deux fiches pour un
 * même camion. La validité de la carte carburant est une DATE (la colonne l'est) :
 * l'ancien champ texte « Validité / code PIN » faisait rejeter tout
 * l'enregistrement par Postgres dès qu'on y tapait un code (D-VEH-05).
 */
export const schemaSaisieVehicule = z.object({
  immatriculation: z
    .string()
    .trim()
    .min(1, "L'immatriculation est requise : c'est elle qui identifie le véhicule.")
    .transform((s) => s.toUpperCase()),
  marque: texte,
  modele: texte,
  // Texte libre en base : un type hors des trois connus (reprise) se garde tel quel.
  type_vehicule: z.string().trim().min(1, "Choisissez un type de véhicule."),
  tva_applicable: z.enum(["oui", "non"]).transform((v) => v === "oui"),
  motorisation: texte,
  taille_pneus: texte,
  kilometrage: z.preprocess(
    (v) => (typeof v === "string" ? videEnNull(v.replace(/[\s\u00a0\u202f]/g, "")) : v),
    z.coerce.number({ message: "Kilométrage invalide." }).min(0, "Le kilométrage ne peut pas être négatif.").nullable()
  ),
  date_achat: date,
  date_controle_technique: date,
  conducteur_salarie_id: texte,
  telepeage_fournisseur: texte,
  telepeage_numero: texte,
  telepeage_validite: date,
  carte_carburant_fournisseur: texte,
  carte_carburant_numero: texte,
  carte_carburant_validite: date,
});
export type SaisieVehicule = z.infer<typeof schemaSaisieVehicule>;

export function saisieDepuis(v: Vehicule | null): Record<keyof SaisieVehicule, string> {
  return {
    immatriculation: v?.immatriculation ?? "",
    marque: v?.marque ?? "",
    modele: v?.modele ?? "",
    type_vehicule: v?.type_vehicule || TYPE_PAR_DEFAUT,
    tva_applicable: v?.tva_applicable === false ? "non" : "oui",
    motorisation: v?.motorisation ?? "",
    taille_pneus: v?.taille_pneus ?? "",
    kilometrage: v?.kilometrage == null ? "" : String(v.kilometrage),
    date_achat: v?.date_achat ?? "",
    date_controle_technique: v?.date_controle_technique ?? "",
    conducteur_salarie_id: v?.conducteur_salarie_id ?? "",
    telepeage_fournisseur: v?.telepeage_fournisseur ?? "",
    telepeage_numero: v?.telepeage_numero ?? "",
    telepeage_validite: v?.telepeage_validite ?? "",
    carte_carburant_fournisseur: v?.carte_carburant_fournisseur ?? "",
    carte_carburant_numero: v?.carte_carburant_numero ?? "",
    carte_carburant_validite: v?.carte_carburant_validite ?? "",
  };
}

/** « 12 345 km », ou « — » comme l'ancien écran pour 0 ou vide. */
export function formatKm(km: number | null): string {
  return km ? `${km.toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ")} km` : "—";
}
