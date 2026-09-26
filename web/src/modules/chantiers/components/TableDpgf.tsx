import { Link } from "react-router";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import type { TachePlanifiee } from "../api/planification";
import { estFactureeEntierement } from "../domain/dpgf";
import { quantiteDejaPlanifiee } from "../domain/planification";
import type { BrouillonLigneDpgf } from "../domain/saisie-dpgf";

/** Une ligne telle que le tableau la montre : son brouillon, et — si elle est en base — ce que la base en dit. */
export interface LigneAffichee {
  brouillon: BrouillonLigneDpgf;
  enBase: {
    avancement_cumule: number;
    devis_source_id: string | null;
    quantite: number;
    prix_unitaire: number;
    metier: string | null;
  } | null;
}

type Champ = "designation" | "quantite" | "prix_unitaire" | "metier";

interface Props {
  id: string;
  lignes: readonly LigneAffichee[];
  changer: (id: string, champ: Champ, valeur: string) => void;
  erreurs: Record<string, string>;
  selection: ReadonlySet<string>;
  basculer: (id: string) => void;
  taches: readonly TachePlanifiee[];
  metiers: readonly string[];
  devisSource: ReadonlyMap<string, string>;
  onPlanifier: (id: string) => void;
  onRetirer: (id: string) => void;
}

/** Le tableau du DPGF chiffré de l'ancien (`chantierDpgfLigneRowsHTML`), modifiable en place (CHA-06, CHA-07). */
export function TableDpgf(p: Props) {
  useModeDiscret();
  return (
    <table className="lignes-table" id={p.id}>
      <thead>
        <tr>
          <th style={{ width: "26px" }}>
            <span className="sr-only">Sélection</span>
          </th>
          <th style={{ width: "32%" }}>Désignation</th>
          <th>Qté</th>
          <th>Prix U. HT</th>
          <th>Montant HT</th>
          <th>Déjà facturé</th>
          <th>Métier</th>
          <th>Planning</th>
          <th>
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {p.lignes.length === 0 ? (
          <tr>
            <td colSpan={9} className="empty">
              Aucune ligne pour l'instant.
            </td>
          </tr>
        ) : (
          p.lignes.map((l) => (l.brouillon.type === "ligne" ? <Ligne key={l.brouillon.id} l={l} {...p} /> : <Titre key={l.brouillon.id} l={l} {...p} />))
        )}
      </tbody>
    </table>
  );
}

function BoutonRetirer({ onClick, libelle }: { onClick: () => void; libelle: string }) {
  useModeDiscret();
  return (
    <button type="button" className="btn small danger" aria-label={libelle} onClick={onClick}>
      ✕
    </button>
  );
}

function Titre({ l, changer, onRetirer }: Props & { l: LigneAffichee }) {
  useModeDiscret();
  const b = l.brouillon;
  return (
    <tr className="ligne-chapitre-row">
      <td />
      <td colSpan={7}>
        <input
          type="text"
          aria-label="Titre du chapitre"
          value={b.designation}
          placeholder="Titre du chapitre"
          style={{ fontWeight: b.type === "chapitre" ? 700 : 400, fontStyle: b.type === "chapitre" ? "normal" : "italic" }}
          onChange={(e) => changer(b.id, "designation", e.target.value)}
        />
      </td>
      <td>
        <BoutonRetirer libelle="Retirer ce titre" onClick={() => onRetirer(b.id)} />
      </td>
    </tr>
  );
}

function Ligne({ l, changer, erreurs, selection, basculer, taches, metiers, devisSource, onPlanifier, onRetirer }: Props & { l: LigneAffichee }) {
  useModeDiscret();
  const b = l.brouillon;
  const base = l.enBase;
  const complete = base ? estFactureeEntierement(base) : false;
  const siennes = base ? taches.filter((t) => t.dpgf_ligne_id === b.id) : [];
  const deja = quantiteDejaPlanifiee(siennes);
  const total = montant(b.quantite);
  const numeroDevis = base?.devis_source_id ? devisSource.get(base.devis_source_id) : undefined;
  const erreur = (champ: string) => erreurs[`${b.id}.${champ}`];
  const metiersProposes = [...new Set([...metiers, ...(b.metier ? [b.metier] : [])])];
  return (
    <tr className={`dpgf-ligne-row${complete ? " is-complete" : ""}`}>
      <td>
        <input
          type="checkbox"
          className="dpgf-ligne-select"
          aria-label={`Sélectionner ${b.designation || "la ligne"} pour facturer`}
          checked={selection.has(b.id)}
          disabled={complete || !base}
          title={complete ? "Déjà facturé à 100%" : "Sélectionner pour facturer"}
          onChange={() => basculer(b.id)}
        />
      </td>
      <td>
        <input type="text" aria-label="Désignation" aria-invalid={!!erreur("designation")} value={b.designation} placeholder="Désignation" onChange={(e) => changer(b.id, "designation", e.target.value)} />
        {numeroDevis && (
          <span className="dpgf-devis-source-badge" title={`Ajoutée depuis le devis ${numeroDevis}`}>
            📄 {numeroDevis}
          </span>
        )}
      </td>
      <td>
        <input
          type="number"
          step="0.01"
          aria-label="Quantité"
          aria-invalid={!!erreur("quantite")}
          style={{ width: "70px" }}
          value={b.quantite}
          disabled={b.figee}
          onChange={(e) => changer(b.id, "quantite", e.target.value)}
        />
      </td>
      <td>
        <input
          type="number"
          step="0.01"
          aria-label="Prix unitaire HT"
          aria-invalid={!!erreur("prix_unitaire")}
          style={{ width: "90px" }}
          value={b.prix_unitaire}
          disabled={b.figee}
          onChange={(e) => changer(b.id, "prix_unitaire", e.target.value)}
        />
      </td>
      <td>{formatEurosEcran(montant(b.quantite).times(montant(b.prix_unitaire)))}</td>
      <td>{montant(base?.avancement_cumule ?? 0).toFixed(0)}%</td>
      <td>
        <select aria-label="Métier" style={{ width: "auto", fontSize: "11px" }} value={b.metier} onChange={(e) => changer(b.id, "metier", e.target.value)}>
          <option value="">— Non précisé —</option>
          {metiersProposes.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </td>
      <td>
        {siennes.length > 0 && (
          <>
            <div className="dpgf-planif-progress" title={`${deja.toString()}/${total.toString()} planifié`}>
              {deja.toString()}/{total.toString()}
            </div>
            <div className="dpgf-planif-taches">
              {siennes.map((t) =>
                t.bon_commande_id ? (
                  <Link key={t.id} className="btn small" to={`/commandes/${t.bon_commande_id}`} title="Voir le bon de commande">
                    ✅ {String(t.quantite_planifiee ?? 0)}
                  </Link>
                ) : null
              )}
            </div>
          </>
        )}
        {base && total.gt(0) && total.gt(deja) && (
          <button type="button" className="btn small primary" onClick={() => onPlanifier(b.id)}>
            📅 Planifier
          </button>
        )}
      </td>
      <td>{!b.figee && <BoutonRetirer libelle={`Retirer ${b.designation || "la ligne"}`} onClick={() => onRetirer(b.id)} />}</td>
    </tr>
  );
}
