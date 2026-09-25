import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { useSession, useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import { EditeurLignes } from "@/modules/documents/components/EditeurLignes";
import { depuisBase, lignesPourEnregistrement, type LigneEdition } from "@/modules/documents/domain/lignes";
import { totauxDocument } from "@/modules/documents/domain/totaux";
import { REGLAGES_DEFAUT, type ReglagesDocuments } from "@/modules/societes/domain/reglages";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import type { Bon } from "../api/bons";
import { versLigneBase } from "../domain/bon";
import { actionsFacturation, BLOCAGES_ACCOMPLIS, blocagesChiffrage, peutEcrireTerrain, type Blocage } from "../domain/circuit";
import { depuisLignesAEnregistrer, documentDirecteur, travauxSaisis, versLignesAEnregistrer, type SaisieTravail, type Travail } from "../domain/prefacture";
import { montantAEnregistrer } from "../domain/regles";
import { verrouBonCommande } from "../domain/verrou";
import type { TacheBon } from "../domain/workflow";
import { useBon, useEnregistrerPrix, useMetiersDisponibles, useTaches, useTravaux, useValiderPrefacture } from "../hooks/useBons";
import { ChampMetierChapitre } from "./ChampMetierChapitre";
import { MetiersConnus } from "./metiersConnus";
import { DocumentPrefacture } from "./DocumentPrefacture";
import { ReferencePrefacture } from "./ReferencePrefacture";

function BandeauBlocages({ blocages, contournement, peutValider }: { blocages: readonly Blocage[]; contournement: boolean; peutValider: boolean }) {
  useModeDiscret();
  if (blocages.length && blocages.every((b) => BLOCAGES_ACCOMPLIS.includes(b.code))) return <Alert variant="succes">{blocages.map((b) => <p key={b.code}>✓ {b.libelle}</p>)}</Alert>;
  if (blocages.length) {
    return (
      <Alert>
        <p className="font-semibold">⚠ Il reste {blocages.length === 1 ? "un point" : "des points"} à traiter avant de valider</p>
        <ul className="list-disc pl-5">{blocages.map((b) => <li key={b.code}>{b.libelle}{b.details.length > 0 && <span className="text-muted-foreground"> — {b.details.join(", ")}</span>}</li>)}</ul>
        {contournement && <p className="mt-2 text-sm">Le montant, lui, est complet. Si cette affaire n'a pas de terrain à pointer, « Valider sans passer par le planning » l'envoie en facturation — et la base en garde la trace.</p>}
      </Alert>
    );
  }
  if (!peutValider) return <Alert>Le dossier est complet. La validation revient à un administrateur — enregistrez, il prendra la suite.</Alert>;
  return <Alert variant="succes">✓ Rien ne reste en suspens : la pré-facture peut être validée.</Alert>;
}

type Confirmation = null | "attente_bc" | "hors_circuit";

interface Props {
  bon: Bon;
  taches: readonly TacheBon[];
  travaux: readonly Travail[];
  reglages: ReglagesDocuments;
  /** Remonté au parent : après enregistrement, la pré-facture relue remonte (les lignes prennent leur uuid). */
  message: string | null;
  /** Rendu après la relecture de la fiche : le formulaire ne remonte que sur l'état enregistré. */
  onEnregistre: (message: string) => Promise<void>;
}

/**
 * La pré-facture (BC-17, BC-18, BC-47) : la secrétaire complète, seul
 * l'administrateur valide. Valider = enregistrer les prix, intégrer les
 * travaux chiffrés aux lignes du bon (à la place de leur métier), puis la
 * transition par la base — hors circuit compris (BC-91).
 */
function Prefacture({ bon, taches, travaux, reglages, message, onEnregistre }: Props) {
  useModeDiscret();
  const navigate = useNavigate();
  const { roleEffectif } = useSession();
  const droits = actionsFacturation(roleEffectif);
  const connus = useMetiersDisponibles();
  const fige = verrouBonCommande(bon.factures) !== null;
  const [lignes, setLignes] = useState<LigneEdition[]>(() => bon.lignes.map(versLigneBase).map(depuisBase));
  const [saisies, setSaisies] = useState<Record<string, SaisieTravail>>({});
  // Refermée à chaque ouverture (nouveau montage) et à chaque erreur : le contournement ne doit jamais rester offert au bon suivant (BC-71).
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [erreur, setErreur] = useState<unknown>(null);
  const valider = useValiderPrefacture();
  const enregistrer = useEnregistrerPrix();
  const chiffrageTravaux = peutEcrireTerrain(roleEffectif) && !fige;

  const l = lignesPourEnregistrement(lignes);
  const actifs = travaux.filter((t) => t.statut === "a_chiffrer" || t.statut === "chiffre");
  const saisis = travauxSaisis(actifs, saisies);
  const document = documentDirecteur(depuisLignesAEnregistrer(l.lignes), saisis.travaux, taches, connus, reglages.tvaDefaut);
  const dossier = { statutWorkflow: bon.statut_workflow, taches, travaux: saisis.travaux, lignes: l.lignes.map((x) => ({ type: x.type, designation: x.designation, prixUnitaire: x.prix_unitaire })) };
  const blocages = blocagesChiffrage(dossier);
  const horsCircuit = blocagesChiffrage(dossier, { horsCircuit: true });
  const contournement = blocages.length > 0 && horsCircuit.length === 0 && droits.peutFacturerHorsCircuit;
  const saisieValide = l.erreurs.length === 0 && Object.keys(saisis.erreurs).length === 0;
  const prix = chiffrageTravaux
    ? saisis.travaux.filter((t) => saisies[t.id] && t.prix_vente_ht !== null).map((t) => ({ id: t.id, prix: t.prix_vente_ht ?? 0, quantite: t.quantite ?? 1, unite: t.unite ?? "u" }))
    : [];
  const enCours = valider.isPending || enregistrer.isPending;

  function echec(e: unknown) {
    setConfirmation(null);
    setErreur(e);
  }

  function lancer(horsCircuitDemande: boolean) {
    setErreur(null);
    const doc = versLignesAEnregistrer(document);
    valider.mutate(
      { bonId: bon.id, statutWorkflow: bon.statut_workflow, lignes: doc, montant: montantAEnregistrer(doc, 0), prix, integres: saisis.travaux.filter((t) => t.statut === "chiffre").map((t) => t.id), horsCircuit: horsCircuitDemande },
      {
        onSuccess: () => void navigate(`/commandes/${bon.id}`, { state: { message: horsCircuitDemande ? "Pré-facture validée hors circuit — le bon passe à « À facturer »." : "Pré-facture validée — le bon passe à « À facturer »." } }),
        onError: echec,
      }
    );
  }

  /** Un bon encore « en attente de BC » : la référence client sera figée vide sur la facture — on avertit, on ne refuse pas. */
  function demanderValidation() {
    if (bon.en_attente_bc && confirmation !== "attente_bc") return setConfirmation("attente_bc");
    setConfirmation(null);
    lancer(false);
  }

  const ttc = totauxDocument(document).ttc;
  return (
    <MetiersConnus.Provider value={connus}>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4">
          {fige && <Alert>Ce bon est facturé : la pré-facture n'est plus qu'un brouillon dépassé.</Alert>}
          <BandeauBlocages blocages={blocages} contournement={contournement} peutValider={droits.peutValiderPrefacture} />
          {erreur !== null && <Alert variant="erreur">{messageErreur(erreur)}</Alert>}
          <h2 className="text-base font-semibold">Lignes du bon</h2>
          <EditeurLignes lignes={lignes} onChange={setLignes} tvaDefaut={reglages.tvaDefaut} unites={reglages.unites} taux={reglages.tauxTva} erreurs={l.erreurs} lectureSeule={fige || !droits.peutModifierPrefacture} ChampMetier={ChampMetierChapitre} />
          {!chiffrageTravaux && actifs.length > 0 && <p className="text-xs text-muted-foreground">Le chiffrage des travaux supplémentaires revient à l'administrateur ou au conducteur.</p>}
          <DocumentPrefacture document={document} connus={connus} saisies={saisies} erreurs={saisis.erreurs} onSaisie={(id, s) => setSaisies((avant) => ({ ...avant, [id]: s }))} chiffrageTravaux={chiffrageTravaux} />
          {!fige && droits.peutModifierPrefacture && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" disabled={enCours || !saisieValide} onClick={() => { setErreur(null); enregistrer.mutate({ bonId: bon.id, lignes: l.lignes, montant: montantAEnregistrer(l.lignes, 0), prix }, { onSuccess: () => void onEnregistre("Prix enregistrés."), onError: echec }); }}>
                Enregistrer les prix
              </Button>
              {droits.peutValiderPrefacture && (
                <Button disabled={enCours || !saisieValide || blocages.length > 0} onClick={demanderValidation}>{valider.isPending ? "Validation…" : "Valider la pré-facture"}</Button>
              )}
              {contournement && <Button variant="secondary" disabled={enCours || !saisieValide} onClick={() => setConfirmation("hors_circuit")}>Valider sans passer par le planning</Button>}
              {message && <span role="status" className="text-sm">{message}</span>}
            </div>
          )}
          {confirmation === "attente_bc" && (
            <Alert>
              <p>Ce bon attend encore le numéro de commande du client. La facture partira SANS cette référence et ne pourra plus la recevoir une fois émise : un bailleur ou une collectivité la refusera, et la corriger demandera un avoir. Saisissez le numéro sur le bon (« BC reçu ») si vous l'avez reçu.</p>
              <div className="mt-2 flex gap-2"><Button size="sm" onClick={demanderValidation}>Valider quand même</Button><Button size="sm" variant="ghost" onClick={() => setConfirmation(null)}>Annuler</Button></div>
            </Alert>
          )}
          {confirmation === "hors_circuit" && (
            <Alert>
              <p>Envoyer ce bon en facturation SANS passer par le planning ? {bon.client_nom} — {formatEurosEcran(ttc)} TTC. Aucune tâche n'attestera des travaux ; ce contournement est enregistré au journal de la base, avec votre nom.</p>
              <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => { setConfirmation(null); lancer(true); }}>Confirmer hors circuit</Button><Button size="sm" variant="ghost" onClick={() => setConfirmation(null)}>Annuler</Button></div>
            </Alert>
          )}
        </div>
        <ReferencePrefacture bon={bon} taches={taches} />
      </div>
    </MetiersConnus.Provider>
  );
}

