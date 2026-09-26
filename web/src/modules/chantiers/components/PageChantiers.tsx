import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { formatDateFr } from "@/lib/dates";
import { montant, ZERO } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { correspond } from "@/lib/recherche";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { useConducteurs } from "@/modules/societes/hooks/useConducteurs";
import { adresseComplete, libelleTypeChantier, type Chantier } from "../domain/chantier";
import { pourcentageFacture } from "../domain/dpgf";
import { useAvancements, useChantiers, useCompteursChantiers } from "../hooks/useChantiers";
import { classeStatut } from "./statut";
import { FormulaireChantierEnPlace } from "./FormulaireChantier";

interface Props {
  /** `null` : `/chantiers/nouveau` arrive formulaire ouvert, au-dessus des cartes — comme l'ancien `openForm('chantier')`. */
  formulaire?: null;
}

/** L'écran Chantiers de l'ancien (`renderChantiers`) : filtres, formulaire en place, cartes A4. */
export function PageChantiers({ formulaire }: Props) {
  useModeDiscret();
  const chantiers = useChantiers();
  const avancements = useAvancements();
  const compteurs = useCompteursChantiers();
  const conducteurs = useConducteurs();
  const navigate = useNavigate();
  const peutCreer = usePermission("chantiers", "creer");
  const [ouvert, setOuvert] = useState(formulaire === null);
  const [recherche, setRecherche] = useState("");
  const [conducteur, setConducteur] = useState("");
  const [type, setType] = useState("");

  const parChantier = useMemo(() => new Map((avancements.data ?? []).map((a) => [a.chantier_id, a])), [avancements.data]);
  // Les conducteurs actifs, plus celui déjà filtré (`conducteurFilterOptions`) : un conducteur retiré garde ses affaires.
  const noms = [...new Set((conducteurs.data ?? []).filter((c) => c.actif || c.nom === conducteur).map((c) => c.nom))].sort((a, b) => a.localeCompare(b, "fr"));
  const filtres = (chantiers.data ?? []).filter(
    (c) =>
      (!type || c.type === type) &&
      correspond(recherche, c.nom, c.client_nom, c.adresse, c.code_postal, c.ville) &&
      (!conducteur || c.conducteur === conducteur)
  );

  function fermer() {
    setOuvert(false);
    if (formulaire === null) void navigate("/chantiers", { replace: true });
  }

  return (
    <>
      <div className="page-head">
        <h1>Chantiers</h1>
        {!ouvert && peutCreer && (
          <button type="button" className="btn primary" onClick={() => setOuvert(true)}>
            + Nouveau chantier
          </button>
        )}
      </div>
      {!ouvert && (
        <div style={{ display: "flex", gap: "10px", marginBottom: "18px", flexWrap: "wrap" }}>
          <input
            type="text"
            id="chantierSearchInput"
            aria-label="Rechercher un chantier"
            style={{ flex: 1, minWidth: "220px" }}
            value={recherche}
            placeholder="Rechercher : nom, client, adresse…"
            onChange={(e) => setRecherche(e.target.value)}
          />
          <select aria-label="Filtrer par conducteur" style={{ width: "auto", minWidth: "180px" }} value={conducteur} onChange={(e) => setConducteur(e.target.value)}>
            <option value="">Tous les conducteurs</option>
            {noms.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <select aria-label="Filtrer par type" style={{ width: "auto", minWidth: "200px" }} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tous les chantiers</option>
            <option value="rehabilitation">Réhabilitation</option>
            <option value="neuf">Chantier neuf</option>
          </select>
        </div>
      )}
      <div id="formZoneChantier">{ouvert && <FormulaireChantierEnPlace id={null} onFermer={fermer} />}</div>
      <div id="chantierListZone">
        {chantiers.isPending && <Chargement />}
        {chantiers.isError && <Erreur erreur={chantiers.error} reessayer={() => void chantiers.refetch()} />}
        {avancements.isError && <Erreur erreur={avancements.error} reessayer={() => void avancements.refetch()} />}
        {compteurs.isError && <Erreur erreur={compteurs.error} reessayer={() => void compteurs.refetch()} />}
        {chantiers.isSuccess && (
          <div className="chantier-grid">
            {filtres.length ? (
              filtres.map((c) => {
                const a = parChantier.get(c.id);
                const total = a ? montant(a.montant_total) : ZERO;
                const facture = a ? montant(a.montant_facture) : ZERO;
                return <CarteChantier key={c.id} c={c} total={total} pourcentage={pourcentageFacture(total, facture)} compteurs={compteurs.data?.get(c.id)} />;
              })
            ) : (
              <div className="empty">Aucun chantier ne correspond.</div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

interface PropsCarte {
  c: Chantier;
  total: ReturnType<typeof montant>;
  pourcentage: number;
  compteurs: { comptesRendus: number; devis: number; factures: number } | undefined;
}

/**
 * La carte A4 de l'ancien (`chantierCardA4HTML`). Un lien qui l'habille tout
 * entière : l'ancien ouvrait la fiche d'un clic sur la carte, le clavier y
 * arrive ici aussi.
 */
function CarteChantier({ c, total, pourcentage, compteurs }: PropsCarte) {
  useModeDiscret();
  const navigate = useNavigate();
  const ouvrir = () => void navigate(`/chantiers/${c.id}`);
  return (
    <div
      className="chantier-a4"
      role="link"
      tabIndex={0}
      aria-label={c.nom}
      onClick={ouvrir}
      onKeyDown={(e) => {
        if (e.key === "Enter") ouvrir();
      }}
    >
      <div className={`chantier-a4-type ${c.type === "neuf" ? "neuf" : "rehab"}`}>{libelleTypeChantier(c.type)}</div>
      <div className="chantier-a4-nom">{c.nom}</div>
      {/* Le nom du client, que l'ancien laissait vide faute de le lire sur la fiche (D-ECR-CHA-07). */}
      <div className="chantier-a4-client">{c.client_nom ?? ""}</div>
      <div className="chantier-a4-adresse">{adresseComplete(c)}</div>
      <div className="chantier-a4-dates">
        {c.date_debut ? formatDateFr(c.date_debut) : "?"} → {c.date_fin ? formatDateFr(c.date_fin) : "?"}
      </div>
      <div className="chantier-a4-statut">
        <span className={`badge ${classeStatut(c.statut)}`}>{c.statut || "en préparation"}</span>
      </div>
      <div className="chantier-a4-montant">
        {formatEurosEcran(total)} <span className="card-sub">HT</span>
      </div>
      <div className="chantier-a4-avancement-box">
        <div className="chantier-a4-avancement-bar">
          <div className="chantier-a4-avancement-fill" style={{ width: `${pourcentage}%` }} />
        </div>
        <div className="chantier-a4-avancement-ring" style={{ "--pct": pourcentage } as React.CSSProperties}>
          <span>{pourcentage}%</span>
        </div>
      </div>
      <div className="chantier-a4-footer">
        <span className="a4-stat a4-stat-cr" title="Comptes-rendus">
          📋 {compteurs?.comptesRendus ?? 0}
        </span>
        <span className="a4-stat a4-stat-devis" title="Devis">
          📄 {compteurs?.devis ?? 0}
        </span>
        <span className="a4-stat a4-stat-facture" title="Factures">
          🧾 {compteurs?.factures ?? 0}
        </span>
      </div>
    </div>
  );
}
