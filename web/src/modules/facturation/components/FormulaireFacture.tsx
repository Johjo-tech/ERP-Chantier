import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
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
import { dateEcheance, delaiHorsPlafond, delaiPaiementRetenu, libelleDelaiPaiement, MODES_REGLEMENT } from "@/modules/clients/domain/delais";
import { useClients } from "@/modules/clients/hooks/useClients";
import { BlocTotaux } from "@/modules/documents/components/BlocTotaux";
import { ChampsEnteteDocument } from "@/modules/documents/components/ChampsEnteteDocument";
import { EditeurLignes } from "@/modules/documents/components/EditeurLignes";
import { SectionLieu } from "@/modules/documents/components/SectionLieu";
import { depuisBase, ligneVide, lignesPourEnregistrement, type ErreurLigne, type LigneEdition } from "@/modules/documents/domain/lignes";
import type { ReglagesDocuments } from "@/modules/societes/domain/reglages";
import { FacturePartielle } from "../api/factures";
import { enteteAEnregistrer, schemaSaisieFacture, valeursDepuis, type Facture } from "../domain/facture";
import { useEmettre, useEnregistrerFacture, useSupprimerBrouillon } from "../hooks/useFactures";

export function FormulaireFacture({ facture, reglages }: { facture: Facture | null; reglages: ReglagesDocuments }) {
  const navigate = useNavigate();
  const location = useLocation();
  const clients = useClients();
  const enregistrer = useEnregistrerFacture(facture?.id);
  const emettre = useEmettre();
  const supprimer = useSupprimerBrouillon();
  const peutEcrire = usePermission("factures", facture ? "modifier" : "creer");
  const peutSupprimer = usePermission("factures", "supprimer");
  const { valeurs, erreurs, changer, valider } = useFormulaire(valeursDepuis(facture, todayISO()));
  const [lignes, setLignes] = useState<LigneEdition[]>(() => (facture?.lignes.length ? facture.lignes.map(depuisBase) : [ligneVide(reglages.tvaDefaut)]));
  const [erreursLignes, setErreursLignes] = useState<ErreurLigne[]>([]);
  const [message, setMessage] = useState<string | null>(() => (location.state as { message?: string } | null)?.message ?? null);

  const client = clients.data?.find((c) => c.id === valeurs.client_id) ?? null;
  // Le délai figé sur la facture l'emporte ; à défaut celui du client, puis de la société.
  const delai = facture?.delai_paiement_jours != null
    ? { jours: facture.delai_paiement_jours, mode: facture.delai_paiement_mode ?? "net" }
    : delaiPaiementRetenu(client, { delai_paiement_jours: reglages.delaiPaiementJours, delai_paiement_mode: reglages.modeDelaiPaiement });
  const echeanceCalculee = dateEcheance(valeurs.date, delai);
  const echeance = valeurs.echeance_manuelle === "oui" ? valeurs.echeance : echeanceCalculee;

  function soumettre(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const saisie = valider(schemaSaisieFacture);
    const remise = schemaNombreFr.safeParse(valeurs.remise_pourcentage);
    const l = lignesPourEnregistrement(lignes);
    setErreursLignes(l.erreurs);
    if (!saisie || !remise.success || l.erreurs.length || !client) return;
    const entete = enteteAEnregistrer(saisie, client, Math.min(100, Math.max(0, remise.data)), delai, libelleDelaiPaiement(delai), echeance || null);
    enregistrer.mutate(
      { entete, lignes: l.lignes },
      {
        onSuccess: (id) => {
          setMessage("Brouillon enregistré.");
          if (!facture) void navigate(`/factures/${id}`, { replace: true, state: { message: "Brouillon enregistré." } });
        },
        onError: (err) => {
          if (err instanceof FacturePartielle && !facture) void navigate(`/factures/${err.factureId}`, { replace: true });
        },
      }
    );
  }

  const erreur = enregistrer.error ?? emettre.error ?? supprimer.error;
  const hors = delaiHorsPlafond(delai);
  return (
    <form onSubmit={soumettre} noValidate className="flex flex-col gap-4">
      <EnTetePage titre={facture ? "Facture brouillon" : "Nouvelle facture"} sousTitre="Le numéro sera attribué par la base à l'émission." />
      {!peutEcrire && <Alert>Lecture seule : votre rôle ne permet pas de modifier cette facture.</Alert>}
      {erreur && <Alert variant="erreur">{messageErreur(erreur)}</Alert>}
      {(Object.keys(erreurs).length > 0 || erreursLignes.length > 0) && <Alert variant="erreur">La facture contient des erreurs : corrigez les champs signalés.</Alert>}
      {message && <Alert variant="succes">{message}</Alert>}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-4">
          <ChampsEnteteDocument valeurs={valeurs} erreurs={erreurs} changer={changer} conducteurCourant={facture?.conducteur_id ?? null} lectureSeule={!peutEcrire} />
          <div className="grid gap-3 sm:grid-cols-3">
            <ChampTexte
              libelle="Échéance"
              type="date"
              valeur={echeance}
              desactive={!peutEcrire}
              aide={valeurs.echeance_manuelle === "oui" ? "Saisie à la main." : `Calculée : ${libelleDelaiPaiement(delai)}.`}
              onChange={(v) => {
                changer("echeance", v);
                changer("echeance_manuelle", v ? "oui" : "non");
              }}
            />
            <ChampChoix
              libelle="Mode de paiement"
              valeur={valeurs.mode_paiement}
              desactive={!peutEcrire}
              onChange={(v) => changer("mode_paiement", v)}
              options={[{ valeur: "", libelle: "Celui du client (virement par défaut)" }, ...MODES_REGLEMENT.map((m) => ({ valeur: m.code, libelle: m.libelle }))]}
            />
            <ChampTexte libelle="Réf. bon de commande client" valeur={valeurs.ref_bon_commande_client} desactive={!peutEcrire} onChange={(v) => changer("ref_bon_commande_client", v)} />
            <ChampTexte libelle="Réf. marché" valeur={valeurs.ref_marche} desactive={!peutEcrire} onChange={(v) => changer("ref_marche", v)} />
            <ChampTexte libelle="Fin d'exécution" type="date" valeur={valeurs.date_fin_execution} desactive={!peutEcrire} onChange={(v) => changer("date_fin_execution", v)} />
          </div>
          {hors && <Alert>{hors} Signalé, jamais bloqué.</Alert>}
          <SectionLieu valeurs={valeurs} changer={changer} lectureSeule={!peutEcrire} sansTelephone />
        </CardContent>
      </Card>
      <EditeurLignes lignes={lignes} onChange={setLignes} tvaDefaut={reglages.tvaDefaut} unites={reglages.unites} taux={reglages.tauxTva} erreurs={erreursLignes} lectureSeule={!peutEcrire} />
      <BlocTotaux lignes={lignes} remise={valeurs.remise_pourcentage} onRemise={peutEcrire ? (v) => changer("remise_pourcentage", v) : undefined} deductions={facture ? { acomptes: facture.acomptes_deduits, retenuePct: facture.retenue_garantie_pourcentage } : undefined} />
      <div className="flex flex-wrap gap-2">
        {peutEcrire && <Button type="submit" disabled={enregistrer.isPending}>{enregistrer.isPending ? "Enregistrement…" : "Enregistrer le brouillon"}</Button>}
        {facture && peutEcrire && (
          <BoutonConfirme
            libelle="Émettre la facture"
            question="Émettre ? Le numéro est définitif et la facture ne sera plus modifiable."
            enCours={emettre.isPending}
            onConfirmer={() =>
              emettre.mutate(facture.id, {
                // La page bascule sur la vue « émise » : le message voyage avec la navigation.
                onSuccess: (n) => void navigate(`/factures/${facture.id}`, { replace: true, state: { message: `Facture émise sous le numéro ${n}.` } }),
              })
            }
          />
        )}
        {facture && peutSupprimer && (
          <BoutonConfirme libelle="Supprimer le brouillon" question="Supprimer ce brouillon ?" enCours={supprimer.isPending} onConfirmer={() => supprimer.mutate(facture.id, { onSuccess: () => void navigate("/factures") })} />
        )}
        <Button variant="ghost" asChild><Link to="/factures">Retour à la liste</Link></Button>
      </div>
    </form>
  );
}
