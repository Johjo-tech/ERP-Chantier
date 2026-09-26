import { useState } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { useFiltresAdresse } from "@/lib/useFiltresAdresse";
import { usePermission, useSession, useSocieteActive, useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import type { DonneesPlanning } from "../api/planning";
import { ajouterJours, lundiDe } from "../domain/calendrier";
import type { CartePlanning } from "../domain/cartes";
import { cartesDuCalendrier, enAttente, FILTRES_VIDES, nonPlanifiees, semaineDuResultat, type Affectation, type FiltresPlanning, type VuePlanning } from "../domain/filtres";
import { affectationConnue, planAjouterDate, planPoser, type AffectationChoisie, type Plan } from "../domain/planification";
import { HEURE_DEFAUT } from "../domain/taches";
import { useImpressionPlanning } from "../hooks/useImpressionPlanning";
import { useAppliquerPlan, useContacts, usePlanning } from "../hooks/usePlanning";
import { Calendrier } from "./Calendrier";
import { ColonneNonPlanifies } from "./ColonneNonPlanifies";
import { ContextePlanning, usePlanningContexte, type ValeurPlanning } from "./contexte";
import { EnAttente } from "./EnAttente";
import { FicheIntervention } from "./FicheIntervention";
import { MaJournee } from "./MaJournee";
import { ModaleAffectation, ModaleDateSupplementaire, ModaleRappel } from "./Modales";

const SEMAINE = 7;

/** Les sous-onglets de l'ancien écran (`renderPlanning`) : le technicien n'a que le sien, le sous-traitant « Mon planning ». */
function ongletsDu(role: string | null): { vue: VuePlanning; libelle: string }[] {
  if (role === "technicien") return [{ vue: "technicien", libelle: "Planning Technicien" }];
  return [
    { vue: "technicien", libelle: "Planning Technicien" },
    { vue: "sous_traitant", libelle: "Planning Sous-traitant" },
    { vue: "attente", libelle: "En attente technicien" },
    { vue: "attente_st", libelle: "En attente sous-traitant" },
  ];
}

interface Barre {
  vue: VuePlanning;
  filtres: FiltresPlanning;
  onFiltres: (f: FiltresPlanning) => void;
  onRecherche: (texte: string) => void;
  premierLundi: string;
  onSemaine: (lundi: string) => void;
  onImprimer: () => void;
}

/** La tête de l'écran : titre et recherche, puis équipe, métier, semaines, impression (PLN-02, PLN-11). */
function TetePlanning({ vue, filtres, onFiltres, onRecherche, premierLundi, onSemaine, onImprimer }: Barre) {
  const { donnees, role } = usePlanningContexte();
  const st = vue === "sous_traitant";
  const liste = st ? donnees.sousTraitants : donnees.equipes;
  const metiers = donnees.metiers.map((m) => m.libelle).sort((a, b) => a.localeCompare(b));
  const choisirAffecte = (id: string) => {
    // Une équipe d'un seul métier fixe aussi le filtre métier (`filterPlanningAssignee`).
    const choisie = liste.find((x) => x.id === id);
    const metier = choisie ? (choisie.metiers.length === 1 ? (choisie.metiers[0] ?? "") : "") : filtres.metier;
    onFiltres({ ...filtres, affecte: id, metier });
  };
  const affecte = role === "sous_traitant" ? (donnees.monSousTraitantId ?? "") : filtres.affecte;
  return (
    <div className="page-head">
      <div style={{ display: "flex", alignItems: "center", gap: "280px" }}>
        <h1>Planning</h1>
        <input type="text" id="planningSearchInput" aria-label="Rechercher" style={{ width: "220px" }} value={filtres.recherche} placeholder="Rechercher : client, n° BC, adresse…" onChange={(e) => onRecherche(e.target.value)} />
      </div>
      {vue !== "attente" && vue !== "attente_st" && (
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginLeft: "auto" }}>
          <select aria-label={st ? "Sous-traitant" : "Équipe"} style={{ width: "auto", minWidth: "170px" }} value={affecte} onChange={(e) => role !== "sous_traitant" && choisirAffecte(e.target.value)}>
            <option value="">{st ? "Tous les sous-traitants" : "Toutes les équipes"}</option>
            {liste.map((x) => (
              <option key={x.id} value={x.id}>{x.nom}</option>
            ))}
          </select>
          <select aria-label="Métier" style={{ width: "auto", minWidth: "160px" }} value={filtres.metier} onChange={(e) => onFiltres({ ...filtres, metier: e.target.value })}>
            <option value="">Tous les métiers</option>
            {metiers.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button type="button" className="btn small" onClick={() => onSemaine(ajouterJours(premierLundi, -SEMAINE))} title="Semaine précédente">←</button>
          <input type="date" aria-label="Aller à la semaine de cette date" style={{ width: "auto" }} value={premierLundi} onChange={(e) => e.target.value && onSemaine(lundiDe(e.target.value))} title="Aller à la semaine de cette date" />
          <button type="button" className="btn small" onClick={() => onSemaine(ajouterJours(premierLundi, SEMAINE))} title="Semaine suivante">→</button>
          <button type="button" className="btn small" onClick={onImprimer} title="Imprimer le planning de cette semaine">🖨️ Imprimer</button>
        </div>
      )}
    </div>
  );
}

