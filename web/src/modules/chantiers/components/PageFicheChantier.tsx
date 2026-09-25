import { useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateFr } from "@/lib/dates";
import { Can } from "@/modules/auth-roles/components/Can";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { adresseComplete, libelleStatutChantier, libelleTypeChantier, varianteStatutChantier, type Chantier } from "../domain/chantier";
import { useChantier } from "../hooks/useChantiers";
import { useDroitsChantier } from "../hooks/useDroitsChantier";
import { BlocAchats } from "./BlocAchats";
import { BlocAffectations } from "./BlocAffectations";
import { BlocComptesRendus } from "./BlocComptesRendus";
import { BlocDevisComplementaires } from "./BlocDevisComplementaires";
import { BlocPiecesMarche, BlocSecurite } from "./BlocDocuments";
import { BlocDpgf } from "./BlocDpgf";
import { BlocFactures } from "./BlocFactures";
import { BlocInfosDiverses } from "./BlocInfosDiverses";
import { BlocTodo } from "./BlocTodo";
import { Onglets, type Onglet } from "./Onglets";
import { StatistiquesChantier } from "./StatistiquesChantier";

interface Props {
  /** Sections apportées par d'autres modules (devis du chantier…), composées dans app/. */
  complements?: (c: Chantier) => ReactNode;
  actionsDpgf?: (c: Chantier) => ReactNode;
  /** « Facturer la sélection » : fourni par app/ (module facturation) avec les lignes cochées. */
  actionsSelection?: (c: Chantier, lignes: string[]) => ReactNode;
}

export function PageFicheChantier(props: Props) {
  const { id } = useParams();
  const chantier = useChantier(id);
  if (chantier.isPending) return <Chargement />;
  if (chantier.isError) return <Erreur erreur={chantier.error} reessayer={() => void chantier.refetch()} />;
  return (
    <GardeSociete societeId={chantier.data.societe_id} retour="/chantiers">
      <Fiche key={chantier.data.id} c={chantier.data} {...props} />
    </GardeSociete>
  );
}

function Fiche({ c, complements, actionsDpgf, actionsSelection }: Props & { c: Chantier }) {
  const droits = useDroitsChantier();
  const [params, setParams] = useSearchParams();
  const [aImporter, setAImporter] = useState<File | null>(null);
  const onglets: Onglet[] = [
    { cle: "synthese", libelle: "Synthèse" },
    { cle: "documents", libelle: "Documents" },
    ...(droits.gere ? [{ cle: "dpgf", libelle: "DPGF" }] : []),
    { cle: "todo", libelle: "To-do" },
    ...(droits.gere ? [{ cle: "achats", libelle: "Achats" }] : []),
    { cle: "devis-factures", libelle: "Devis et factures" },
  ];
  const demande = params.get("onglet");
  const actif = onglets.some((o) => o.cle === demande) ? (demande as string) : "synthese";
  const ouvrir = (cle: string) => setParams((p) => ({ ...Object.fromEntries(p), onglet: cle }), { replace: true });
  const analyser = (f: File | null) => {
    setAImporter(f);
    if (f) ouvrir("dpgf");
  };

  return (
    <div className="flex flex-col gap-4">
      <EnTetePage
        titre={c.nom}
        sousTitre={
          <>
            {c.client_id ? (
              <Link to={`/clients/${c.client_id}`} className="text-primary hover:underline">{c.client_nom}</Link>
            ) : (
              c.client_nom || "Sans client"
            )}
            {` · ${libelleTypeChantier(c.type)} `}
            <Badge variant={varianteStatutChantier(c.statut)}>{libelleStatutChantier(c.statut)}</Badge>
          </>
        }
        actions={
          <Can module="chantiers" action="modifier">
            <Button asChild variant="outline"><Link to={`/chantiers/${c.id}/modifier`}>Modifier les infos</Link></Button>
          </Can>
        }
      />
      <Card>
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Adresse</p><p className="text-sm">{adresseComplete(c) || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Période</p><p className="text-sm">{formatDateFr(c.date_debut)} → {formatDateFr(c.date_fin)}</p></div>
          <div><p className="text-xs text-muted-foreground">Conducteur</p><p className="text-sm">{c.conducteur || "—"}</p></div>
          {c.notes && <p className="whitespace-pre-line text-sm text-muted-foreground sm:col-span-3">{c.notes}</p>}
        </CardContent>
      </Card>
      <StatistiquesChantier chantierId={c.id} />
      <Onglets onglets={onglets} actif={actif} choisir={ouvrir} id={`fiche-${c.id}`}>
        {actif === "synthese" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <BlocInfosDiverses chantier={c} modifiable={droits.modifie} />
            <BlocAffectations chantierId={c.id} />
          </div>
        )}
        {actif === "documents" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2"><BlocComptesRendus chantierId={c.id} /></div>
            <BlocPiecesMarche chantierId={c.id} onAnalyserDpgf={droits.gere ? analyser : undefined} />
            <BlocSecurite chantier={c} />
          </div>
        )}
        {actif === "dpgf" && droits.gere && (
          <BlocDpgf chantier={c} actions={actionsDpgf?.(c)} actionsSelection={actionsSelection ? (ids) => actionsSelection(c, ids) : undefined} fichierAImporter={aImporter} importer={setAImporter} />
        )}
        {actif === "todo" && <BlocTodo chantierId={c.id} />}
        {actif === "achats" && droits.gere && <BlocAchats chantierId={c.id} />}
        {actif === "devis-factures" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <BlocDevisComplementaires chantierId={c.id} devisDuChantier={complements?.(c)} />
            <BlocFactures chantierId={c.id} />
          </div>
        )}
      </Onglets>
    </div>
  );
}
