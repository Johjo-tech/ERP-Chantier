import { z } from "zod";
import { correspond } from "@/lib/recherche";
import { videEnNull } from "@/lib/validation";
import { memeMetier } from "@/modules/planning/domain/metiers";

/**
 * La fiche salarié (RH-01, RH-03, RH-05) : ce que l'écran saisit, comment la
 * liste se filtre, et le registre unique du personnel.
 */

export const TYPES_CONTRAT = ["CDI", "CDD", "Intérim", "Apprenti"] as const;

/** La sentinelle du poste libre : le référentiel n'accepte pas de parenthèse en tête de libellé. */
export const POSTE_AUTRE = "(autre)";

/** Ce que la liste et la fiche lisent d'un salarié (les colonnes sensibles sont `null` sans `rh/modifier`). */
export interface Salarie {
  id: string;
  nom: string;
  prenom: string | null;
  poste: string | null;
  email: string | null;
  telephone: string | null;
  dateEntree: string | null;
  dateSortie: string | null;
  typeContrat: string | null;
  carteBtpNumero: string | null;
  carteBtpValidite: string | null;
  visiteMedicaleDate: string | null;
  visiteMedicaleProchaine: string | null;
  technicienId: string | null;
  salaireMensuelNet: number | null;
  coutHoraireCharge: number | null;
  soldeCpInitial: number | null;
  dateNaissance: string | null;
  nationalite: string | null;
  sexe: string | null;
  actif: boolean;
  profileId: string | null;
}

/** « Prénom Nom », comme partout ailleurs dans l'application. */
export function nomComplet(s: Pick<Salarie, "prenom" | "nom">): string {
  return [s.prenom, s.nom].filter(Boolean).join(" ").trim() || s.nom || "—";
}

/** Un poste tiré du référentiel ? Comparaison tolérante (`memeMetier`) ; vide = pas de choix libre. */
export function posteEstDuReferentiel(poste: string | null | undefined, referentiel: readonly string[]): boolean {
  const v = (poste ?? "").trim();
  if (!v) return true;
  return referentiel.some((m) => memeMetier(m, v));
}

/**
 * La valeur du menu « Poste » pour un poste enregistré : le métier du
 * référentiel qui lui correspond, ou « Autre… » s'il a été saisi à la main.
 * Sans ce repli, ouvrir puis enregistrer une fiche changerait le poste en
 * silence (51 salariés portaient un poste libre dans l'ancienne base).
 */
export function choixPoste(poste: string | null | undefined, referentiel: readonly string[]): { choix: string; libre: string } {
  const v = (poste ?? "").trim();
  if (!v) return { choix: "", libre: "" };
  const m = referentiel.find((r) => memeMetier(r, v));
  return m ? { choix: m, libre: "" } : { choix: POSTE_AUTRE, libre: v };
}

/** Ce qui part en base : le métier choisi, ou le texte libre. */
export function posteSaisi(choix: string, libre: string): string {
  return choix === POSTE_AUTRE ? libre.trim() : choix;
}

/**
 * Les entrées du filtre métier : le référentiel D'ABORD, puis les postes portés
 * par les fiches et qu'il ne déclare pas. Bâtir le filtre sur les seuls postes
 * tapés faisait de « Plombier », « PLOMBIER » et « plomberie » trois entrées.
 */
export function metiersDuFiltre(referentiel: readonly string[], salaries: readonly Pick<Salarie, "poste">[]): string[] {
  const hors = Array.from(new Set(salaries.map((s) => s.poste).filter((p): p is string => !!p)))
    .filter((v) => !referentiel.some((m) => memeMetier(m, v)))
    .sort((a, b) => a.localeCompare(b));
  return [...referentiel, ...hors];
}

/** Recherche sur nom, prénom et poste (chaque mot doit se trouver), puis filtre exact sur le poste. */
export function filtrerSalaries<T extends Pick<Salarie, "nom" | "prenom" | "poste">>(liste: readonly T[], recherche: string, metier: string): T[] {
  return liste.filter((s) => correspond(recherche, s.nom, s.prenom, s.poste)).filter((s) => !metier || s.poste === metier);
}

