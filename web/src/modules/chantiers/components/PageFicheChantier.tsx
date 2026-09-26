import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { formatDateFr } from "@/lib/dates";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { adresseComplete, libelleTypeChantier, type Chantier } from "../domain/chantier";
import { statistiquesChantier } from "../domain/statistiques";
import { useChantier, useDpgf } from "../hooks/useChantiers";
import { useDroitsChantier } from "../hooks/useDroitsChantier";
import { useAchats, useComptesRendus, useDevisDuChantier, useFacturesDuChantier } from "../hooks/useFiche";
import { BlocAchats } from "./BlocAchats";
import { BlocAffectations } from "./BlocAffectations";
import { BlocComptesRendus } from "./BlocComptesRendus";
import { BlocDevisComplementaires } from "./BlocDevisComplementaires";
import { BlocPiecesMarche } from "./BlocDocuments";
import { BlocDpgf } from "./BlocDpgf";
import { BlocFactures } from "./BlocFactures";
import { BlocInfosDiverses } from "./BlocInfosDiverses";
import { BlocTodo } from "./BlocTodo";
import { FormulaireChantierEnPlace } from "./FormulaireChantier";
import { classeStatut } from "./statut";

/**
 * La fiche d'un chantier (`renderChantierDetail`). `edition` : la route
 * `/chantiers/:id/modifier` arrive formulaire ouvert, à la place du bandeau et
 * des sections — comme « Modifier les infos » dans l'ancien.
 */
export function PageFicheChantier({ edition = false }: { edition?: boolean }) {
  useModeDiscret();
  const { id } = useParams();
  const chantier = useChantier(id);
  if (chantier.isPending) return <Chargement />;
  if (chantier.isError) return <Erreur erreur={chantier.error} reessayer={() => void chantier.refetch()} />;
  return (
    <GardeSociete societeId={chantier.data.societe_id} retour="/chantiers">
      <Fiche key={chantier.data.id} c={chantier.data} edition={edition} />
    </GardeSociete>
  );
}

function Fiche({ c, edition }: { c: Chantier; edition: boolean }) {
  useModeDiscret();
  const droits = useDroitsChantier();
  const navigate = useNavigate();
  const peutModifier = usePermission("chantiers", "modifier");
  const [modifie, setModifie] = useState(edition);
  const [aImporter, setAImporter] = useState<File | null>(null);

  function fermer() {
    setModifie(false);
    if (edition) void navigate(`/chantiers/${c.id}`, { replace: true });
  }

  return (
    <>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button type="button" className="btn small" onClick={() => void navigate("/chantiers")}>
            ← Retour aux chantiers
          </button>
          <h1 style={{ margin: 0 }}>{c.nom}</h1>
        </div>
        {!modifie && peutModifier && (
          <button type="button" className="btn" onClick={() => setModifie(true)}>
            Modifier les infos
          </button>
        )}
      </div>
      {modifie ? (
        <FormulaireChantierEnPlace id={c.id} onFermer={fermer} defiler={false} />
      ) : (
        <>
          <Bandeau c={c} />
          <div className="chantier-sections">
            <BlocComptesRendus chantierId={c.id} />
            <BlocInfosDiverses chantier={c} modifiable={droits.modifie} />
            <BlocPiecesMarche chantierId={c.id} onAnalyserDpgf={droits.gere ? setAImporter : undefined} />
            <BlocTodo chantierId={c.id} />
            <BlocDevisComplementaires chantier={c} />
            <BlocFactures chantierId={c.id} />
            {droits.gere && <BlocAchats chantierId={c.id} />}
            {droits.gere && <BlocDpgf chantier={c} fichierAImporter={aImporter} importer={setAImporter} />}
            {/* Absents de l'ancien : l'affectation ouvre le chantier au terrain (RLS), D-ECR-CHA-09. */}
            <BlocAffectations chantierId={c.id} />
          </div>
        </>
      )}
    </>
  );
}

/**
 * Le bandeau sombre de l'ancienne fiche (`chantier-hero`) : type · client,
 * adresse, période, statut, puis les chiffres. Chaque chiffre n'apparaît qu'à
 * qui peut lire sa source — un zéro mentirait à qui ne voit pas les prix.
 */
function Bandeau({ c }: { c: Chantier }) {
  useModeDiscret();
  const droits = useDroitsChantier();
  const voitDevis = usePermission("devis", "voir");
  const voitFactures = usePermission("factures", "voir");
  const dpgf = useDpgf(c.id);
  const achats = useAchats(c.id);
  const cr = useComptesRendus(c.id);
  const devis = useDevisDuChantier(c.id);
  const factures = useFacturesDuChantier(c.id);
  const s = statistiquesChantier({
    dpgf: droits.gere ? (dpgf.data ?? []) : null,
    achats: droits.gere ? (achats.data ?? []) : null,
    nbDevis: voitDevis ? (devis.data?.length ?? 0) : null,
    nbFactures: voitFactures ? (factures.data?.length ?? 0) : null,
    nbComptesRendus: cr.data?.length ?? 0,
    todo: { faits: 0, total: 0 },
  });
  const pct = s.avancement?.pourcentage ?? 0;
  const pluriel = (n: number) => (n > 1 ? "s" : "");

  return (
    <div className="chantier-hero">
      <div className="chantier-hero-top">
        <div>
          <div className="card-sub">
            {libelleTypeChantier(c.type)} · {c.client_nom ?? ""}
          </div>
          <div className="card-sub">{adresseComplete(c)}</div>
          <div className="card-sub">
            {c.date_debut ? formatDateFr(c.date_debut) : "?"} → {c.date_fin ? formatDateFr(c.date_fin) : "?"}
          </div>
        </div>
        <span className={`badge ${classeStatut(c.statut)}`}>{c.statut || "en préparation"}</span>
      </div>
      <div className="chantier-hero-stats">
        {s.avancement && (
          <>
            <div className="hero-stat">
              <div className="hero-ring" style={{ "--pct": pct } as React.CSSProperties} role="img" aria-label={`Avancement facturé ${pct} %`}>
                <span aria-hidden="true">{pct}%</span>
              </div>
              <div className="hero-stat-label">
                Avancement
                <br />
                facturé
              </div>
            </div>
            <div className="hero-stat-block">
              <div className="hero-stat-value">{formatEurosEcran(s.avancement.total)}</div>
              <div className="hero-stat-label">Total DPGF (HT)</div>
            </div>
          </>
        )}
        {s.nbDevis !== null && (
          <div className="hero-stat-block">
            <div className="hero-stat-value">{s.nbDevis}</div>
            <div className="hero-stat-label">Devis</div>
          </div>
        )}
        <div className="hero-stat-block">
          <div className="hero-stat-value">{s.nbComptesRendus}</div>
          <div className="hero-stat-label">
            Compte{pluriel(s.nbComptesRendus)}-rendu{pluriel(s.nbComptesRendus)}
          </div>
        </div>
        {s.totalAchats && (
          <div className="hero-stat-block">
            <div className="hero-stat-value">{formatEurosEcran(s.totalAchats)}</div>
            <div className="hero-stat-label">Achats</div>
          </div>
        )}
        {s.nbFactures !== null && (
          <div className="hero-stat-block">
            <div className="hero-stat-value">{s.nbFactures}</div>
            <div className="hero-stat-label">Facture{pluriel(s.nbFactures)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
