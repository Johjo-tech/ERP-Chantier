import { useState } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { correspond } from "@/lib/recherche";
import type { BonDeLaListe } from "../api/bons";
import { champsCherchesDuBon } from "../domain/filtres";
import { parFournisseur, SANS_FOURNISSEUR } from "../domain/pieces";
import { useBons } from "../hooks/useBons";
import { CarteBon } from "./CarteBon";
import { useLiensDesBons } from "../hooks/useLiensDesBons";

/** La barre de recherche des listings de l'ancien (`barreRecherche`), avec son compteur « 3 sur 12 ». */
function BarreRecherche({ cle, placeholder, valeur, onChange, compte }: { cle: string; placeholder: string; valeur: string; onChange: (v: string) => void; compte: string }) {
  return (
    <div className="barre-recherche">
      <input type="search" id={`recherche-${cle}`} aria-label={placeholder} value={valeur} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {compte && <span className="compteur-resultats">{compte}</span>}
    </div>
  );
}

/** « 📦 À commander » et son compteur, comme les titres de section de l'ancien. */
function TitreSection({ libelle, n, marge }: { libelle: string; n: number; marge?: boolean }) {
  return (
    <div className="section-title-row" style={marge ? { marginTop: "24px" } : undefined}>
      <span className="section-title" style={{ margin: 0 }}>
        {libelle} {n > 0 && <span className="dossier-badge" style={{ marginLeft: "6px" }}>{n}</span>}
      </span>
    </div>
  );
}

interface Cartes {
  ouverte: string | null;
  basculer: (id: string) => void;
  lienOuvert: string | null;
  setLienOuvert: (id: string | null) => void;
  liensDe: ReturnType<typeof useLiensDesBons>;
  employes: readonly string[];
}

function Carte({ bon, c }: { bon: BonDeLaListe; c: Cartes }) {
  return (
    <CarteBon
      bon={bon}
      contexte="pieceCommande"
      ouverte={c.ouverte === bon.id}
      onBasculer={() => c.basculer(bon.id)}
      liens={c.liensDe(bon)}
      lienOuvert={c.lienOuvert === bon.id}
      onLien={(o) => c.setLienOuvert(o ? bon.id : null)}
      recherche={{ requete: "", apports: [] }}
      fournisseursEmployes={c.employes}
    />
  );
}

/** Les commandées, en dossiers par fournisseur (`renderDossiersFournisseurs`) : un seul ouvert à la fois. */
function Dossiers({ bons, c }: { bons: readonly BonDeLaListe[]; c: Cartes }) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const dossiers = parFournisseur(bons.map((b) => ({ ...b.circuit.piece, bon: b })));
  return (
    <>
      {dossiers.map((d) => {
        const estOuvert = ouvert === d.fournisseur;
        const apercu = d.pieces.map((p) => p.description || p.bon.numero_bc).filter(Boolean).join(", ");
        return (
          <div key={d.fournisseur} className="dossier-client">
            <div className="dossier-header" role="button" tabIndex={0} aria-expanded={estOuvert} onClick={() => setOuvert(estOuvert ? null : d.fournisseur)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOuvert(estOuvert ? null : d.fournisseur); } }}>
              <span className="dossier-icon">{estOuvert ? "📂" : "📁"}</span>
              <span className="dossier-nom">{d.fournisseur}</span>
              <span className="dossier-badge">{d.pieces.length}</span>
              {!estOuvert && <span className="dossier-apercu">{apercu}</span>}
              <span className="dossier-chevron">{estOuvert ? "▲" : "▼"}</span>
            </div>
            {estOuvert && <div className="dossier-contenu">{d.pieces.map((p) => <Carte key={p.bon.id} bon={p.bon} c={c} />)}</div>}
          </div>
        );
      })}
    </>
  );
}

/**
 * « Pièces en commande » (`renderPiecesCommande`) : les bons dont une tâche
 * attend une pièce, en deux temps de la même pièce — à commander, puis
 * commandées et rangées par fournisseur. Une seule recherche pour les deux :
 * on cherche la pièce, pas son moment.
 */
export function PagePieces() {
  const bons = useBons();
  const [recherche, setRecherche] = useState("");
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [lienOuvert, setLienOuvert] = useState<string | null>(null);
  const toutes = (bons.data ?? []).filter((b) => b.circuit.piece.pieceACommander);
  const liensDe = useLiensDesBons(bons.data ?? []);
  const q = recherche.trim();
  const trouvees = toutes.filter((b) => correspond(q, ...champsCherchesDuBon(b), b.circuit.piece.description, b.circuit.piece.fournisseur || SANS_FOURNISSEUR));
  const aCommander = trouvees.filter((b) => !b.circuit.piece.dateCommande);
  const commandees = trouvees.filter((b) => b.circuit.piece.dateCommande);
  const employes = (bons.data ?? []).map((b) => b.circuit.piece.fournisseur).filter(Boolean);
  const c: Cartes = { ouverte, basculer: (id) => setOuverte(ouverte === id ? null : id), lienOuvert, setLienOuvert, liensDe, employes };
  const vide = (message: string, quoi: string) => <div className="empty">{q ? `Aucun ${quoi} ne correspond à la recherche.` : message}</div>;

  return (
    <>
      <EnTetePage titre="Pièces en commande" />
      <div className="card-sub" style={{ marginBottom: "14px" }}>
        Bons de commande pour lesquels un technicien a signalé une pièce à commander. Une fois la date de commande renseignée, la pièce est classée dans le dossier de son fournisseur.
      </div>
      <BarreRecherche cle="pieceCommande" placeholder="Rechercher : pièce, fournisseur, client, n° BC…" valeur={recherche} onChange={setRecherche} compte={q && trouvees.length !== toutes.length ? `${trouvees.length} sur ${toutes.length}` : ""} />
      <div id="liste-pieceCommande">
        {bons.isPending && <Chargement />}
        {bons.isError && <Erreur erreur={bons.error} reessayer={() => void bons.refetch()} />}
        {bons.isSuccess && (
          <>
            <TitreSection libelle="📦 À commander" n={aCommander.length} />
            <div>{aCommander.length ? aCommander.map((b) => <Carte key={b.id} bon={b} c={c} />) : vide("Aucune pièce en attente de commande.", "pièce à commander")}</div>
            <TitreSection libelle="🚚 Commandées — par fournisseur" n={commandees.length} marge />
            {commandees.length ? <Dossiers bons={commandees} c={c} /> : vide("Aucune pièce commandée pour l'instant.", "pièce commandée")}
          </>
        )}
      </div>
    </>
  );
}
