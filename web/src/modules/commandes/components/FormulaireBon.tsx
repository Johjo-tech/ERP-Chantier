import { useState } from "react";
import { useNavigate } from "react-router";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { useFormulaire } from "@/lib/useFormulaire";
import { usePermission, useSession, useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import { useClients } from "@/modules/clients/hooks/useClients";
import { useDevis } from "@/modules/devis/hooks/useDevis";
import type { ChampReferenceLigne } from "@/modules/documents/components/reference";
import { depuisBase, ligneVide, type ErreurLigne, type LigneEdition } from "@/modules/documents/domain/lignes";
import type { ReglagesDocuments } from "@/modules/societes/domain/reglages";
import { EnregistrementPartiel, type Bon } from "../api/bons";
import { SavSansToutesSesPhotos } from "../api/documents";
import { estSav, lignesDepuisPreRemplissage, modeInitial, montantsSaisisParMetier, schemaSaisieBon, valeursDepuis, versLigneBase, type PreRemplissageBon, type SaisieBon, type ValeursBon } from "../domain/bon";
import { peutEcrireTerrain } from "../domain/circuit";
import { preparerEnregistrement } from "../domain/enregistrement";
import { memeMetier, metiersDuBon, metiersRetenus, montantDuMetierDansLeDevis, totauxDesChapitres } from "../domain/metiers";
import type { ModeBon } from "../domain/regles";
import { verrouBonCommande } from "../domain/verrou";
import { useBons, useCreerSav, useEnregistrerBon, useMetiersDisponibles } from "../hooks/useBons";
import { ChampZone } from "./ChampsBon";
import { ChiffrageBon } from "./ChiffrageBon";
import { MetiersConnus } from "./metiersConnus";
import { PhotosSav } from "./PhotosSav";
import { ChampPieceJointe } from "./PieceJointe";
import { ModesBon, SectionClient, SectionLieuBon, SectionNumero, SectionOrganisation } from "./SectionsBon";

interface Props {
  bon: Bon | null;
  /** Le bon d'origine quand on crée son SAV (`transformerBonCommandeEnSAV`) : le formulaire en reprend l'en-tête. */
  savDe?: Bon | null;
  prefill: PreRemplissageBon | null;
  /** Le document lu par la lecture automatique, retenu comme pièce jointe (OCR-04). */
  fichierLu: File | null;
  reglages: ReglagesDocuments;
  ChampReference?: ChampReferenceLigne | undefined;
  /** « Brouillon enregistré à 10:42 » : ce que la barre d'actions affiche après un brouillon. */
  horodatage: string | null;
  /** Après un BROUILLON d'un bon existant : la fiche relue remonte le formulaire (relecture 3, M12). */
  onBrouillon: (horodatage: string) => Promise<void>;
}

function lignesInitiales(bon: Bon | null, prefill: PreRemplissageBon | null, tva: number): LigneEdition[] {
  if (bon?.lignes.length) return bon.lignes.map(versLigneBase).map(depuisBase);
  const lues = lignesDepuisPreRemplissage(prefill, tva);
  return lues.length ? lues : [ligneVide(tva)];
}

/** Le SAV reprend l'en-tête de son bon (`transformerBonCommandeEnSAV`) : client, lieu, logement, conducteur, métier. */
function valeursDuSav(origine: Bon): ValeursBon {
  const v = valeursDepuis(origine, null);
  return { ...valeursDepuis(null, null), client_id: v.client_id, interlocuteur: v.interlocuteur, adresse_locataire: v.adresse_locataire, code_postal: v.code_postal, ville: v.ville, logement_statut: v.logement_statut, occupant: v.occupant, etage: v.etage, numero_logement: v.numero_logement, precision_commune: v.precision_commune, ancien_locataire: v.ancien_locataire, conducteur_id: v.conducteur_id, date_reception: todayISO() };
}

/**
 * Les métiers cochés : ceux du bon, plus ceux que livrent ses chapitres, moins
 * ceux qu'on a décochés (metiersDuBrouillon). Dérivés à chaque rendu : ouvrir
 * un bon ne change rien tant qu'on n'enregistre pas.
 */
function useMetiersDuFormulaire(depart: Bon | null, lignes: readonly LigneEdition[], connus: readonly string[]) {
  const [choix, setChoix] = useState<string[]>(() => (depart ? metiersDuBon(depart) : []));
  const [retires, setRetires] = useState<string[]>([]);
  const lus = metiersRetenus(choix, lignes, connus);
  const coches = lus.retenus.filter((m) => choix.some((c) => memeMetier(c, m)) || !retires.some((r) => memeMetier(r, m)));
  function changer(nouveaux: string[]) {
    setChoix(nouveaux);
    setRetires(coches.filter((c) => !nouveaux.some((n) => memeMetier(n, c))));
  }
  return { coches, origines: lus.origines, ajoutes: coches.length - choix.filter((c) => coches.some((x) => memeMetier(x, c))).length, changer };
}

/** « 📄 Lire un bon de commande » : la lecture automatique, depuis un bon neuf (la zone `ocr-zone` de l'ancien). */
function ZoneLecture() {
  const navigate = useNavigate();
  return (
    <div className="ocr-zone" style={{ margin: "-4px 0 16px", padding: "14px 16px", border: "2px dashed var(--accent-2)", borderRadius: "10px", background: "rgba(var(--accent-rgb), .06)" }}>
      <label className="btn primary" style={{ cursor: "pointer" }}>
        📄 Lire un bon de commande (PDF ou photo)
        <input type="file" accept="application/pdf,image/*,.heic,.heif" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void navigate("/commandes/lecture", { state: { fichier: f } }); }} />
      </label>
      <small style={{ display: "block", marginTop: "6px", color: "var(--text-dim)", fontSize: "11.5px" }}>Le formulaire est prérempli à partir du document — relisez et corrigez avant d&apos;enregistrer.</small>
      <div id="ocrStatut" style={{ marginTop: "8px", fontSize: "12px" }} />
    </div>
  );
}

