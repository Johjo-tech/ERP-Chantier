import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ChampZone } from "@/components/formulaire/Champ";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { useFormulaire } from "@/lib/useFormulaire";
import { usePermission, useSession, useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import { useClients } from "@/modules/clients/hooks/useClients";
import { useDevis } from "@/modules/devis/hooks/useDevis";
import { ChampsEnteteDocument } from "@/modules/documents/components/ChampsEnteteDocument";
import { EditeurLignes } from "@/modules/documents/components/EditeurLignes";
import type { ChampReferenceLigne } from "@/modules/documents/components/reference";
import { SectionLieu } from "@/modules/documents/components/SectionLieu";
import { depuisBase, ligneVide, type ErreurLigne, type LigneEdition } from "@/modules/documents/domain/lignes";
import type { ReglagesDocuments } from "@/modules/societes/domain/reglages";
import { EnregistrementPartiel, type Bon } from "../api/bons";
import { estSav, lignesDepuisPreRemplissage, modeInitial, montantsSaisisParMetier, schemaSaisieBon, valeursDepuis, versLigneBase, type PreRemplissageBon } from "../domain/bon";
import { peutEcrireTerrain } from "../domain/circuit";
import { preparerEnregistrement } from "../domain/enregistrement";
import { memeMetier, metiersDuBon, metiersRetenus, montantDuMetierDansLeDevis, totauxDesChapitres } from "../domain/metiers";
import type { Manque, ModeBon } from "../domain/regles";
import { verrouBonCommande } from "../domain/verrou";
import { useEnregistrerBon, useMetiersDisponibles } from "../hooks/useBons";
import { ActionsBon } from "./ActionsBon";
import { BadgeEtape } from "./BadgeEtape";
import { BlocMontantBon } from "./BlocMontantBon";
import { ChampMetierChapitre } from "./ChampMetierChapitre";
import { MetiersConnus } from "./metiersConnus";
import { LignesSansPrix } from "./LignesSansPrix";
import { ChampPieceJointe } from "./PieceJointe";
import { SectionBon, SelecteurMode } from "./SectionBon";
import { SectionDevisFacturation } from "./SectionDevisFacturation";
import { SectionMetiers } from "./SectionMetiers";

interface Props {
  bon: Bon | null;
  prefill: PreRemplissageBon | null;
  /** Le document lu par la lecture automatique, retenu comme pièce jointe (OCR-04). */
  fichierLu: File | null;
  reglages: ReglagesDocuments;
  ChampReference?: ChampReferenceLigne | undefined;
  messageInitial: { texte: string; alerte: boolean } | null;
  /** Après un enregistrement réussi d'un bon existant : la fiche relue remonte le formulaire (relecture 3, M12). */
  onEnregistre: (message: string) => void;
}

function lignesInitiales(bon: Bon | null, prefill: PreRemplissageBon | null, tva: number): LigneEdition[] {
  if (bon?.lignes.length) return bon.lignes.map(versLigneBase).map(depuisBase);
  const lues = lignesDepuisPreRemplissage(prefill, tva);
  return lues.length ? lues : [ligneVide(tva)];
}

/**
 * Les métiers cochés : ceux du bon, plus ceux que livrent ses chapitres, moins
 * ceux qu'on a décochés (metiersDuBrouillon). Dérivés à chaque rendu : ouvrir
 * un bon ne change rien tant qu'on n'enregistre pas.
 */
function useMetiersDuFormulaire(bon: Bon | null, lignes: readonly LigneEdition[], connus: readonly string[]) {
  const [choix, setChoix] = useState<string[]>(() => (bon ? metiersDuBon(bon) : []));
  const [retires, setRetires] = useState<string[]>([]);
  const lus = metiersRetenus(choix, lignes, connus);
  const coches = lus.retenus.filter((m) => choix.some((c) => memeMetier(c, m)) || !retires.some((r) => memeMetier(r, m)));
  function changer(nouveaux: string[]) {
    setChoix(nouveaux);
    setRetires(coches.filter((c) => !nouveaux.some((n) => memeMetier(n, c))));
  }
  return { coches, origines: lus.origines, ajoutes: coches.length - choix.filter((c) => coches.some((x) => memeMetier(x, c))).length, changer };
}

export function FormulaireBon({ bon, prefill, fichierLu, reglages, ChampReference, messageInitial, onEnregistre }: Props) {
  const navigate = useNavigate();
  const clients = useClients();
  const { roleEffectif } = useSession();
  const enregistrer = useEnregistrerBon(bon?.id);
  const prix = useVoitLesPrix();
  const connus = useMetiersDisponibles();
  const verrou = bon ? verrouBonCommande(bon.factures) : null;
  // Sans les prix, l'éditeur réécrirait des zéros : qui ne les voit pas consulte.
  const lectureSeule = !usePermission("bons_commande", bon ? "modifier" : "creer") || !!verrou || !prix;
  const { valeurs, erreurs, changer, valider } = useFormulaire(valeursDepuis(bon, prefill));
  const [mode, setMode] = useState<ModeBon>(modeInitial(bon, prefill));
  const [lignes, setLignes] = useState<LigneEdition[]>(() => lignesInitiales(bon, prefill, reglages.tvaDefaut));
  const [montantsMetier, setMontantsMetier] = useState<Record<string, string>>(() => montantsSaisisParMetier(bon?.montant_par_metier));
  const [pieceJointe, setPieceJointe] = useState<File | null | undefined>(fichierLu ?? undefined);
  const [erreursLignes, setErreursLignes] = useState<ErreurLigne[]>([]);
  const [manques, setManques] = useState<Manque[]>([]);
  const [montantIllisible, setMontantIllisible] = useState(false);
  const [message, setMessage] = useState<string | null>(messageInitial?.texte ?? null);
  const [alerte, setAlerte] = useState(messageInitial?.alerte ?? false);
  const metiers = useMetiersDuFormulaire(bon, lignes, connus);
  const devis = useDevis(valeurs.devis_id || undefined);
  const sav = bon ? estSav(bon) : false;

  // Le devis lié propose le montant des métiers encore vides, en mots entiers sur ses chapitres (refreshBCMontantFields).
  const totauxDevis = devis.data ? totauxDesChapitres(devis.data.lignes) : null;
  const montantsAffiches: Record<string, string> = {};
  const sansChapitre: string[] = [];
  for (const m of metiers.coches) {
    const lu = totauxDevis ? montantDuMetierDansLeDevis(m, totauxDevis) : null;
    if (totauxDevis && !lu && !montantsMetier[m]) sansChapitre.push(m);
    montantsAffiches[m] = montantsMetier[m] ?? (lu ? lu.toString().replace(".", ",") : "");
  }

  function signaler(texte: string | null, enAlerte = false) {
    setMessage(texte);
    setAlerte(enAlerte);
  }

  function soumettre(brouillon: boolean) {
    signaler(null);
    const saisie = valider(schemaSaisieBon);
    const client = clients.data?.find((c) => c.id === saisie?.client_id);
    if (!saisie || !client) return;
    const p = preparerEnregistrement({ saisie, client, mode, lignes, brouillon, aujourdhui: todayISO(), metiers: metiers.coches, montantsParMetier: montantsAffiches, numeroSav: sav ? bon?.numero_bc ?? null : null });
    setErreursLignes(p.ok ? [] : p.erreursLignes);
    setManques(p.ok ? [] : p.manques);
    setMontantIllisible(!p.ok && p.montantIllisible);
    if (!p.ok) return;
    const reussite = brouillon ? "Brouillon enregistré." : "Bon de commande enregistré.";
    enregistrer.mutate(
      { entete: p.entete, lignes: p.lignes, pieceJointe, pieceJointeActuelle: bon?.piece_jointe_chemin ?? null },
      {
        onSuccess: (id) => {
          if (bon) onEnregistre(reussite);
          else void navigate(`/commandes/${id}`, { replace: true, state: { message: reussite } });
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
    <MetiersConnus.Provider value={connus}>
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
              <ChampsEnteteDocument valeurs={valeurs} erreurs={erreurs} changer={(c, v) => c !== "date" && c !== "chantier_id" && changer(c, v)} conducteurCourant={bon?.conducteur_id ?? null} lectureSeule={lectureSeule} />
              {!sav && <SectionDevisFacturation valeurs={valeurs} changer={changer} lectureSeule={lectureSeule} />}
              <SectionBon valeurs={valeurs} erreurs={erreurs} changer={changer} mode={mode} sav={sav} lectureSeule={lectureSeule} />
              {sav && <ChampZone libelle="Ce qui ne va pas" valeur={valeurs.probleme_description} onChange={(v) => changer("probleme_description", v)} desactive={lectureSeule} />}
              {!sav && <ChampPieceJointe doc={{ chemin: bon?.piece_jointe_chemin ?? null, nom: bon?.piece_jointe_nom ?? null, mime: bon?.piece_jointe_mime ?? null }} enAttente={pieceJointe} onChange={setPieceJointe} peutDeposer={peutEcrireTerrain(roleEffectif)} lectureSeule={lectureSeule} />}
              <SectionLieu valeurs={valeurs} changer={changer} lectureSeule={lectureSeule} sansTelephone />
              <SectionMetiers disponibles={connus} coches={metiers.coches} origines={metiers.origines} ajoutes={metiers.ajoutes} onChange={metiers.changer} lectureSeule={lectureSeule} />
            </CardContent>
          </Card>
          <h2 className="text-base font-semibold">Travaux à réaliser</h2>
          {prix ? (
            <>
              <EditeurLignes lignes={lignes} onChange={setLignes} tvaDefaut={reglages.tvaDefaut} unites={reglages.unites} taux={reglages.tauxTva} erreurs={erreursLignes} lectureSeule={lectureSeule} ChampReference={ChampReference} ChampMetier={ChampMetierChapitre} />
              <BlocMontantBon
                lignes={lignes}
                montant={valeurs.montant}
                onMontant={(v) => changer("montant", v)}
                metiers={metiers.coches}
                montantsParMetier={montantsAffiches}
                onMontantMetier={(m, v) => setMontantsMetier((avant) => ({ ...avant, [m]: v }))}
                sansChapitre={sansChapitre}
                erreur={montantIllisible ? "Montant illisible." : undefined}
                lectureSeule={lectureSeule}
              />
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
    </MetiersConnus.Provider>
  );
}
