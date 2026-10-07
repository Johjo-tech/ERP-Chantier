import Big from "big.js";
import { schemaNombreFr } from "@/lib/nombres";
import { lignesPourEnregistrement, type ErreurLigne, type LigneAEnregistrer, type LigneEdition } from "@/modules/documents/domain/lignes";
import { enteteAEnregistrer, type EnteteAEnregistrer, type SaisieBon } from "./bon";
import { lignesOntDuContenu, manquesBonCommande, montantAEnregistrer, type Manque, type ModeBon } from "./regles";

export type Preparation =
  | { ok: true; entete: EnteteAEnregistrer; lignes: LigneAEnregistrer[] }
  | { ok: false; erreursLignes: ErreurLigne[]; manques: Manque[]; montantIllisible: boolean };

interface Entree {
  saisie: SaisieBon;
  client: { nom: string };
  mode: ModeBon;
  lignes: readonly LigneEdition[];
  /** Le brouillon échappe au contrôle d'adresse et de lignes : c'est tout son objet (BC-06). */
  brouillon: boolean;
  aujourdhui: string;
  /** Les métiers cochés, dans l'ordre ; le premier devient `metier` (BC-35). */
  metiers?: readonly string[];
  /** Les montants saisis par métier (texte), lus seulement quand au moins deux métiers sont cochés (BC-11). */
  montantsParMetier?: Readonly<Record<string, string>>;
  /** Un SAV garde son numéro de notre série. */
  numeroSav?: string | null;
}

/** Deux métiers au moins : le montant se ventile, comme l'ancien formulaire (bcMontantFieldsHTML). */
export const MIN_METIERS_VENTILES = 2;

function lireVentilation(metiers: readonly string[], saisis: Readonly<Record<string, string>>): { parMetier: Record<string, number>; total: number } | null {
  const parMetier: Record<string, number> = {};
  let total = new Big(0);
  for (const m of metiers) {
    const r = schemaNombreFr.safeParse((saisis[m] ?? "").trim() || "0");
    if (!r.success) return null;
    parMetier[m] = r.data;
    total = total.plus(r.data);
  }
  return { parMetier, total: Number(total.toString()) };
}

/**
 * De la saisie à ce qui s'écrit. Les lignes ne sont gardées que si l'une au
 * moins est renseignée (BC-34) ; le montant est alors le leur, sinon la somme
 * des montants par métier, sinon le montant global (BC-33). La ventilation
 * reste enregistrée même quand les lignes font foi : elle ne sert qu'à répartir.
 */
export function preparerEnregistrement({ saisie, client, mode, lignes, brouillon, aujourdhui, metiers = [], montantsParMetier = {}, numeroSav = null }: Entree): Preparation {
  const l = lignesPourEnregistrement(lignes);
  const avecContenu = lignesOntDuContenu(l.lignes);
  const ventile = metiers.length >= MIN_METIERS_VENTILES;
  const ventilation = ventile ? lireVentilation(metiers, montantsParMetier) : null;
  const saisi = schemaNombreFr.safeParse(saisie.montant.trim() || "0");
  const montantIllisible = ventile ? ventilation === null : !avecContenu && !saisi.success;
  const manques = brouillon ? [] : manquesBonCommande({ adresse: saisie.adresse_locataire, lignes: l.lignes });
  if (l.erreurs.length || manques.length || montantIllisible) return { ok: false, erreursLignes: l.erreurs, manques, montantIllisible };
  const base = ventilation ? ventilation.total : saisi.success ? saisi.data : 0;
  const montant = montantAEnregistrer(l.lignes, base);
  const entete = enteteAEnregistrer(saisie, client, mode, montant, aujourdhui, { metiers: [...metiers], montantParMetier: ventilation?.parMetier ?? null }, numeroSav);
  return { ok: true, entete, lignes: avecContenu ? l.lignes : [] };
}
