/**
 * Ce qui SERA écrit par un import de clients, montré avant tout (IMP-13) —
 * port de `previsualiserImportClients` (src/integrations/clients-import.ts),
 * sans l'annuaire des entreprises (D-EFA-06).
 *
 * Deux écarts prudents avec l'ancien, parce que web/ n'interroge pas
 * l'annuaire et ne peut donc pas prouver ce qu'il écraserait (D-EFA-07) :
 * - une MISE À JOUR n'envoie que ce que le fichier renseigne : une case vide,
 *   ou une colonne absente d'un export partiel, n'efface plus la fiche ;
 * - elle ne touche ni au type de client ni aux traces de l'annuaire
 *   (`eligibilite_*`) : sans annuaire, un office public (B2G) serait rétrogradé
 *   « entreprise française ».
 */
import type { CadreFacturation } from "@/modules/clients/domain/client";
import { CADRE_DEFAUT } from "@/modules/clients/domain/client";
import { CLE_DELAI_PAR_CADRE, DELAIS_PREREGLES, type ModeDelaiPaiement } from "@/modules/clients/domain/delais";
import { adresseElectroniqueParDefaut, cadreSuggere, relveDeLaFactureElectronique } from "@/modules/efacture/domain/cadre";
import { rapprocher, type ClientImporte, type ClientRapprochable, type RapportImportClients } from "./clients";

/** Les colonnes que l'import écrit : les MÊMES clés pour chaque création (piège `columns=`). */
export interface ClientAEcrire {
  nom?: string;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  pays_code: string;
  email: string | null;
  telephone: string | null;
  siret: string | null;
  siren: string | null;
  tva_intracom: string | null;
  cadre_facturation?: CadreFacturation;
  delai_paiement_jours: number | null;
  delai_paiement_mode: ModeDelaiPaiement | null;
  facturation_adresse: string | null;
  facturation_code_postal: string | null;
  facturation_ville: string | null;
  notes: string | null;
  adresse_electronique_schema?: string | null;
  adresse_electronique_valeur?: string | null;
}

export interface ExistantImport extends ClientRapprochable {
  cadre_facturation: CadreFacturation | null;
}

export interface LigneApercuClient {
  ligne: number;
  nom: string;
  cadre: CadreFacturation;
  idExistant: string | null;
  rapprochePar: "siret" | "nom" | null;
  ambigu: string[] | null;
  valeurs: Partial<ClientAEcrire>;
}

export interface ApercuImportClients {
  aCreer: number;
  aMettreAJour: number;
  ambigus: { nom: string; homonymes: string[] }[];
  /** Types de clients déduits, pour les créations — le reste garde le sien. */
  cadres: Partial<Record<CadreFacturation, { compte: number; noms: string[] }>>;
  lignes: LigneApercuClient[];
}

/** Le type d'un client NOUVEAU : sans immatriculation, un particulier ; hors de France, l'international. */
export function cadreDeduit(c: Pick<ClientImporte, "sansImmatriculation" | "paysCode">): CadreFacturation {
  if (c.sansImmatriculation) return "B2C";
  return cadreSuggere({ paysCode: c.paysCode, natureJuridique: "" })?.cadre ?? CADRE_DEFAUT;
}

/** Le délai que le type appelle, SEULEMENT si le fichier n'en portait pas : un arrangement explicite survit. */
function delaiRetenu(c: ClientImporte, cadre: CadreFacturation): { jours: number | null; mode: ModeDelaiPaiement | null } {
  if (c.delaiPaiementJours !== null) return { jours: c.delaiPaiementJours, mode: c.delaiPaiementMode };
  const p = DELAIS_PREREGLES.find((d) => d.cle === CLE_DELAI_PAR_CADRE[cadre]);
  return p ? { jours: p.jours, mode: p.mode } : { jours: null, mode: null };
}

