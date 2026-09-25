import { useMemo, useState } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/dates";
import { useFiltresAdresse } from "@/lib/useFiltresAdresse";
import { messageErreur } from "@/lib/erreurs";
import { usePermission, useSession, useSocieteActive, useVoitLesPrix } from "@/modules/auth-roles/hooks/useSession";
import type { DonneesPlanning } from "../api/planning";
import { lundiDe } from "../domain/calendrier";
import { metiersDuBon, type CartePlanning } from "../domain/cartes";
import { cartesDuCalendrier, enAttente, FILTRES_VIDES, nonPlanifiees, semaineDuResultat, type Affectation, type VuePlanning } from "../domain/filtres";
import { referentielMetiers } from "../domain/metiers";
import { affectationConnue, planAjouterDate, planPoser, type AffectationChoisie, type Plan } from "../domain/planification";
import { useImpressionPlanning } from "../hooks/useImpressionPlanning";
import { useAppliquerPlan, usePlanning } from "../hooks/usePlanning";
import { BarreOutils } from "./BarreOutils";
import { Calendrier } from "./Calendrier";
import { ColonneNonPlanifies } from "./ColonneNonPlanifies";
import { ContextePlanning, type ValeurPlanning } from "./contexte";
import { EnAttente } from "./EnAttente";
import { FicheIntervention } from "./FicheIntervention";
import { MaJournee } from "./MaJournee";
import { ModaleAffectation, ModaleDateSupplementaire } from "./Modales";

type Onglet = VuePlanning | "ma_journee";
const LIBELLES: Record<Onglet, string> = { ma_journee: "Ma journée", technicien: "Planning technicien", sous_traitant: "Planning sous-traitant", attente: "En attente technicien", attente_st: "En attente sous-traitant" };

/** Le technicien a sa vue imposée et sa journée ; le sous-traitant « Mon planning » (PLN-01). */
function ongletsDu(role: string | null): Onglet[] {
  if (role === "technicien") return ["ma_journee", "technicien"];
  if (role === "sous_traitant") return ["ma_journee", "sous_traitant"];
  return ["technicien", "sous_traitant", "attente", "attente_st"];
}