type Modale = { type: "pose"; carte: CartePlanning; jour: string; heure: string } | { type: "date"; id: string } | { type: "rappel"; bcId: string };

function Contenu({ donnees, cartes }: { donnees: DonneesPlanning; cartes: CartePlanning[] }) {
  const { roleEffectif: role } = useSession();
  const societe = useSocieteActive();
  const planningModifiable = usePermission("planning", "modifier");
  const peutContacter = usePermission("bons_commande", "modifier");
  // Le rendez-vous s'écrit sur le bon : il faut les deux droits.
  const peutPlanifier = planningModifiable && peutContacter;
  const voitPrix = useVoitLesPrix();
  const [choix, setChoix] = useState<VuePlanning>("technicien");
  const vue: VuePlanning = role === "technicien" ? "technicien" : role === "sous_traitant" ? "sous_traitant" : choix;
  const [premierLundi, setPremierLundi] = useState(lundiDe(todayISO()));
  // Les filtres vivent dans l'adresse : une tuile ouvre `/planning?conducteur=…` déjà filtré (D-CLI-10).
  const { filtres, changer: setFiltres } = useFiltresAdresse(FILTRES_VIDES);
  const [glissee, setGlissee] = useState<CartePlanning | null>(null);
  const [fiche, setFiche] = useState<{ id: string; jour: string | null } | null>(null);
  const [modale, setModale] = useState<Modale | null>(null);
  const appliquerPlan = useAppliquerPlan();
  const { rappel } = useContacts();
  const affectation: Affectation = vue === "sous_traitant" || vue === "attente_st" ? "sous_traitant" : "equipe";
  // Le sous-traitant ne voit que SES cartes au calendrier.
  const filtresEffectifs = role === "sous_traitant" ? { ...filtres, affecte: donnees.monSousTraitantId ?? "—" } : filtres;
  const colonne = role !== "technicien" && role !== "sous_traitant";

  const signaler = (texte: string, erreur?: unknown) => (erreur ? afficherToast(messageErreur(erreur)) : texte && afficherToast(texte, "success"));
  const appliquer = (carte: CartePlanning, calcul: () => Plan, succes?: string) => {
    let plan: Plan;
    try {
      plan = calcul();
    } catch (e) {
      signaler("", e);
      return;
    }
    if (!plan.bon && !plan.taches.length) return;
    appliquerPlan.mutate({ bcId: carte.bcId, plan }, { onSuccess: () => succes && signaler(succes), onError: (e) => signaler("", e) });
  };
  const poserAvec = (carte: CartePlanning, jour: string, heure: string, a: AffectationChoisie | null) => appliquer(carte, () => planPoser(carte, jour, heure, a));
  const poser = (carte: CartePlanning, jour: string, heure: string) => {
    const choisie = filtres.affecte ? affectationConnue({ ...carte, equipeId: filtres.affecte, sousTraitantId: filtres.affecte }, affectation, donnees) : affectationConnue(carte, affectation, donnees);
    if (choisie) poserAvec(carte, jour, heure, choisie);
    else setModale({ type: "pose", carte, jour, heure });
  };
  const valeur: ValeurPlanning = {
    donnees,
    cartes,
    role,
    peutPlanifier,
    peutContacter,
    voitPrix,
    affectation,
    couleurMetier: (m) => donnees.metiers.find((x) => m && x.libelle.toLowerCase() === m.toLowerCase())?.couleur ?? null,
    nomEquipe: (id) => donnees.equipes.find((e) => e.id === id)?.nom ?? null,
    nomSousTraitant: (id) => donnees.sousTraitants.find((s) => s.id === id)?.nom ?? null,
    appliquer,
    ouvrirFiche: (carte, jour) => setFiche({ id: carte.id, jour }),
    poser,
    dater: (carte, jour) => poser(carte, jour, carte.rdv.heurePlanifiee ?? HEURE_DEFAUT),
    demanderDate: (carte) => setModale({ type: "date", id: carte.id }),
    demanderRappel: (carte) => setModale({ type: "rappel", bcId: carte.bcId }),
    signaler,
  };
  const carteFiche = fiche ? cartes.find((c) => c.id === fiche.id) : undefined;
  const carteDate = modale?.type === "date" ? cartes.find((c) => c.id === modale.id) : undefined;
  const nomST = (c: CartePlanning) => valeur.nomSousTraitant(c.sousTraitantId);
  const imprimer = useImpressionPlanning({
    cartes: cartesDuCalendrier(cartes, filtresEffectifs, affectation),
    lundi: premierLundi,
    societe: societe.nom,
    affectation,
    nomEquipe: valeur.nomEquipe,
    nomSousTraitant: valeur.nomSousTraitant,
  });

  return (
    <ContextePlanning.Provider value={valeur}>
      <div className="plus-subnav" role="tablist" aria-label="Vues du planning" style={{ justifyContent: "center" }}>
        {role === "sous_traitant" ? (
          <button type="button" role="tab" aria-selected className="plus-subnav-btn active">Mon planning {societe.nom}</button>
        ) : (
          ongletsDu(role).map((o) => (
            <button key={o.vue} type="button" role="tab" aria-selected={o.vue === vue} className={`plus-subnav-btn ${o.vue === vue ? "active" : ""}`} onClick={() => setChoix(o.vue)}>
              {o.libelle}
            </button>
          ))
        )}
      </div>
      <TetePlanning
        vue={vue}
        filtres={filtres}
        onFiltres={setFiltres}
        onRecherche={(recherche) => {
          setFiltres({ ...filtres, recherche });
          // `filterPlanningList` : saute à la semaine du premier résultat posé hors de l'écran.
          const saut = vue === "attente" ? null : semaineDuResultat(cartes, recherche, premierLundi);
          if (saut) setPremierLundi(saut);
        }}
        premierLundi={premierLundi}
        onSemaine={setPremierLundi}
        onImprimer={imprimer}
      />
      <div id="planningBodyZone">
        {vue === "attente" || vue === "attente_st" ? (
          <EnAttente cartes={enAttente(cartes, affectation, filtres.recherche, nomST)} mode={affectation} />
        ) : (
          <div className="planning-layout">
            {colonne && <ColonneNonPlanifies cartes={nonPlanifiees(cartes, filtresEffectifs, affectation)} toutes={cartes} filtres={filtres} onFiltres={setFiltres} glissee={glissee} onGlisser={setGlissee} />}
            <Calendrier cartes={cartesDuCalendrier(cartes, filtresEffectifs, affectation)} premierLundi={premierLundi} glissee={glissee} onGlisser={setGlissee} />
          </div>
        )}
      </div>
      {carteFiche && fiche && <FicheIntervention key={`${carteFiche.id}|${fiche.jour ?? ""}`} carte={carteFiche} jour={fiche.jour} onFermer={() => setFiche(null)} />}
      {modale?.type === "pose" && (
        <ModaleAffectation
          type={affectation}
          equipes={donnees.equipes}
          sousTraitants={donnees.sousTraitants}
          onAnnuler={() => setModale(null)}
          onChoisir={(a) => {
            poserAvec(modale.carte, modale.jour, modale.heure, a);
            setModale(null);
          }}
        />
      )}
      {carteDate && (
        <ModaleDateSupplementaire
          onAnnuler={() => setModale(null)}
          onValider={(date, heure, duree) => {
            appliquer(carteDate, () => planAjouterDate(carteDate, date, heure, duree), `Date ajoutée : ${date.split("-").reverse().join("/")} de ${heure} (${duree}h).`);
            setModale(null);
          }}
        />
      )}
      {modale?.type === "rappel" && (
        <ModaleRappel
          onAnnuler={() => setModale(null)}
          onValider={(date) => {
            const bcId = modale.bcId;
            setModale(null);
            rappel.mutate({ bcId, date }, { onSuccess: () => signaler(`🔄 Rappel programmé pour le ${date.split("-").reverse().join("/")}.`), onError: (e) => signaler("", e) });
          }}
        />
      )}
    </ContextePlanning.Provider>
  );
}

