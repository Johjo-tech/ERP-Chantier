import { refBonCommandeClient } from "@/modules/commandes/domain/regles";

/**
 * Le croisement factures ↔ bons de commande (TRV-07), port de
 * `src/api/regles-liens-facture-bc.ts` (parité : tests/parite/croisement.essai.ts).
 *
 * `factures.bon_commande_id` n'est posé que par quelques chemins ; le motif
 * dominant en production est une facture qui porte le NUMÉRO du bon en texte
 * (`ref_bon_commande_client`). D'où deux voies : la clé, puis le numéro
 * normalisé. Ce rapprochement sert à CHERCHER, jamais à AFFIRMER un lien :
 * ni « Facturé », ni verrou du bon ne le lisent — ils suivent la clé seule.
 */
export interface BonRapprochable {
  id: string;
  numero_bc?: string | null;
  numero_interne?: string | null;
  nature_travaux?: string | null;
  reference_chantier?: string | null;
  adresse?: string | null;
  adresse_locataire?: string | null;
  code_postal?: string | null;
  ville?: string | null;
  occupant?: string | null;
  ancien_locataire?: string | null;
  numero_logement?: string | null;
  etage?: string | null;
}

export interface FactureRapprochable {
  id: string;
  numero?: string | null;
  bon_commande_id?: string | null;
  ref_bon_commande_client?: string | null;
  occupant?: string | null;
  adresse_locataire?: string | null;
}

export interface Apport {
  etiquette: string;
  valeur: string;
}

export interface IndexFactureBon<B extends BonRapprochable, F extends FactureRapprochable> {
  bonsParId: Map<string, B>;
  bonsParCle: Map<string, B[]>;
  facturesParBonId: Map<string, F[]>;
  facturesParCle: Map<string, F[]>;
}

/**
 * La clé commune : la règle métier de `refBonCommandeClient` (première ligne,
 * ni « Sans BC », ni « En attente de BC », ni SAV) appliquée DES DEUX CÔTÉS,
 * plus la tolérance de saisie — casse, accents, espaces multiples.
 */
export function cleRapprochement(numero?: string | null): string | null {
  const reference = refBonCommandeClient(numero);
  if (!reference) return null;
  const propre = reference.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  return propre || null;
}

function ranger<T>(carte: Map<string, T[]>, cle: string, valeur: T) {
  const deja = carte.get(cle);
  if (deja) deja.push(valeur);
  else carte.set(cle, [valeur]);
}

/**
 * Les index, en une passe sur chaque collection. Les collections doivent être
 * celles de LA société active : deux bailleurs peuvent employer la même série.
 */
export function construireIndex<B extends BonRapprochable, F extends FactureRapprochable>(factures: readonly F[], bons: readonly B[]): IndexFactureBon<B, F> {
  const index: IndexFactureBon<B, F> = { bonsParId: new Map(), bonsParCle: new Map(), facturesParBonId: new Map(), facturesParCle: new Map() };
  for (const bon of bons) {
    index.bonsParId.set(bon.id, bon);
    const cle = cleRapprochement(bon.numero_bc);
    if (cle) ranger(index.bonsParCle, cle, bon);
  }
  for (const f of factures) {
    if (f.bon_commande_id) ranger(index.facturesParBonId, f.bon_commande_id, f);
    const cle = cleRapprochement(f.ref_bon_commande_client);
    if (cle) ranger(index.facturesParCle, cle, f);
  }
  return index;
}

function sansDoublon<T extends { id: string }>(listes: readonly (readonly (T | undefined)[])[]): T[] {
  const vus = new Set<string>();
  const sortie: T[] = [];
  for (const x of listes.flat()) {
    if (!x || vus.has(x.id)) continue;
    vus.add(x.id);
    sortie.push(x);
  }
  return sortie;
}

/** Les bons qu'une facture désigne : par la clé, puis par le numéro en texte. */
export function bonsDeLaFacture<B extends BonRapprochable>(f: FactureRapprochable, index: IndexFactureBon<B, FactureRapprochable>): B[] {
  const cle = cleRapprochement(f.ref_bon_commande_client);
  return sansDoublon([[f.bon_commande_id ? index.bonsParId.get(f.bon_commande_id) : undefined], cle ? (index.bonsParCle.get(cle) ?? []) : []]);
}

/** Les factures d'un bon (1 bon → 0..N factures). */
export function facturesDuBon<F extends FactureRapprochable>(b: BonRapprochable, index: IndexFactureBon<BonRapprochable, F>): F[] {
  const cle = cleRapprochement(b.numero_bc);
  return sansDoublon([index.facturesParBonId.get(b.id) ?? [], cle ? (index.facturesParCle.get(cle) ?? []) : []]);
}

const net = (v: string | null | undefined) => (v ?? "").trim();

/** Le lieu des travaux (`lieuIntervention` de `regles-bc.ts`) : la rue du locataire, sinon celle du bon. */
function lieu(b: BonRapprochable): string {
  const rue = net(b.adresse_locataire) || net(b.adresse);
  const commune = [net(b.code_postal), net(b.ville)].filter(Boolean).join(" ");
  return rue ? [rue, commune].filter(Boolean).join(", ") : "";
}

/**
 * Ce qu'un bon apporte à la recherche d'une facture, étiqueté pour dire
 * d'où vient la correspondance. Les LIGNES du bon n'y sont pas : une
 * prestation non facturée ne doit pas rendre la facture trouvable.
 */
export function apportsDuBon(b: BonRapprochable): Apport[] {
  const locataire = [b.occupant, b.ancien_locataire, b.numero_logement, b.etage].filter(Boolean).join(" ");
  return [
    // Le numéro BRUT : un bon qui en cite deux reste trouvable par le second.
    { etiquette: "BC", valeur: net(b.numero_bc) },
    { etiquette: "BC interne", valeur: net(b.numero_interne) },
    { etiquette: "Nature", valeur: net(b.nature_travaux) },
    { etiquette: "Réf. chantier", valeur: net(b.reference_chantier) },
    { etiquette: "Lieu", valeur: lieu(b) },
    { etiquette: "Locataire", valeur: locataire },
  ].filter((a) => a.valeur !== "");
}

/**
 * Ce qu'une facture apporte à la recherche d'un bon. Jamais `facture.adresse`
 * (le siège du client) ; le locataire et le lieu de la facture seulement si
 * le bon n'en porte pas — sinon ce n'est qu'une copie.
 */
export function apportsDeLaFacture(f: FactureRapprochable, b: BonRapprochable, montants: readonly string[]): Apport[] {
  const apports = [
    { etiquette: "Facture", valeur: net(f.numero) },
    { etiquette: "Montant", valeur: montants.filter(Boolean).join(" ") },
  ];
  if (!net(b.occupant)) apports.push({ etiquette: "Locataire", valeur: net(f.occupant) });
  if (!net(b.adresse_locataire) && !net(b.adresse)) apports.push({ etiquette: "Lieu", valeur: net(f.adresse_locataire) });
  return apports.filter((a) => a.valeur !== "");
}
