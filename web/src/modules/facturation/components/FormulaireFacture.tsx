import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { schemaNombreFr } from "@/lib/nombres";
import { useFormulaire } from "@/lib/useFormulaire";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { dateEcheance, delaiPaiementRetenu, libelleDelaiPaiement, type DelaiPaiement } from "@/modules/clients/domain/delais";
import { useClients } from "@/modules/clients/hooks/useClients";
import { BlocTotaux } from "@/modules/documents/components/BlocTotaux";
import { ChampsEnteteDocument } from "@/modules/documents/components/ChampsEnteteDocument";
import { EditeurLignes } from "@/modules/documents/components/EditeurLignes";
import { SectionLieu } from "@/modules/documents/components/SectionLieu";
import type { ChampReferenceLigne } from "@/modules/documents/components/reference";
import { depuisBase, ligneVide, lignesPourEnregistrement, type ErreurLigne, type LigneEdition } from "@/modules/documents/domain/lignes";
import type { ReglagesDocuments } from "@/modules/societes/domain/reglages";
import { FacturePartielle } from "../api/factures";
import { enteteAEnregistrer, schemaSaisieFacture, valeursDepuis, type Facture } from "../domain/facture";
import { verrouFacture } from "../domain/verrou";
import { useCadenas, useDupliquerFacture, useEmettre, useEnregistrerFacture, useSupprimerBrouillon } from "../hooks/useFactures";
import { ActionsDocumentFacture } from "./ActionsDocumentFacture";
import { ChampsReglementFacture } from "./ChampsReglementFacture";

