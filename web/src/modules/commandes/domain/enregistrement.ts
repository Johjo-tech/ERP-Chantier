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
}

/**
 * De la saisie à ce qui s'écrit. Les lignes ne sont gardées que si l'une au
 * moins est renseignée (BC-34) ; le montant est alors le leur (BC-33).
 */
export function preparerEnregistrement({ saisie, client, mode, lignes, brouillon, aujourdhui }: Entree): Preparation {
  const l = lignesPourEnregistrement(lignes);
  const avecContenu = lignesOntDuContenu(l.lignes);
  const saisi = schemaNombreFr.safeParse(saisie.montant.trim() || "0");
  const montantIllisible = !avecContenu && !saisi.success;
  const manques = brouillon ? [] : manquesBonCommande({ adresse: saisie.adresse_locataire, lignes: l.lignes });
  if (l.erreurs.length || manques.length || montantIllisible) return { ok: false, erreursLignes: l.erreurs, manques, montantIllisible };
  const montant = montantAEnregistrer(l.lignes, saisi.success ? saisi.data : 0);
  return { ok: true, entete: enteteAEnregistrer(saisie, client, mode, montant, aujourdhui), lignes: avecContenu ? l.lignes : [] };
}
