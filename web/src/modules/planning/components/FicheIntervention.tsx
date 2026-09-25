import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { formatDateFr } from "@/lib/dates";
import { Can } from "@/modules/auth-roles/components/Can";
import type { Constats } from "../api/planning";
import { tacheDuJour, tachesHorsMetier, toutesLesJournees, type CartePlanning, type TachePlanning } from "../domain/cartes";
import { planMaterialiser } from "../domain/planification";
import { actionsTache, appartenanceDe } from "../domain/taches";
import { BandeauTache } from "./BandeauTache";
import { usePlanningContexte } from "./contexte";
import { Croquis } from "./Croquis";
import { Dialogue } from "./Dialogue";
import { adresseDuLieu, numeroDeLaCarte } from "./format";
import { InfosCarte, MontantCarte } from "./InfosCarte";
import { PhotosTerrain } from "./PhotosTerrain";
import { TravauxPrevus } from "./TravauxPrevus";
import { TravauxSupplementaires } from "./TravauxSupplementaires";
import { ZoneContacts } from "./ZoneContacts";

/** Ceux qui créent une tâche manquante (`peut_ecrire`) — l'écran historique la créait à l'ouverture. */
const PREPARENT = ["admin", "conducteur", "technicien"];

function constatsInitiaux(t: TachePlanning | null): Constats {
  return { commentaire: t?.commentaire ?? "", pieceACommander: !!t?.piece_a_commander, pieceDescription: t?.piece_description ?? "", croquis: t?.croquis ?? null };
}

/** Commentaire, pièce à commander, croquis : une seule saisie, que chaque bouton de tâche emporte. */
function SaisieConstats({ constats, onChange, active }: { constats: Constats; onChange: (c: Constats) => void; active: boolean }) {
  return (
    <fieldset disabled={!active} className="flex flex-col gap-2 text-sm">
      <legend className="mb-1 font-semibold">Mes constats</legend>
      <label className="flex flex-col gap-1">
        Commentaire
        <Textarea value={constats.commentaire} onChange={(e) => onChange({ ...constats, commentaire: e.target.value })} />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={constats.pieceACommander} onChange={(e) => onChange({ ...constats, pieceACommander: e.target.checked })} />
        Pièce à commander
      </label>
      {constats.pieceACommander && (
        <label className="flex flex-col gap-1">
          Pièce à commander (détail)
          <Input value={constats.pieceDescription} placeholder="Référence, dimension, quantité…" onChange={(e) => onChange({ ...constats, pieceDescription: e.target.value })} />
        </label>
      )}
      <span>Croquis</span>
      <Croquis valeur={constats.croquis} desactive={!active} onChange={(croquis) => onChange({ ...constats, croquis })} />
    </fieldset>
  );
}

interface Props {
  carte: CartePlanning;
  jour: string | null;
  onFermer: () => void;
}

/**
 * La fiche d'une carte (PLN-08, PLN-09) : ce qu'il y a à faire, où, pour qui,
 * et le circuit de chaque tâche. Technicien, sous-traitant et conducteur
 * ouvrent la MÊME fiche ; les gestes proposés suivent le rôle et l'équipe.
 * Aucun prix, sauf « Votre montant » au sous-traitant.
 */
export function FicheIntervention({ carte, jour, onFermer }: Props) {
  const { role, donnees, peutPlanifier, appliquer, demanderDate } = usePlanningContexte();
  const jourVise = jour ?? carte.rdv.datePlanifiee;
  const entrees = carte.metiersDeLaCarte.map((m) => ({ metier: m, tache: tacheDuJour(carte, m, jourVise) }));
  const hors = carte.positionLiee <= 1 ? tachesHorsMetier(carte) : [];
  const principale = entrees.find((e) => e.tache)?.tache ?? hors[0] ?? null;
  const [constats, setConstats] = useState<Constats>(() => constatsInitiaux(principale));
  const saisissable = [...entrees.map((e) => e.tache), ...hors].some((t) => t && actionsTache(t.statut, role, appartenanceDe(t, donnees.monEquipeId, donnees.monSousTraitantId)).peutSaisir);
  const toutes = [...entrees.map((e) => e.tache).filter((t): t is TachePlanning => !!t), ...hors];
  const toutesValidees = toutes.length > 0 && toutes.every((t) => t.statut === "validee");
  const autres = toutesLesJournees(carte.rdv.datePlanifiee, false, carte.suppl).filter((d) => d.date !== jourVise);
  const restantes = carte.suppl.filter((d) => d.date !== jourVise && !d.fait).length;

  return (
    <Dialogue titre={`${numeroDeLaCarte(carte)}${jourVise && jour ? ` — ${formatDateFr(jourVise)}` : ""}`} onFermer={onFermer} large>
      <p className="text-sm text-muted-foreground">{carte.bon.client_nom} — {adresseDuLieu(carte)}</p>
      <InfosCarte carte={carte} />
      <MontantCarte carte={carte} />
      <ZoneContacts carte={carte} />
      <TravauxPrevus carte={carte} />
      {entrees.map(({ metier, tache }) =>
        tache ? (
          <BandeauTache key={tache.id} tache={tache} metier={metier} constats={constats} />
        ) : (
          <div key={metier ?? "sans-metier"} className="rounded-md border border-dashed p-2 text-sm">
            <p>{metier ? `${metier} : ` : ""}aucune journée enregistrée{jourVise ? ` le ${formatDateFr(jourVise)}` : ""}.</p>
            {jourVise && role && PREPARENT.includes(role) && (
              <Button size="sm" variant="outline" className="mt-1" onClick={() => appliquer(carte, () => planMaterialiser(carte, metier, jourVise), "Fiche préparée.")}>
                Préparer la fiche de ce jour
              </Button>
            )}
          </div>
        )
      )}
      {hors.map((t) => (
        <BandeauTache key={t.id} tache={t} metier={t.metier} horsMetier constats={constats} />
      ))}
      {toutesValidees && <p className="text-sm">✓ Tous les métiers sont validés — le bon attend son chiffrage dans <b>Facturation › Validation</b>.</p>}
      {principale && <SaisieConstats constats={constats} onChange={setConstats} active={saisissable} />}
      <PhotosTerrain bcId={carte.bcId} />
      <TravauxSupplementaires bcId={carte.bcId} tacheId={principale?.id ?? null} />
      {autres.length > 0 && (
        <p className="text-sm">
          Ce bon de commande a {autres.length} autre(s) date(s) planifiée(s) — {restantes ? `${restantes} encore à valider` : "toutes déjà validées"}.
        </p>
      )}
      <Can module="bons_commande">
        <Button asChild variant="link" size="sm" className="self-start px-0"><Link to={`/commandes/${carte.bcId}`}>Ouvrir le bon de commande{carte.bon.piece_jointe_nom ? ` (📎 ${carte.bon.piece_jointe_nom})` : ""}</Link></Button>
      </Can>
      <Can module="rapports" action="creer">
        <Button asChild variant="outline" size="sm" className="self-start"><Link to={`/rapports/nouveau?bon=${carte.bcId}`}>📝 Rédiger le rapport d'intervention</Link></Button>
      </Can>
      {peutPlanifier && carte.rdv.datePlanifiee && (
        <Button variant="outline" size="sm" className="self-start" onClick={() => demanderDate(carte)}>+ Ajouter une date</Button>
      )}
    </Dialogue>
  );
}
