import { Fragment, useState, type DragEvent } from "react";
import { formatEuros } from "@/lib/money";
import { dupliquer, ligneVide, modifier, retirer, type ErreurLigne, type LigneEdition } from "../domain/lignes";
import { montantLigneHt, montantLigneTtc, sousTotauxChapitres } from "../domain/totaux";
import { useUnitesLignes } from "../hooks/useUnites";
import type { ChampReferenceLigne } from "./reference";

interface Props {
  lignes: LigneEdition[];
  onChange: (lignes: LigneEdition[]) => void;
  tvaDefaut: number;
  taux: readonly number[];
  unites?: readonly string[];
  erreurs?: readonly ErreurLigne[];
  /** Le choix d'article du catalogue, branché par app/ ; à défaut, le code se tape. */
  ChampReference?: ChampReferenceLigne | undefined;
  /** Le métier d'un chapitre, branché par le module qui connaît les métiers. */
  ChampMetier?: ChampReferenceLigne | undefined;
}

const versLigne = (l: LigneEdition) => ({ type: l.type, quantite: l.quantite, prix_unitaire: l.prix_unitaire, tva: l.tva });
/** Un champ `type="number"` n'affiche qu'un point décimal : la saisie garde la virgule, l'affichage la convertit. */
const pourChampNombre = (v: string) => v.replace(",", ".");
const nombreOuZero = (v: string) => {
  const n = Number(pourChampNombre(v));
  return Number.isFinite(n) ? n : 0;
};

/**
 * L'éditeur de lignes de l'ANCIEN écran (`ligneRowsHTML`, `ligneRow`,
 * `chapitreRow`, `commentaireRow` — app.js l. 2501 et 3200) : la table
 * `.lignes-table`, la poignée ⠿ qu'on glisse, le code article devant la
 * désignation, le 💬 qui déplie le commentaire, ⧉ et ✕, puis « + Ligne »,
 * « + Chapitre », « + Commentaire ». Les montants se lisent sur la règle des
 * totaux, jamais recalculés à part.
 */
