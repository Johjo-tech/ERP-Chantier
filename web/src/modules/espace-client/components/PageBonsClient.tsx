import { useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { formatDateFr } from "@/lib/dates";
import { chercherBonsClient, statutClientBon, tentativesDe, trierBonsClient, TUILES, type BonClient, type CouleurBon } from "../domain/bons";
import { useAccesClients, useBonsClient } from "../hooks/useEspaceClient";

/** Emoji, couleur et fond de `statutClientBC` (app.js l. 6636) : la tuile et le badge d'un même statut se répondent. */
const TEINTE: Record<CouleurBon, { emoji: string; couleur: string; fond: string }> = {
  rouge: { emoji: "🔴", couleur: "#C0303C", fond: "#FDE7E9" },
  orange: { emoji: "🟠", couleur: "#C24E00", fond: "#FFEDE0" },
  jaune: { emoji: "🟡", couleur: "#B7860B", fond: "#FDF6DC" },
  vert: { emoji: "✅", couleur: "#12875A", fond: "#E1F5EC" },
};

function adresseDe(b: BonClient): string {
  const rue = [b.adresse_locataire || b.adresse, [b.code_postal, b.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [rue, b.numero_logement && `N° ${b.numero_logement}`].filter(Boolean).join(" · ");
}

function CarteBon({ bon: b, unSeulInterlocuteur }: { bon: BonClient; unSeulInterlocuteur: boolean }) {
  const st = statutClientBon(b);
  const t = TEINTE[st.cle];
  const tentatives = tentativesDe(b);
  const adresse = adresseDe(b);
  return (
    <li className="card" style={{ borderLeft: `5px solid ${t.couleur}` }}>
      <div className="card-row">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card-title">BC n° {b.numero_bc || "—"}</div>
          {adresse && <div className="card-sub">📍 {adresse}</div>}
          {b.occupant && <div className="card-sub">👤 Locataire : {b.occupant}</div>}
          {b.interlocuteur && !unSeulInterlocuteur && <div className="card-sub">Interlocuteur : {b.interlocuteur}</div>}
        </div>
        <span className="badge" style={{ background: t.fond, color: t.couleur, flexShrink: 0 }}>
          {t.emoji} {st.libelle}
        </span>
      </div>
      {b.piece_a_commander && b.piece_a_commander_detail && (
        <div className="card-sub" style={{ marginTop: "6px" }}>
          🔧 Pièce : {b.piece_a_commander_detail}
          {b.piece_date_commande ? ` — commandée le ${formatDateFr(b.piece_date_commande)}` : ""}
        </div>
      )}
      {b.date_planification_initiale && b.piece_a_commander && <div className="card-sub">🕓 1ère intervention le {formatDateFr(b.date_planification_initiale)} — reportée en attente de la pièce</div>}
      {tentatives.length > 0 && (
        <div className="client-tentatives">
          📵 <b>Locataire injoignable</b> — nos tentatives :{" "}
          {tentatives.map((x, i) => (
            <span key={i} className={`contact-tag contact-tag-${x.type}`}>
              {x.type === "appel" ? "📞 Appel" : "💬 SMS"} {formatDateFr(x.date)}
              {x.heure ? ` ${x.heure}` : ""}
            </span>
          ))}
        </div>
      )}
      {b.rappel_date && !b.date_intervention_terminee && <div className="card-sub">🔄 Prochain contact prévu le {formatDateFr(b.rappel_date)}</div>}
      {b.date_intervention_terminee && (
        <div className="card-sub" style={{ color: "var(--success)", fontWeight: 600, marginTop: "6px" }}>
          ✅ Réalisé le {formatDateFr(b.date_intervention_terminee)}
        </div>
      )}
    </li>
  );
}

/**
 * « Suivi de vos bons de commande » (ESP-01, `renderBonsCommandeClient`, app.js
 * l. 6668) : quatre tuiles qui comptent et filtrent, des cartes triées de ce
 * qui attend à ce qui est fait. Rien d'interne : ni montant, ni note, ni
 * conducteur — la vue ne les porte pas.
 */
export function PageBonsClient() {
  const bons = useBonsClient();
  const acces = useAccesClients();
  const [recherche, setRecherche] = useState("");
  const [couleur, setCouleur] = useState<CouleurBon | "">("");
  if (bons.isPending) return <Chargement />;
  if (bons.isError) return <Erreur erreur={bons.error} reessayer={() => void bons.refetch()} />;
  const trouves = chercherBonsClient(bons.data, recherche);
  const compte = (c: CouleurBon) => trouves.filter((b) => statutClientBon(b).cle === c).length;
  const visibles = trierBonsClient(couleur ? trouves.filter((b) => statutClientBon(b).cle === couleur) : trouves);
  const interlocuteurs = new Set(bons.data.map((b) => b.interlocuteur ?? ""));
  const societes = [...new Set(acces.map((a) => a.societeNom))].join(", ");

  return (
    <>
      <div className="page-head">
        <h1>Suivi de vos bons de commande</h1>
        <Link className="btn small ghost" to="/espace-client">
          Vos documents
        </Link>
      </div>
      <div className="card-sub" style={{ marginBottom: "14px" }}>
        {acces.map((a) => a.clientNom).join(", ")}
        {societes ? ` · Suivi en temps réel par ${societes}.` : ""}
      </div>
      <input
        type="text"
        aria-label="Rechercher un bon"
        value={recherche}
        placeholder="🔍 Rechercher : n° BC, adresse, n° de logement, locataire, nature des travaux…"
        onChange={(e) => setRecherche(e.target.value)}
        style={{ width: "100%", marginBottom: "14px" }}
      />
      <div role="group" aria-label="Avancement" className="client-tuiles">
        {TUILES.map((t) => (
          <button
            key={t.cle}
            type="button"
            aria-pressed={couleur === t.cle}
            className={`client-tuile ${couleur === t.cle ? "client-tuile-active" : ""}`}
            style={{ "--tc": TEINTE[t.cle].couleur, "--tf": TEINTE[t.cle].fond } as CSSProperties}
            onClick={() => setCouleur(couleur === t.cle ? "" : t.cle)}
          >
            {TEINTE[t.cle].emoji} {t.libelle}
            <b>{compte(t.cle)}</b>
          </button>
        ))}
      </div>
      {visibles.length === 0 ? (
        <div className="empty">Aucun bon de commande{couleur ? " dans cette catégorie" : ""}.</div>
      ) : (
        <ul aria-label="Bons de commande" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {visibles.map((b) => (
            <CarteBon key={b.id} bon={b} unSeulInterlocuteur={interlocuteurs.size <= 1} />
          ))}
        </ul>
      )}
    </>
  );
}