export function PagePrefacture() {
  useModeDiscret();
  const { id } = useParams();
  const bon = useBon(id);
  const taches = useTaches(id);
  const travaux = useTravaux(id);
  const reglages = useReglages();
  // Remonté après « Enregistrer les prix » seulement (les lignes y prennent leur uuid) : une erreur, elle, reste affichée.
  // Et remonté sur la fiche RELUE : sinon « Valider » enverrait les anciennes lignes et un montant calculé sur elles (relecture 4, B1).
  const [enregistrement, setEnregistrement] = useState<{ n: number; message: string | null }>({ n: 0, message: null });
  const { roleEffectif } = useSession();
  const prix = useVoitLesPrix();
  if (!prix || !actionsFacturation(roleEffectif).peutModifierPrefacture) return <Alert>La pré-facture se chiffre depuis un compte administrateur ou secrétariat.</Alert>;
  if (bon.isPending || taches.isPending || travaux.isPending || reglages.isPending) return <Chargement />;
  const erreur = bon.error ?? taches.error ?? travaux.error;
  if (erreur || !bon.data || !taches.data || !travaux.data) return <Erreur erreur={erreur} reessayer={() => void bon.refetch()} />;
  return (
    <div className="flex flex-col gap-4">
      <EnTetePage titre={`Pré-facture — BC ${bon.data.numero_interne ?? bon.data.numero_bc ?? "sans numéro"}`} sousTitre={bon.data.client_nom} actions={<Button variant="ghost" asChild><Link to={`/commandes/${bon.data.id}`}>Retour au bon</Link></Button>} />
      <Prefacture key={`${bon.data.id}-${enregistrement.n}`} bon={bon.data} taches={taches.data} travaux={travaux.data} reglages={reglages.data ?? REGLAGES_DEFAUT} message={enregistrement.message} onEnregistre={async (m) => {
        await Promise.all([bon.refetch(), travaux.refetch()]);
        setEnregistrement((e) => ({ n: e.n + 1, message: m }));
      }} />
    </div>
  );
}