export function LignesAncien({ lignes, onChange, tvaDefaut, taux, unites: imposees, erreurs = [], ChampReference, ChampMetier }: Props) {
  const referentiel = useUnitesLignes();
  const unites = imposees ?? referentiel;
  const [commentaireOuvert, setCommentaireOuvert] = useState<number | null>(null);
  const [glissee, setGlissee] = useState<number | null>(null);
  const sousTotaux = sousTotauxChapitres(lignes);
  const changer = (i: number, champ: keyof LigneEdition, v: string) => onChange(modifier(lignes, i, champ, v));
  const remplacer = (i: number) => (l: LigneEdition) => onChange(lignes.map((x, j) => (j === i ? l : x)));
  const invalide = (i: number, champ: ErreurLigne["champ"]) => {
    const e = erreurs.find((x) => x.index === i && x.champ === champ);
    return e ? { "aria-invalid": true, title: e.message } : {};
  };

  // Glisser-déposer de la poignée : la ligne prise se pose à la place de celle qu'on survole (`dropLigne`).
  const glisser = (i: number) => (e: DragEvent) => {
    setGlissee(i);
    e.dataTransfer.effectAllowed = "move";
  };
  const survoler = (e: DragEvent) => e.preventDefault();
  const deposer = (i: number) => (e: DragEvent) => {
    e.preventDefault();
    if (glissee === null || glissee === i) return;
    const copie = [...lignes];
    const [prise] = copie.splice(glissee, 1);
    if (prise) copie.splice(i, 0, prise);
    setGlissee(null);
    onChange(copie);
  };
  const poignee = (i: number) => <span className="drag-handle" draggable onDragStart={glisser(i)} title="Déplacer">⠿</span>;
  const actions = (i: number, quoi: string) => (
    <>
      <button type="button" className="btn small ghost" onClick={() => onChange(dupliquer(lignes, i))} title={`Dupliquer ${quoi}`}>⧉</button>{" "}
      <button type="button" className="btn small danger" onClick={() => onChange(retirer(lignes, i, tvaDefaut))} title={`Supprimer ${quoi}`}>✕</button>
    </>
  );

  // Le rang de chaque chapitre, pour lire son sous-total dans la liste de la règle.
  const rangChapitre = new Map<number, number>();
  lignes.forEach((l, i) => {
    if (l.type === "chapitre") rangChapitre.set(i, rangChapitre.size);
  });
  return (
    <>
      <table className="lignes-table">
        <thead>
          <tr>
            <th style={{ width: "36%" }}>Désignation</th>
            <th>Qté</th>
            <th>Unité</th>
            <th>Prix U. HT</th>
            <th>TVA</th>
            <th className="num">Total HT</th>
            <th className="num">Total TTC</th>
            <th />
          </tr>
        </thead>
        <tbody id="lignesBody">
          {lignes.map((l, i) => {
            const n = i + 1;
            if (l.type === "chapitre") {
              const total = sousTotaux[rangChapitre.get(i) ?? -1];
              return (
                <tr key={l.cle} className="row-chapitre dnd-row" onDragOver={survoler} onDrop={deposer(i)}>
                  <td colSpan={5}>
                    <div className="row-mic">
                      {poignee(i)}
                      <input type="text" className="chapitre-input" aria-label={`Titre du chapitre, ligne ${n}`} value={l.designation} placeholder="Titre du chapitre (ex. Plomberie, Main d'œuvre…)" onChange={(e) => changer(i, "designation", e.target.value)} {...invalide(i, "designation")} />
                      {ChampMetier && <ChampMetier ligne={l} index={i} remplacer={remplacer(i)} desactive={false} />}
                    </div>
                  </td>
                  <td className="mono" style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{total ? `${formatEuros(total)} HT` : ""}</td>
                  <td />
                  <td className="ligne-actions">{actions(i, "ce chapitre")}</td>
                </tr>
              );
            }
            if (l.type === "commentaire") {
              return (
                <tr key={l.cle} className="row-commentaire dnd-row" onDragOver={survoler} onDrop={deposer(i)}>
                  <td colSpan={7}>
                    <div className="row-mic">
                      {poignee(i)}
                      <textarea className="commentaire-input" rows={2} aria-label={`Commentaire, ligne ${n}`} value={l.designation} placeholder="Commentaire / remarque (non chiffré)" onChange={(e) => changer(i, "designation", e.target.value)} />
                    </div>
                  </td>
                  <td className="ligne-actions">{actions(i, "ce commentaire")}</td>
                </tr>
              );
            }
            const aCommentaire = l.commentaire.trim() !== "";
            const ouvert = aCommentaire || commentaireOuvert === i;
            const tauxLigne = nombreOuZero(l.tva);
            // Un taux enregistré autrefois peut ne plus figurer dans la liste des réglages : il reste proposé.
            const tauxProposes = taux.includes(tauxLigne) ? taux : [...taux, tauxLigne].sort((a, b) => a - b);
            const unitesProposees = l.unite && !unites.includes(l.unite) ? [l.unite, ...unites] : unites;
            return (
              <Fragment key={l.cle}>
                <tr className="dnd-row" onDragOver={survoler} onDrop={deposer(i)}>
                  <td>
                    <div className="row-mic">
                      {poignee(i)}
                      <div className="art-pick-hote" style={{ position: "relative", flexShrink: 0 }}>
                        {ChampReference ? (
                          <ChampReference ligne={l} index={i} remplacer={remplacer(i)} desactive={false} />
                        ) : (
                          <input type="text" className="art-pick" aria-label={`Code article, ligne ${n}`} placeholder="Code…" autoComplete="off" title="Tapez un code ou un mot de la désignation" value={l.article_reference} onChange={(e) => changer(i, "article_reference", e.target.value)} />
                        )}
                      </div>
                      <input type="text" aria-label={`Désignation, ligne ${n}`} value={l.designation} onChange={(e) => changer(i, "designation", e.target.value)} {...invalide(i, "designation")} />
                    </div>
                  </td>
                  <td>
                    <input type="number" min="0" step="1" aria-label={`Quantité, ligne ${n}`} value={pourChampNombre(l.quantite)} style={{ width: "60px" }} onChange={(e) => changer(i, "quantite", e.target.value)} {...invalide(i, "quantite")} />
                  </td>
                  <td>
                    <select aria-label={`Unité, ligne ${n}`} value={l.unite} onChange={(e) => changer(i, "unite", e.target.value)}>
                      {unitesProposees.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td>
                    <input type="number" min="0" step="0.01" aria-label={`Prix unitaire HT, ligne ${n}`} value={pourChampNombre(l.prix_unitaire)} style={{ width: "90px" }} onChange={(e) => changer(i, "prix_unitaire", e.target.value)} {...invalide(i, "prix_unitaire")} />
                  </td>
                  <td>
                    <select aria-label={`TVA, ligne ${n}`} value={String(tauxLigne)} onChange={(e) => changer(i, "tva", e.target.value)}>
                      {tauxProposes.map((t) => <option key={t} value={String(t)}>{`${String(t)}%`}</option>)}
                    </select>
                  </td>
                  <td className="num mono" style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{formatEuros(montantLigneHt(versLigne(l)))}</td>
                  <td className="num mono" style={{ whiteSpace: "nowrap", color: "var(--text-dim)" }}>{formatEuros(montantLigneTtc(versLigne(l)))}</td>
                  <td className="ligne-actions">
                    <button type="button" className={aCommentaire ? "btn small primary" : "btn small ghost"} onClick={() => setCommentaireOuvert(commentaireOuvert === i ? null : i)} title={aCommentaire ? "Modifier le commentaire" : "Ajouter un commentaire"}>💬</button>{" "}
                    {actions(i, "cette ligne")}
                  </td>
                </tr>
                {ouvert && (
                  <tr className="row-ligne-comment">
                    <td colSpan={7}>
                      <textarea rows={2} aria-label={`Commentaire de la ligne ${n}`} placeholder="Commentaire (optionnel, plusieurs lignes possibles)…" value={l.commentaire} onChange={(e) => changer(i, "commentaire", e.target.value)} />
                    </td>
                    <td className="ligne-actions">
                      {aCommentaire && <button type="button" className="btn small ghost" title="Retirer le commentaire" onClick={() => { changer(i, "commentaire", ""); setCommentaireOuvert(null); }}>✕</button>}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
        <button type="button" className="btn small" onClick={() => onChange([...lignes, ligneVide(tvaDefaut)])}>+ Ligne</button>
        <button type="button" className="btn small" onClick={() => onChange([...lignes, ligneVide(tvaDefaut, "chapitre")])}>+ Chapitre</button>
        <button type="button" className="btn small" onClick={() => onChange([...lignes, ligneVide(tvaDefaut, "commentaire")])}>+ Commentaire</button>
      </div>
    </>
  );
}