/** « Ma journée » du terrain (D-PLN-19), sur sa propre adresse : les interventions du jour de l'équipe. */
function ContenuMaJournee({ donnees, cartes }: { donnees: DonneesPlanning; cartes: CartePlanning[] }) {
  const { roleEffectif: role } = useSession();
  const [fiche, setFiche] = useState<{ id: string; jour: string | null } | null>(null);
  const valeur: ValeurPlanning = {
    donnees,
    cartes,
    role,
    peutPlanifier: false,
    peutContacter: false,
    voitPrix: false,
    affectation: role === "sous_traitant" ? "sous_traitant" : "equipe",
    couleurMetier: (m) => donnees.metiers.find((x) => m && x.libelle.toLowerCase() === m.toLowerCase())?.couleur ?? null,
    nomEquipe: (id) => donnees.equipes.find((e) => e.id === id)?.nom ?? null,
    nomSousTraitant: (id) => donnees.sousTraitants.find((s) => s.id === id)?.nom ?? null,
    appliquer: () => undefined,
    ouvrirFiche: (carte, jour) => setFiche({ id: carte.id, jour }),
    poser: () => undefined,
    dater: () => undefined,
    demanderDate: () => undefined,
    demanderRappel: () => undefined,
    signaler: (texte, erreur) => (erreur ? afficherToast(messageErreur(erreur)) : texte && afficherToast(texte, "success")),
  };
  const carteFiche = fiche ? cartes.find((c) => c.id === fiche.id) : undefined;
  return (
    <ContextePlanning.Provider value={valeur}>
      <EnTetePage titre="Ma journée" />
      <MaJournee />
      {carteFiche && fiche && <FicheIntervention key={`${carteFiche.id}|${fiche.jour ?? ""}`} carte={carteFiche} jour={fiche.jour} onFermer={() => setFiche(null)} />}
    </ContextePlanning.Provider>
  );
}

/** Le planning (PLN-01 à PLN-11) ; `vue="ma_journee"` : l'écran du terrain. */
export function PagePlanning({ vue }: { vue?: "ma_journee" }) {
  const planning = usePlanning();
  const { roleEffectif } = useSession();
  if (planning.isPending) return <Chargement />;
  if (planning.isError) return <Erreur erreur={planning.error} reessayer={() => void planning.refetch()} />;
  return vue === "ma_journee" ? (
    <ContenuMaJournee key={roleEffectif ?? ""} donnees={planning.data} cartes={planning.cartes} />
  ) : (
    <Contenu key={roleEffectif ?? ""} donnees={planning.data} cartes={planning.cartes} />
  );
}