function Contenu({ donnees, cartes, initial }: { donnees: DonneesPlanning; cartes: CartePlanning[]; initial: Onglet }) {
  const { roleEffectif: role } = useSession();
  const societe = useSocieteActive();
  const planningModifiable = usePermission("planning", "modifier");
  const peutContacter = usePermission("bons_commande", "modifier");
  // Le rendez-vous s'écrit sur le bon : il faut les deux droits.
  const peutPlanifier = planningModifiable && peutContacter;
  const voitPrix = useVoitLesPrix();
  const [onglet, setOnglet] = useState<Onglet>(initial);
  const [premierLundi, setPremierLundi] = useState(lundiDe(todayISO()));
  // Les filtres vivent dans l'adresse : une tuile ouvre `/planning?conducteur=…` déjà filtré (D-CLI-10).
  const { filtres, changer: setFiltres } = useFiltresAdresse(FILTRES_VIDES);
  const [glissee, setGlissee] = useState<CartePlanning | null>(null);
  const [fiche, setFiche] = useState<{ id: string; jour: string | null } | null>(null);
  const [pose, setPose] = useState<{ carte: CartePlanning; jour: string; heure: string } | null>(null);
  const [dateSuppl, setDateSuppl] = useState<string | null>(null);
  const [message, setMessage] = useState<{ texte: string; erreur?: unknown } | null>(null);
  const appliquerPlan = useAppliquerPlan();
  const affectation: Affectation = onglet === "sous_traitant" || onglet === "attente_st" ? "sous_traitant" : "equipe";
  // Le sous-traitant ne voit que SES cartes au calendrier.
  const filtresEffectifs = role === "sous_traitant" ? { ...filtres, affecte: donnees.monSousTraitantId ?? "—" } : filtres;
  const metiers = useMemo(() => referentielMetiers(donnees.metiers.map((m) => m.libelle), donnees.bons.flatMap((b) => metiersDuBon(b))), [donnees]);

  const signaler = (texte: string, erreur?: unknown) => setMessage({ texte, erreur });
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
  const poserAvec = (carte: CartePlanning, jour: string, heure: string, a: AffectationChoisie | null) => appliquer(carte, () => planPoser(carte, jour, heure, a), "Carte posée au planning.");
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
    poser: (carte, jour, heure) => {
      const choisie = filtres.affecte ? affectationConnue({ ...carte, equipeId: filtres.affecte, sousTraitantId: filtres.affecte }, affectation, donnees) : affectationConnue(carte, affectation, donnees);
      if (choisie) poserAvec(carte, jour, heure, choisie);
      else setPose({ carte, jour, heure });
    },
    demanderDate: (carte) => setDateSuppl(carte.id),
    signaler,
  };
  const carteFiche = fiche ? cartes.find((c) => c.id === fiche.id) : undefined;
  const carteDate = dateSuppl ? cartes.find((c) => c.id === dateSuppl) : undefined;
  const calendrier = onglet === "technicien" || onglet === "sous_traitant";
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
      <div role="tablist" aria-label="Vues du planning" className="mb-3 flex flex-wrap gap-2 print:hidden">
        {ongletsDu(role).map((o) => (
          <Button key={o} role="tab" aria-selected={o === onglet} variant={o === onglet ? "default" : "outline"} size="sm" onClick={() => setOnglet(o)}>
            {o === "sous_traitant" && role === "sous_traitant" ? `Mon planning ${societe.nom}` : LIBELLES[o]}
          </Button>
        ))}
      </div>
      {message && <Alert variant={message.erreur ? "erreur" : "succes"} className="mb-2 print:hidden">{message.erreur ? messageErreur(message.erreur) : message.texte}</Alert>}
      {onglet === "ma_journee" && <MaJournee />}
      {onglet !== "ma_journee" && (
        <BarreOutils
          filtres={filtres}
          onFiltres={setFiltres}
          onRecherche={(recherche) => {
            setFiltres({ ...filtres, recherche });
            const saut = calendrier ? semaineDuResultat(cartes, recherche, premierLundi) : null;
            if (saut) setPremierLundi(saut);
          }}
          premierLundi={premierLundi}
          onSemaine={setPremierLundi}
          metiers={metiers}
          calendrier={calendrier}
          onImprimer={imprimer}
        />
      )}
      {(onglet === "attente" || onglet === "attente_st") && <EnAttente cartes={enAttente(cartes, affectation, filtres.recherche, nomST)} mode={affectation} />}
      {calendrier && (
        <div className="flex flex-col gap-3 lg:flex-row">
          {role !== "technicien" && role !== "sous_traitant" && (
            <ColonneNonPlanifies cartes={nonPlanifiees(cartes, filtresEffectifs, affectation)} toutes={cartes} filtres={filtres} onFiltres={setFiltres} glissee={glissee} onGlisser={setGlissee} />
          )}
          <div className="min-w-0 flex-1 print:hidden">
            <Calendrier cartes={cartesDuCalendrier(cartes, filtresEffectifs, affectation)} premierLundi={premierLundi} glissee={glissee} onGlisser={setGlissee} />
          </div>
        </div>
      )}
      {carteFiche && fiche && <FicheIntervention key={`${carteFiche.id}|${fiche.jour ?? ""}`} carte={carteFiche} jour={fiche.jour} onFermer={() => setFiche(null)} />}
      {pose && (
        <ModaleAffectation
          type={affectation}
          equipes={donnees.equipes}
          sousTraitants={donnees.sousTraitants}
          onAnnuler={() => setPose(null)}
          onChoisir={(a) => {
            poserAvec(pose.carte, pose.jour, pose.heure, a);
            setPose(null);
          }}
        />
      )}
      {carteDate && (
        <ModaleDateSupplementaire
          onAnnuler={() => setDateSuppl(null)}
          onValider={(date, heure, duree) => {
            appliquer(carteDate, () => planAjouterDate(carteDate, date, heure, duree), `Date ajoutée : ${date.split("-").reverse().join("/")} à ${heure} (${duree} h).`);
            setDateSuppl(null);
          }}
        />
      )}
    </ContextePlanning.Provider>
  );
}

/** Le planning (PLN-01 à PLN-11). `vue` impose l'onglet d'arrivée (« Ma journée » pour le terrain). */
export function PagePlanning({ vue }: { vue?: Onglet }) {
  const planning = usePlanning();
  const { roleEffectif } = useSession();
  const onglets = ongletsDu(roleEffectif);
  const initial = vue && onglets.includes(vue) ? vue : (onglets[0] ?? "technicien");
  return (
    <>
      <EnTetePage titre="Planning" />
      {planning.isPending && <Chargement />}
      {planning.isError && <Erreur erreur={planning.error} reessayer={() => void planning.refetch()} />}
      {planning.data && <Contenu key={roleEffectif ?? ""} donnees={planning.data} cartes={planning.cartes} initial={initial} />}
    </>
  );
}