export function FormulaireFacture({ facture, reglages, ChampReference }: { facture: Facture | null; reglages: ReglagesDocuments; ChampReference?: ChampReferenceLigne | undefined }) {
  const navigate = useNavigate();
  const location = useLocation();
  const clients = useClients();
  const enregistrer = useEnregistrerFacture(facture?.id);
  const emettre = useEmettre();
  const supprimer = useSupprimerBrouillon();
  const dupliquer = useDupliquerFacture();
  const { lever } = useCadenas(facture?.id ?? "");
  const droitEcrire = usePermission("factures", facture ? "modifier" : "creer");
  const peutSupprimer = usePermission("factures", "supprimer");
  const peutCreer = usePermission("factures", "creer");
  const verrou = facture ? verrouFacture(facture) : null;
  // Le cadenas « téléchargée / envoyée » fige la saisie ; on le lève d'abord (FAC-09).
  const peutEcrire = droitEcrire && !verrou;
  const { valeurs, erreurs, changer, valider } = useFormulaire(valeursDepuis(facture, todayISO()));
  const [lignes, setLignes] = useState<LigneEdition[]>(() => (facture?.lignes.length ? facture.lignes.map(depuisBase) : [ligneVide(reglages.tvaDefaut)]));
  const [erreursLignes, setErreursLignes] = useState<ErreurLigne[]>([]);
  const [message, setMessage] = useState<string | null>(() => (location.state as { message?: string } | null)?.message ?? null);

  const client = clients.data?.find((c) => c.id === valeurs.client_id) ?? null;
  // Le délai figé sur la facture l'emporte ; à défaut celui du client, puis de la société. Il reste modifiable (FAC-04).
  const [delaiSaisi, setDelaiSaisi] = useState<DelaiPaiement | null>(() =>
    facture?.delai_paiement_jours != null ? { jours: facture.delai_paiement_jours, mode: facture.delai_paiement_mode ?? "net" } : null
  );
  const delai = delaiSaisi ?? delaiPaiementRetenu(client, { delai_paiement_jours: reglages.delaiPaiementJours, delai_paiement_mode: reglages.modeDelaiPaiement });
  const echeance = valeurs.echeance_manuelle === "oui" ? valeurs.echeance : dateEcheance(valeurs.date, delai);

  /** Valide et enregistre ce qui est à l'écran ; rend l'id, ou null si la saisie est refusée. */
  async function enregistrerEcran(): Promise<string | null> {
    setMessage(null);
    const saisie = valider(schemaSaisieFacture);
    const remise = schemaNombreFr.safeParse(valeurs.remise_pourcentage);
    const l = lignesPourEnregistrement(lignes);
    setErreursLignes(l.erreurs);
    if (!saisie || !remise.success || l.erreurs.length) return null;
    if (!client) {
      setMessage("Client introuvable : rechargez la page (la liste des clients n'a pas pu être lue).");
      return null;
    }
    const entete = enteteAEnregistrer(saisie, client, Math.min(100, Math.max(0, remise.data)), delai, libelleDelaiPaiement(delai), echeance || null);
    try {
      return await enregistrer.mutateAsync({ entete, lignes: l.lignes });
    } catch (err) {
      if (err instanceof FacturePartielle && !facture) void navigate(`/factures/${err.factureId}`, { replace: true });
      return null;
    }
  }

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    const id = await enregistrerEcran();
    if (!id) return;
    setMessage("Brouillon enregistré.");
    if (!facture) void navigate(`/factures/${id}`, { replace: true, state: { message: "Brouillon enregistré." } });
  }

  /**
   * Émettre la version À L'ÉCRAN : elle est d'abord enregistrée (D-028). Sous
   * cadenas, rien n'a pu changer : on émet ce qui a été envoyé, sans réécrire.
   */
  async function emettreEcran() {
    const id = verrou && facture ? facture.id : await enregistrerEcran();
    if (!id) return;
    emettre.mutate(id, {
      onSuccess: (n) => void navigate(`/factures/${id}`, { replace: true, state: { message: `Facture émise sous le numéro ${n}.` } }),
    });
  }

  const erreur = enregistrer.error ?? emettre.error ?? supprimer.error ?? dupliquer.error ?? lever.error;
  return (
    <>
      {/* Les actions de l'en-tête (PDF, e-mail) vivent HORS du formulaire : Entrée dans le panneau e-mail n'enregistre pas la facture. */}
      <EnTetePage
        titre={facture ? "Facture brouillon" : "Nouvelle facture"}
        sousTitre="Le numéro sera attribué par la base à l'émission."
        actions={facture && <ActionsDocumentFacture facture={facture} />}
      />
      <form onSubmit={soumettre} noValidate className="flex flex-col gap-4">
        {!droitEcrire && <Alert>Lecture seule : votre rôle ne permet pas de modifier cette facture.</Alert>}
        {verrou && (
          <Alert>
            {verrou.libelle}{" "}
            {droitEcrire && (
              <BoutonConfirme
                libelle="Déverrouiller"
                question="Confirmez-vous le déverrouillage ? Si le client a déjà reçu une version, renvoyez-lui la version corrigée."
                enCours={lever.isPending}
                onConfirmer={() => lever.mutate()}
              />
            )}
          </Alert>
        )}
        {erreur && <Alert variant="erreur">{messageErreur(erreur)}</Alert>}
        {(Object.keys(erreurs).length > 0 || erreursLignes.length > 0) && <Alert variant="erreur">La facture contient des erreurs : corrigez les champs signalés.</Alert>}
        {message && <Alert variant={message.startsWith("Client introuvable") ? "erreur" : "succes"}>{message}</Alert>}
        <Card>
          <CardContent className="flex flex-col gap-4 pt-4">
            <ChampsEnteteDocument valeurs={valeurs} erreurs={erreurs} changer={changer} conducteurCourant={facture?.conducteur_id ?? null} lectureSeule={!peutEcrire} />
            <ChampsReglementFacture valeurs={valeurs} changer={changer} delai={delai} setDelai={setDelaiSaisi} echeance={echeance} lectureSeule={!peutEcrire} devisId={facture?.devis_id ?? null} />
            <SectionLieu valeurs={valeurs} changer={changer} lectureSeule={!peutEcrire} sansTelephone />
          </CardContent>
        </Card>
        <EditeurLignes lignes={lignes} onChange={setLignes} tvaDefaut={reglages.tvaDefaut} taux={reglages.tauxTva} erreurs={erreursLignes} lectureSeule={!peutEcrire} ChampReference={ChampReference} />
        <BlocTotaux lignes={lignes} remise={valeurs.remise_pourcentage} onRemise={peutEcrire ? (v) => changer("remise_pourcentage", v) : undefined} deductions={facture ? { acomptes: facture.acomptes_deduits, retenuePct: facture.retenue_garantie_pourcentage } : undefined} />
        <div className="flex flex-wrap gap-2">
          {peutEcrire && <Button type="submit" disabled={enregistrer.isPending}>{enregistrer.isPending ? "Enregistrement…" : "Enregistrer le brouillon"}</Button>}
          {facture && droitEcrire && (
            <BoutonConfirme
              libelle="Émettre la facture"
              question={
                // La réf. de commande du client est figée dès l'émission, même vide (FAC-100) : on le dit avant.
                valeurs.ref_bon_commande_client.trim()
                  ? "Émettre ? Le numéro est définitif et la facture ne sera plus modifiable."
                  : "Émettre sans réf. de bon de commande client ? Elle sera figée vide, comme tout l'en-tête."
              }
              enCours={emettre.isPending}
              onConfirmer={() => void emettreEcran()}
            />
          )}
          {facture && peutCreer && (
            <Button type="button" variant="outline" disabled={dupliquer.isPending} onClick={() => dupliquer.mutate(facture.id, { onSuccess: (id) => void navigate(`/factures/${id}`, { state: { message: "Copie créée en brouillon — elle recevra son numéro à l'émission." } }) })}>
              Dupliquer
            </Button>
          )}
          {facture && peutSupprimer && (
            <BoutonConfirme libelle="Supprimer le brouillon" question="Supprimer ce brouillon ?" enCours={supprimer.isPending} onConfirmer={() => supprimer.mutate(facture.id, { onSuccess: () => void navigate("/factures") })} />
          )}
          <Button variant="ghost" asChild><Link to="/factures">Retour à la liste</Link></Button>
        </div>
      </form>
    </>
  );
}