function valeursCreation(c: ClientImporte, cadre: CadreFacturation): ClientAEcrire {
  const delai = delaiRetenu(c, cadre);
  const routage = relveDeLaFactureElectronique(cadre) ? adresseElectroniqueParDefaut({ siret: c.siret, siren: c.siren }) : null;
  return {
    nom: c.nom,
    adresse: c.adresse,
    code_postal: c.codePostal,
    ville: c.ville,
    pays_code: c.paysCode,
    email: c.email,
    telephone: c.telephone,
    siret: c.siret,
    siren: c.siren,
    tva_intracom: c.tvaIntracom,
    cadre_facturation: cadre,
    delai_paiement_jours: delai.jours,
    delai_paiement_mode: delai.mode,
    facturation_adresse: c.facturationAdresse,
    facturation_code_postal: c.facturationCodePostal,
    facturation_ville: c.facturationVille,
    notes: c.notes,
    adresse_electronique_schema: routage?.schema ?? null,
    adresse_electronique_valeur: routage?.valeur ?? null,
  };
}

/** Une mise à jour : ce que le fichier RENSEIGNE, rien de plus, ni le nom (clé à neuf endroits de l'écran), ni le type. */
function valeursMiseAJour(c: ClientImporte): Partial<ClientAEcrire> {
  const lues: Partial<ClientAEcrire> = {
    adresse: c.adresse,
    code_postal: c.codePostal,
    ville: c.ville,
    email: c.email,
    telephone: c.telephone,
    siret: c.siret,
    siren: c.siren,
    tva_intracom: c.tvaIntracom,
    facturation_adresse: c.facturationAdresse,
    facturation_code_postal: c.facturationCodePostal,
    facturation_ville: c.facturationVille,
    notes: c.notes,
  };
  const renseignees = Object.fromEntries(Object.entries(lues).filter(([, v]) => v !== null)) as Partial<ClientAEcrire>;
  // Le pays n'est écrit que s'il vient du fichier : « FR par défaut » n'est pas une information.
  const pays = c.paysExplicite ? { pays_code: c.paysCode } : {};
  const delai = c.delaiPaiementJours !== null ? { delai_paiement_jours: c.delaiPaiementJours, delai_paiement_mode: c.delaiPaiementMode } : {};
  return { ...renseignees, ...pays, ...delai };
}

/** Le rapport téléchargeable : rejets et décisions, triés par ligne (IMP-14). */
export function lignesRapportClients(rapport: RapportImportClients): { ligne: number; motif: string; contenu: string }[] {
  const signales = rapport.signalements.map((s) => ({ ligne: s.ligne, motif: s.motif, contenu: s.code ? `client ${s.code}` : "en-tête du fichier" }));
  return [...rapport.rejets, ...signales].sort((a, b) => a.ligne - b.ligne);
}

export function construireApercuClients(rapport: RapportImportClients, existants: readonly ExistantImport[]): ApercuImportClients {
  const lignes: LigneApercuClient[] = [];
  const ambigus: ApercuImportClients["ambigus"] = [];
  const cadres: ApercuImportClients["cadres"] = {};

  for (const c of rapport.clients) {
    const r = rapprocher(c, existants);
    if (r.type === "ambigu") {
      const homonymes = r.homonymes.map((h) => h.nom);
      ambigus.push({ nom: c.nom, homonymes });
      lignes.push({ ligne: c.ligne, nom: c.nom, cadre: cadreDeduit(c), idExistant: null, rapprochePar: null, ambigu: homonymes, valeurs: {} });
      continue;
    }
    if (r.type === "miseAJour") {
      const existant = existants.find((e) => e.id === r.existant.id);
      lignes.push({ ligne: c.ligne, nom: c.nom, cadre: existant?.cadre_facturation ?? CADRE_DEFAUT, idExistant: r.existant.id, rapprochePar: r.par, ambigu: null, valeurs: valeursMiseAJour(c) });
      continue;
    }
    const cadre = cadreDeduit(c);
    const seau = (cadres[cadre] ??= { compte: 0, noms: [] });
    seau.compte++;
    seau.noms.push(c.nom);
    lignes.push({ ligne: c.ligne, nom: c.nom, cadre, idExistant: null, rapprochePar: null, ambigu: null, valeurs: valeursCreation(c, cadre) });
  }

  return {
    aCreer: lignes.filter((l) => !l.idExistant && !l.ambigu).length,
    aMettreAJour: lignes.filter((l) => l.idExistant).length,
    ambigus,
    cadres,
    lignes,
  };
}