/**
 * Le registre unique du personnel (C. trav. L.1221-13) : tous les salariés,
 * sortis compris, par ordre d'embauche ; une fiche sans date d'entrée va en fin.
 */
export function registreDuPersonnel<T extends Pick<Salarie, "dateEntree">>(liste: readonly T[]): T[] {
  return [...liste].sort((a, b) => (a.dateEntree || "9999").localeCompare(b.dateEntree || "9999"));
}

export function libelleSexe(sexe: string | null | undefined): string {
  return sexe === "F" ? "Femme" : sexe === "M" ? "Homme" : "—";
}

const texte = z.preprocess(videEnNull, z.string().trim().nullable());
const date = z.preprocess(videEnNull, z.iso.date("Date invalide.").nullable());
/** Un montant saisi à la française, au centime ; vide = non renseigné (l'ancien `parseFloat(…) || null`). */
const montantSaisi = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(/\s/g, "").replace(",", ".") : v),
  z.preprocess(videEnNull, z.string().regex(/^\d+(\.\d{1,2})?$/, "Montant invalide (au centime, sans signe).").transform(Number).nullable())
);
const joursSaisis = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(/\s/g, "").replace(",", ".") : v),
  z.preprocess(videEnNull, z.string().regex(/^\d+(\.\d{1,2})?$/, "Nombre de jours invalide.").transform(Number).nullable())
);

export const schemaSaisieSalarie = z
  .object({
    prenom: texte,
    nom: z.string().trim().min(1, "Le nom du salarié est requis."),
    posteChoix: z.string(),
    posteLibre: z.string(),
    dateNaissance: date,
    nationalite: texte,
    sexe: z.preprocess(videEnNull, z.enum(["F", "M"]).nullable()),
    technicienId: z.preprocess(videEnNull, z.string().nullable()),
    typeContrat: z.preprocess(videEnNull, z.string().nullable()),
    coutHoraireCharge: montantSaisi,
    salaireMensuelNet: montantSaisi,
    dateEntree: date,
    dateSortie: date,
    telephone: texte,
    email: z.preprocess((v) => videEnNull(typeof v === "string" ? v.trim() : v), z.email("Adresse e-mail invalide.").nullable()),
    carteBtpNumero: texte,
    carteBtpValidite: date,
    soldeCpInitial: joursSaisis,
  })
  .refine((s) => !s.dateEntree || !s.dateSortie || s.dateSortie >= s.dateEntree, { message: "La fin de contrat précède son début.", path: ["dateSortie"] })
  .refine((s) => s.posteChoix !== POSTE_AUTRE || s.posteLibre.trim() !== "", { message: "Précisez le poste.", path: ["posteLibre"] })
  .transform(({ posteChoix, posteLibre, ...reste }) => ({ ...reste, poste: videEnNull(posteSaisi(posteChoix, posteLibre)) as string | null }));
export type SaisieSalarie = z.infer<typeof schemaSaisieSalarie>;

/** Les valeurs texte du formulaire, depuis une fiche (ou vides pour une création). */
export function valeursFormulaire(s: Salarie | null, referentiel: readonly string[]) {
  const poste = choixPoste(s?.poste, referentiel);
  const nombre = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
  return {
    prenom: s?.prenom ?? "",
    nom: s?.nom ?? "",
    posteChoix: poste.choix,
    posteLibre: poste.libre,
    dateNaissance: s?.dateNaissance ?? "",
    nationalite: s?.nationalite ?? "",
    sexe: s?.sexe ?? "",
    technicienId: s?.technicienId ?? "",
    typeContrat: s?.typeContrat ?? TYPES_CONTRAT[0],
    coutHoraireCharge: nombre(s?.coutHoraireCharge),
    salaireMensuelNet: nombre(s?.salaireMensuelNet),
    dateEntree: s?.dateEntree ?? "",
    dateSortie: s?.dateSortie ?? "",
    telephone: s?.telephone ?? "",
    email: s?.email ?? "",
    carteBtpNumero: s?.carteBtpNumero ?? "",
    carteBtpValidite: s?.carteBtpValidite ?? "",
    soldeCpInitial: nombre(s?.soldeCpInitial),
  };
}