/**
 * Les valeurs d'ouverture : la date de réception d'un bon neuf vaut aujourd'hui,
 * et le montant s'écrit comme l'attend un champ numérique (point décimal, vide
 * pour un bon neuf) — l'ancien le posait tel quel dans son `<input type=number>`.
 */
function valeursInitiales(bon: Bon | null, prefill: PreRemplissageBon | null): ValeursBon {
  const v = valeursDepuis(bon, prefill);
  const montant = bon ? String(bon.montant ?? "") : prefill?.montant != null ? String(prefill.montant).replace(",", ".") : "";
  return { ...v, montant, date_reception: v.date_reception || (bon ? "" : todayISO()) };
}

/** Le message bref de `marquerBrouillonEnregistre` : on continue la saisie. */
const DUREE_TOAST_BROUILLON_MS = 2500;

const heureCourte = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/**
 * Le formulaire d'un bon (`bonCommandeForm`) : neuf (trois modes), modifié,
 * consulté sous verrou, ou SAV. Même panneau, mêmes sections, mêmes libellés
 * que l'ancien ; la logique d'enregistrement reste celle du module
 * (`preparerEnregistrement`).
 */
export function FormulaireBon({ bon, savDe = null, prefill, fichierLu, reglages, ChampReference, horodatage, onBrouillon }: Props) {
  const navigate = useNavigate();
  const clients = useClients();
  const bons = useBons();
  const { roleEffectif } = useSession();
  const enregistrer = useEnregistrerBon(bon?.id);
  const creerSav = useCreerSav();
  const prix = useVoitLesPrix();
  const connus = useMetiersDisponibles();
  const verrou = bon ? verrouBonCommande(bon.factures) : null;
  // Sans les prix, l'éditeur réécrirait des zéros : qui ne les voit pas consulte.
  const lectureSeule = !usePermission("bons_commande", bon ? "modifier" : "creer") || !!verrou || !prix;
  const { valeurs, erreurs, changer, valider } = useFormulaire(savDe ? valeursDuSav(savDe) : valeursInitiales(bon, prefill));
  const [mode, setMode] = useState<ModeBon>(modeInitial(bon, prefill));
  const [lignes, setLignes] = useState<LigneEdition[]>(() => lignesInitiales(bon, prefill, reglages.tvaDefaut));
  const [montantsMetier, setMontantsMetier] = useState<Record<string, string>>(() => montantsSaisisParMetier(bon?.montant_par_metier));
  const [pieceJointe, setPieceJointe] = useState<File | null | undefined>(fichierLu ?? undefined);
  const [photos, setPhotos] = useState<File[]>([]);
  const [erreursLignes, setErreursLignes] = useState<ErreurLigne[]>([]);
  const [montantIllisible, setMontantIllisible] = useState(false);
  const metiers = useMetiersDuFormulaire(savDe ? { ...savDe, metiers: savDe.metier ? [savDe.metier] : [] } : bon, lignes, connus);
  const devis = useDevis(valeurs.devis_id || undefined);
  const sav = bon ? estSav(bon) : !!savDe;

  // Le devis lié propose le montant des métiers encore vides, en mots entiers sur ses chapitres (refreshBCMontantFields).
  const totauxDevis = devis.data ? totauxDesChapitres(devis.data.lignes) : null;
  const montantsAffiches: Record<string, string> = {};
  const sansChapitre: string[] = [];
  for (const m of metiers.coches) {
    const lu = totauxDevis ? montantDuMetierDansLeDevis(m, totauxDevis) : null;
    if (totauxDevis && !lu && !montantsMetier[m]) sansChapitre.push(m);
    montantsAffiches[m] = montantsMetier[m] ?? (lu ? lu.toString() : "");
  }

  function reussir(id: string, brouillon: boolean) {
    const heure = `Brouillon enregistré à ${heureCourte()}`;
    if (brouillon) {
      afficherToast("Brouillon enregistré.", "success", DUREE_TOAST_BROUILLON_MS);
      if (bon) void onBrouillon(heure);
      else void navigate(`/commandes/${id}`, { replace: true, state: { brouillon: heure } });
      return;
    }
    void navigate("/commandes");
    afficherToast(bon ? "Bon de commande modifié." : "Bon de commande créé.", "success");
  }

  function echouer(err: unknown) {
    // Le bon existe déjà : on y conduit, en disant ce qui manque, plutôt que de laisser recréer un doublon.
    if ((err instanceof EnregistrementPartiel || err instanceof SavSansToutesSesPhotos) && !bon) {
      void navigate(`/commandes/${err instanceof EnregistrementPartiel ? err.bonId : err.savId}`, { replace: true });
    }
    afficherToast(err instanceof EnregistrementPartiel || err instanceof SavSansToutesSesPhotos ? err.message : `Enregistrement refusé : ${messageErreur(err)}`);
  }

  function creerLeSav(origine: Bon, saisie: SaisieBon, brouillon: boolean) {
    const client = clients.data?.find((c) => c.id === saisie.client_id);
    const edite = { ...origine, client_id: saisie.client_id, client_nom: client?.nom ?? origine.client_nom, interlocuteur: saisie.interlocuteur, adresse: saisie.adresse_locataire, code_postal: saisie.code_postal, ville: saisie.ville, logement_statut: saisie.logement_statut, occupant: saisie.occupant, etage: saisie.etage, numero_logement: saisie.numero_logement, precision_commune: saisie.precision_commune, ancien_locataire: saisie.ancien_locataire, conducteur_id: saisie.conducteur_id, nature_travaux: saisie.nature_travaux, metier: metiers.coches[0] ?? null, metiers: metiers.coches };
    creerSav.mutate({ origine: edite, probleme: saisie.probleme_description, photos }, { onSuccess: (id) => reussir(id, brouillon), onError: echouer });
  }

  function soumettre(brouillon: boolean) {
    const saisie = valider(schemaSaisieBon);
    if (!saisie) {
      if (!valeurs.client_id) window.alert("Le nom du client est requis.");
      return;
    }
    if (savDe && !bon) return creerLeSav(savDe, saisie, brouillon);
    const client = clients.data?.find((c) => c.id === saisie.client_id);
    if (!client) return window.alert("Le nom du client est requis.");
    const p = preparerEnregistrement({ saisie, client, mode, lignes, brouillon, aujourdhui: todayISO(), metiers: metiers.coches, montantsParMetier: montantsAffiches, numeroSav: sav ? (bon?.numero_bc ?? null) : null });
    setErreursLignes(p.ok ? [] : p.erreursLignes);
    setMontantIllisible(!p.ok && p.montantIllisible);
    if (!p.ok) {
      if (p.manques.length) window.alert(p.manques.map((m) => `• ${m.libelle}`).join("\n\n"));
      else afficherToast("Le bon contient des erreurs : corrigez les champs signalés en rouge.");
      return;
    }
    enregistrer.mutate(
      { entete: p.entete, lignes: p.lignes, pieceJointe, pieceJointeActuelle: bon?.piece_jointe_chemin ?? null, photosSav: sav ? photos : [] },
      { onSuccess: (id) => reussir(id, brouillon), onError: echouer }
    );
  }

  const titre = verrou ? "Consulter le bon de commande" : sav ? (bon ? "Modifier le SAV" : "Nouveau SAV") : bon ? "Modifier le bon de commande" : "Nouveau bon de commande";
  const enCours = enregistrer.isPending || creerSav.isPending;
  const base = { valeurs, changer, erreurs, desactive: lectureSeule };
  const devisLies = (bons.data ?? []).filter((b) => b.id !== bon?.id).map((b) => b.devis_id);
  const basNumero = sav ? (
    <>
      <ChampZone id="bc_problemeDescription" className="full" libelle="Ce qui ne va pas" valeur={valeurs.probleme_description} placeholder="Décrivez le problème signalé…" desactive={lectureSeule} onChange={(v) => changer("probleme_description", v)} />
      <PhotosSav savId={bon?.id ?? null} nouvelles={photos} onChange={setPhotos} desactive={lectureSeule} />
    </>
  ) : (
    <ChampPieceJointe doc={{ chemin: bon?.piece_jointe_chemin ?? null, nom: bon?.piece_jointe_nom ?? null, mime: bon?.piece_jointe_mime ?? null }} enAttente={pieceJointe} onChange={setPieceJointe} peutDeposer={peutEcrireTerrain(roleEffectif)} lectureSeule={lectureSeule} />
  );

  return (
    <MetiersConnus.Provider value={connus}>
      <div className="form-panel form-panel-v2">
        <h3>{titre}</h3>
        {verrou && <div className="facture-verrou-banner"><span>🔒 {verrou.libelle}</span></div>}
        {!verrou && lectureSeule && <div className="facture-verrou-banner"><span>👁 Consultation : votre rôle ne permet pas de modifier ce bon de commande.</span></div>}
        {/* Sous verrou, l'ancien grisait tout le formulaire et en coupait les gestes. */}
        <div style={verrou ? { pointerEvents: "none", opacity: 0.55 } : undefined}>
          {!sav && !bon && <ZoneLecture />}
          {!sav && !bon && <ModesBon mode={mode} onChange={setMode} />}
          <SectionClient {...base} clients={clients.data ?? []} sav={sav} devisLies={devisLies} />
          <SectionNumero {...base} mode={mode} sav={sav} bas={basNumero} />
          <SectionLieuBon {...base} />
          <SectionOrganisation valeurs={valeurs} changer={changer} desactive={lectureSeule} metiers={{ disponibles: connus, coches: metiers.coches, origines: metiers.origines, ajoutes: metiers.ajoutes, onChange: metiers.changer, desactive: lectureSeule }} />
          <ChiffrageBon
            prix={prix}
            lignes={lignes}
            onLignes={setLignes}
            lignesLues={bon?.lignes ?? []}
            tvaDefaut={reglages.tvaDefaut}
            taux={reglages.tauxTva}
            erreursLignes={erreursLignes}
            ChampReference={ChampReference}
            montant={valeurs.montant}
            onMontant={(v) => changer("montant", v)}
            metiers={metiers.coches}
            montantsParMetier={montantsAffiches}
            onMontantMetier={(m, v) => setMontantsMetier((avant) => ({ ...avant, [m]: v }))}
            sansChapitre={sansChapitre}
            erreur={montantIllisible ? "Montant illisible." : undefined}
            desactive={lectureSeule}
          />
        </div>
        <div className="form-actions-sticky">
          {lectureSeule ? (
            <button type="button" className="btn ghost" onClick={() => void navigate("/commandes")}>Fermer</button>
          ) : (
            <>
              <button type="button" className="btn primary" disabled={enCours} onClick={() => soumettre(false)}>Enregistrer{sav ? " le SAV" : " le bon de commande"}</button>
              <button type="button" className="btn" disabled={enCours} title="Garder la saisie en cours sans refermer, et sans exiger l'adresse ni les lignes" onClick={() => soumettre(true)}>💾 Enregistrer le brouillon</button>
              <button type="button" className="btn ghost" onClick={() => void navigate("/commandes")}>Annuler</button>
              <span id="brouillonHorodatage" className="card-sub" style={{ marginLeft: "auto", alignSelf: "center" }} role="status">{horodatage}</span>
            </>
          )}
        </div>
      </div>
    </MetiersConnus.Provider>
  );
}
