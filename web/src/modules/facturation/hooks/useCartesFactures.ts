import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { todayISO } from "@/lib/dates";
import { montant, type Montant } from "@/lib/money";
import { montantsCherchables } from "@/lib/recherche";
import { usePermission, useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import type { CadreFacturation } from "@/modules/clients/domain/client";
import { useClients } from "@/modules/clients/hooks/useClients";
import { listerBons } from "@/modules/commandes/api/bons";
import { clesBons } from "@/modules/commandes/hooks/useBons";
import { estAvoir } from "@/modules/documents/domain/totaux";
import { passeParUnePlateforme } from "@/modules/efacture/domain/cadre";
import type { FactureCarte } from "../api/ecran";
import { actionsFacture, refusGesteFacture, type ActionsFacture } from "../domain/actions";
import { etatCarte, etiquettesReglement, joursDepuisEcheance, type EtatCarte } from "../domain/carte";
import type { Apport } from "../domain/croisement";
import type { DocumentFiltrable } from "../domain/filtresEcran";
import { avoirsImputables } from "../domain/lettrage";
import type { Solde } from "../domain/solde";
import { verrouFacture, type Verrou } from "../domain/verrou";
import { useCroisement } from "./useCroisement";
import { useDroitsFacture, useFacturesEcran, useReferencesDevis, useReferencesRapports, useTotauxFactures } from "./useEcranFactures";
import { useSoldes } from "./useFactures";

export interface CarteFactureVue {
  f: FactureCarte;
  ht: Montant;
  ttc: Montant;
  etat: EtatCarte;
  solde: Solde | undefined;
  actions: ActionsFacture;
  verrou: Verrou | null;
  refusImpression: string | null;
  numerosBC: string[];
  origines: {
    devis: { id: string; numero: string } | null;
    rapport: { id: string; numero: string } | null;
    rectifiee: { id: string; numero: string } | null;
    bon: { id: string; numero: string; pieceJointe: boolean } | null;
  };
  plateforme: boolean;
  imputable: boolean;
  destinataire: string | null;
  cherchables: (string | null)[];
  apports: Apport[];
  filtrable: DocumentFiltrable;
}

const SOLDE_VIDE = { cle: "brouillon", paye: 0, reste: 0, sens: 1 } as const;
const DEMI_CENTIME = 0.004;

/**
 * Tout ce qu'une carte de facture affiche, assemblé une fois pour la liste :
 * l'en-tête, les totaux de la base, le solde de la base, les pièces d'origine
 * nommées, les gestes ouverts. Les écrans n'ont plus qu'à dessiner.
 */
export function useCartesFactures() {
  const s = useSocieteActive();
  const factures = useFacturesEcran();
  const totaux = useTotauxFactures();
  const soldes = useSoldes();
  const devis = useReferencesDevis();
  const rapports = useReferencesRapports();
  const clients = useClients();
  const voitBons = usePermission("bons_commande");
  const bons = useQuery({ queryKey: clesBons.liste(s.id), queryFn: () => listerBons(s.id), enabled: voitBons });
  const croisement = useCroisement();
  const droits = useDroitsFacture();
  const aujourdhui = todayISO();

  const cartes = useMemo<CarteFactureVue[]>(() => {
    const parTotal = new Map((totaux.data ?? []).map((t) => [t.facture_id, t]));
    const parSolde = new Map((soldes.data ?? []).map((x) => [x.facture_id, x]));
    const parDevis = new Map((devis.data ?? []).map((d) => [d.id, d.numero]));
    const parRapport = new Map((rapports.data ?? []).map((r) => [r.id, r.numero]));
    const parFacture = new Map((factures.data ?? []).map((f) => [f.id, f]));
    const parBon = new Map((bons.data ?? []).map((b) => [b.id, b]));
    const parClient = new Map((clients.data ?? []).map((c) => [c.id, c]));
    const parNomClient = new Map((clients.data ?? []).map((c) => [c.nom, c]));
    return (factures.data ?? []).map((f) => {
      const avoir = estAvoir(f.type_document);
      const signe = avoir ? -1 : 1;
      const t = parTotal.get(f.id);
      // Le signe s'applique aux montants TELS QUE STOCKÉS (`totauxSignes`) : un avoir saisi en négatif ressort positif, comme dans l'ancien.
      const ht = montant(t?.ht ?? 0).times(signe);
      const ttc = montant(t?.ttc ?? 0).times(signe);
      const solde = parSolde.get(f.id);
      const etat = etatCarte(solde ?? { ...SOLDE_VIDE, reste: ttc.toNumber() }, ttc);
      const verrou = verrouFacture(f);
      const bon = f.bon_commande_id ? parBon.get(f.bon_commande_id) : undefined;
      const numeroRef = (id: string | null, table: Map<string, string | null>) => {
        const n = id ? table.get(id) : undefined;
        return id && n ? { id, numero: n } : null;
      };
      const fiche = (f.client_id && parClient.get(f.client_id)) || parNomClient.get(f.client_nom);
      const cadre = ((fiche && fiche.cadre_facturation) || f.cadre_facturation) as CadreFacturation | null;
      const rectifiee = f.facture_rectifiee_id ? parFacture.get(f.facture_rectifiee_id) : undefined;
      const apports = croisement.apportsFacture(f);
      const cherchables = [f.client_nom, f.numero, f.numero_logement, f.adresse_locataire, f.code_postal, f.ville, f.occupant, f.interlocuteur, f.ancien_locataire, f.precision_commune, f.etage, f.statut, f.conducteur, f.date, f.echeance];
      const jours = joursDepuisEcheance(f, aujourdhui);
      const imputable = !avoir && !!f.numero && !!solde && solde.reste > DEMI_CENTIME && avoirsImputables(solde, soldes.data ?? []).length > 0;
      return {
        f, ht, ttc, etat, solde, verrou,
        actions: actionsFacture(f, droits),
        refusImpression: refusGesteFacture("imprimer", f, droits),
        numerosBC: [f.ref_bon_commande_client, bon?.numero_bc, bon?.numero_interne].filter((x): x is string => !!x),
        origines: {
          devis: numeroRef(f.devis_id, parDevis),
          rapport: numeroRef(f.intervention_id, parRapport),
          rectifiee: rectifiee?.numero ? { id: rectifiee.id, numero: rectifiee.numero } : null,
          bon: bon ? { id: bon.id, numero: bon.numero_bc ?? "", pieceJointe: !!bon.piece_jointe_chemin } : null,
        },
        plateforme: passeParUnePlateforme({ legacy_id: f.legacy_id, cadre_facturation: cadre }),
        imputable,
        destinataire: fiche?.email ?? null,
        cherchables,
        apports,
        filtrable: {
          client: f.client_nom,
          interlocuteur: f.interlocuteur,
          conducteur: f.conducteur,
          logement: f.logement_statut,
          date: f.date,
          cherchable: [...cherchables, ...apports.map((a) => a.valeur), ...montantsCherchables(ttc)],
          reglements: etiquettesReglement(etat, jours),
        },
      };
    });
  }, [factures.data, totaux.data, soldes.data, devis.data, rapports.data, bons.data, clients.data, croisement, droits, aujourdhui]);

  return {
    cartes,
    soldes: soldes.data ?? [],
    chargement: factures.isPending || totaux.isPending || soldes.isPending,
    erreur: factures.error ?? totaux.error ?? soldes.error,
    reessayer: () => {
      void factures.refetch();
      void totaux.refetch();
      void soldes.refetch();
    },
    droits,
    aujourdhui,
  };
}
