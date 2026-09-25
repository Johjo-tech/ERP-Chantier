import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { useFormulaire } from "@/lib/useFormulaire";
import { usePermission, useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import { useClients } from "@/modules/clients/hooks/useClients";
import { ChampsEnteteDocument } from "@/modules/documents/components/ChampsEnteteDocument";
import { EditeurLignes } from "@/modules/documents/components/EditeurLignes";
import type { ChampReferenceLigne } from "@/modules/documents/components/reference";
import { SectionLieu } from "@/modules/documents/components/SectionLieu";
import { depuisBase, ligneVide, type ErreurLigne, type LigneEdition } from "@/modules/documents/domain/lignes";
import type { ReglagesDocuments } from "@/modules/societes/domain/reglages";
import { EnregistrementPartiel, type Bon } from "../api/bons";
import { estSav, lignesDepuisPreRemplissage, modeInitial, schemaSaisieBon, valeursDepuis, versLigneBase, type PreRemplissageBon } from "../domain/bon";
import { preparerEnregistrement } from "../domain/enregistrement";
import type { Manque, ModeBon } from "../domain/regles";
import { verrouBonCommande } from "../domain/verrou";
import { useEnregistrerBon } from "../hooks/useBons";
import { ActionsBon } from "./ActionsBon";
import { BadgeEtape } from "./BadgeEtape";
import { BlocMontantBon } from "./BlocMontantBon";
import { LignesSansPrix } from "./LignesSansPrix";
import { SectionBon, SelecteurMode } from "./SectionBon";

interface Props {
  bon: Bon | null;
  prefill: PreRemplissageBon | null;
  reglages: ReglagesDocuments;
  ChampReference?: ChampReferenceLigne | undefined;
  messageInitial: { texte: string; alerte: boolean } | null;
}

function lignesInitiales(bon: Bon | null, prefill: PreRemplissageBon | null, tva: number): LigneEdition[] {
  if (bon?.lignes.length) return bon.lignes.map(versLigneBase).map(depuisBase);
  const lues = lignesDepuisPreRemplissage(prefill, tva);
  return lues.length ? lues : [ligneVide(tva)];
}

export function FormulaireBon({ bon, prefill, reglages, ChampReference, messageInitial }: Props) {
  const navigate = useNavigate();
  const clients = useClients();
  const enregistrer = useEnregistrerBon(bon?.id);
  const prix = useVoitLesPrix();
  const verrou = bon ? verrouBonCommande(bon.factures) : null;
  // Sans les prix, l'éditeur réécrirait des zéros : qui ne les voit pas consulte.
  const lectureSeule = !usePermission("bons_commande", bon ? "modifier" : "creer") || !!verrou || !prix;
  const { valeurs, erreurs, changer, valider } = useFormulaire(valeursDepuis(bon, prefill));
  const [mode, setMode] = useState<ModeBon>(modeInitial(bon));
  const [lignes, setLignes] = useState<LigneEdition[]>(() => lignesInitiales(bon, prefill, reglages.tvaDefaut));
  const [erreursLignes, setErreursLignes] = useState<ErreurLigne[]>([]);
  const [manques, setManques] = useState<Manque[]>([]);
  const [montantIllisible, setMontantIllisible] = useState(false);
  const [message, setMessage] = useState<string | null>(messageInitial?.texte ?? null);
  const [alerte, setAlerte] = useState(messageInitial?.alerte ?? false);
  const sav = bon ? estSav(bon) : false;

  function signaler(texte: string | null, enAlerte = false) {
    setMessage(texte);
    setAlerte(enAlerte);
  }

  function soumettre(brouillon: boolean) {
    signaler(null);
    const saisie = valider(schemaSaisieBon);
    const client = clients.data?.find((c) => c.id === saisie?.client_id);
    if (!saisie || !client) return;
    const p = preparerEnregistrement({ saisie, client, mode, lignes, brouillon, aujourdhui: todayISO() });
    setErreursLignes(p.ok ? [] : p.erreursLignes);
    setManques(p.ok ? [] : p.manques);
    setMontantIllisible(!p.ok && p.montantIllisible);
    if (!p.ok) return;
    const reussite = brouillon ? "Brouillon enregistré." : "Bon de commande enregistré.";
    enregistrer.mutate(
      { entete: p.entete, lignes: p.lignes },
      {
        onSuccess: (id) => {
          signaler(reussite);
          if (!bon) void navigate(`/commandes/${id}`, { replace: true, state: { message: reussite } });
        },
        onError: (err) => {
          // La fiche remonte le formulaire : sans le message porté par la navigation, l'échec des lignes serait muet.
          if (err instanceof EnregistrementPartiel && !bon) void navigate(`/commandes/${err.bonId}`, { replace: true, state: { message: messageErreur(err), alerte: true } });
        },
      }
    );
  }

  /**
   * « BC reçu » écrit hors du formulaire : sans reporter le numéro dans la
   * saisie, le prochain « Enregistrer » remettrait la sentinelle d'attente
   * par-dessus (relecture 3, B1). Les modifications en cours sont gardées.
   */
  function bcRecu(numero: string) {
    setMode("normal");
    changer("numero_bc", numero);
    signaler(`Bon de commande n° ${numero} enregistré — ce bon n'est plus en attente, et le numéro partira sur sa facture.`);
  }

  const titre = bon ? `${sav ? "SAV" : "Bon de commande"} ${bon.numero_interne ?? ""}`.trim() : "Nouveau bon de commande";
  const enErreur = Object.keys(erreurs).length > 0 || erreursLignes.length > 0 || montantIllisible;
  // Les actions restent HORS du <form> : Entrée dans « N° du BC reçu » enregistrait sinon le bon entier (relecture 3, I1).
  return (
    <div className="flex flex-col gap-4">
    <EnTetePage titre={titre} sousTitre={bon && <BadgeEtape bon={bon} />} actions={bon && <ActionsBon bon={bon} onBcRecu={bcRecu} onErreur={(m) => signaler(m, true)} />} />
    <form onSubmit={(e) => { e.preventDefault(); soumettre(false); }} noValidate className="flex flex-col gap-4">
      {verrou && <Alert>{verrou.libelle}</Alert>}
      {!verrou && lectureSeule && <Alert>Consultation : votre rôle ne permet pas de modifier ce bon de commande.</Alert>}
      {enregistrer.isError && <Alert variant="erreur">{messageErreur(enregistrer.error)}</Alert>}
      {enErreur && <Alert variant="erreur">Le bon contient des erreurs : corrigez les champs signalés en rouge.</Alert>}
      {manques.length > 0 && (
        <Alert variant="erreur">
          <ul className="list-disc pl-4">{manques.map((m) => <li key={m.code}>{m.libelle}</li>)}</ul>
        </Alert>
      )}
      {message && <Alert variant={alerte ? "erreur" : "succes"}>{message}</Alert>}
      {!bon && <SelecteurMode mode={mode} onChange={setMode} />}
      <Card>
        <CardContent className="flex flex-col gap-4 pt-4">
          <ChampsEnteteDocument
            valeurs={valeurs}
            erreurs={erreurs}
            changer={(c, v) => c !== "date" && c !== "chantier_id" && changer(c, v)}
            conducteurCourant={bon?.conducteur_id ?? null}
            lectureSeule={lectureSeule}
          />
          <SectionBon valeurs={valeurs} erreurs={erreurs} changer={changer} mode={mode} sav={sav} lectureSeule={lectureSeule} />
          <SectionLieu valeurs={valeurs} changer={changer} lectureSeule={lectureSeule} sansTelephone />
        </CardContent>
      </Card>
      <h2 className="text-base font-semibold">Travaux à réaliser</h2>
      {prix ? (
        <>
          <EditeurLignes lignes={lignes} onChange={setLignes} tvaDefaut={reglages.tvaDefaut} unites={reglages.unites} taux={reglages.tauxTva} erreurs={erreursLignes} lectureSeule={lectureSeule} ChampReference={ChampReference} />
          <BlocMontantBon lignes={lignes} montant={valeurs.montant} onMontant={(v) => changer("montant", v)} erreur={montantIllisible ? "Montant illisible." : undefined} lectureSeule={lectureSeule} />
        </>
      ) : (
        <LignesSansPrix lignes={bon?.lignes ?? []} />
      )}
      <div className="flex flex-wrap gap-2">
        {!lectureSeule && (
          <>
            <Button type="submit" disabled={enregistrer.isPending}>{enregistrer.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
            <Button variant="outline" disabled={enregistrer.isPending} onClick={() => soumettre(true)} title="Sans exiger l'adresse ni les lignes">
              Enregistrer le brouillon
            </Button>
          </>
        )}
        <Button variant="ghost" asChild><Link to="/commandes">Retour à la liste</Link></Button>
      </div>
    </form>
    </div>
  );
}
