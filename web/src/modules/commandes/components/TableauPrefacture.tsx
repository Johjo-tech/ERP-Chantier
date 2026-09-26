import { Fragment, useContext } from "react";
import { somme } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { ligneVide, type LigneEdition } from "@/modules/documents/domain/lignes";
import { memeMetier, METIER_AUCUN, metierAffiche, metierChoisi, montantsParMetier } from "../domain/metiers";
import { badgeOrigine, metierDuTravail, placerTravaux, UNITE_DEFAUT, type LigneDocument, type SaisieTravail, type TacheDuTravail, type Travail } from "../domain/prefacture";
import { MetiersConnus } from "./metiersConnus";

interface Props {
  lignes: readonly LigneEdition[];
  onLignes: (l: LigneEdition[]) => void;
  travaux: readonly Travail[];
  taches: readonly TacheDuTravail[];
  saisies: Readonly<Record<string, SaisieTravail>>;
  onSaisie: (id: string, s: SaisieTravail) => void;
  /** Le document fusionné : il fait le total et les sous-totaux par métier. */
  document: readonly LigneDocument[];
  tvaDefaut: number;
  /** Le chiffrage des travaux suit `peut_ecrire()` (D-BC-06). */
  chiffrageTravaux: boolean;
  desactive: boolean;
}

/** Le métier d'un chapitre (`metierPrefactureHTML`) : le métier lu sur le titre est présélectionné, en retrait. */
function MetierDuChapitre({ ligne, onChange, desactive }: { ligne: LigneEdition; onChange: (m: string | null) => void; desactive: boolean }) {
  const connus = useContext(MetiersConnus);
  const vu = metierAffiche(ligne, connus);
  const noms = vu.valeur && !memeMetier(vu.valeur, METIER_AUCUN) && !connus.some((n) => memeMetier(n, vu.valeur)) ? [vu.valeur, ...connus] : connus;
  const classes = ["chapitre-metier", vu.devine ? "est-deduit" : "", vu.certitude === "approchant" ? "est-approchant" : ""].filter(Boolean).join(" ");
  const titre = vu.devine ? (vu.valeur ? "Lu sur le titre du chapitre — choisissez pour le figer" : "Aucun métier reconnu dans ce titre") : "Métier choisi pour ce chapitre";
  return (
    <select className={classes} title={titre} aria-label="Métier du chapitre" value={vu.valeur} disabled={desactive} onChange={(e) => onChange(metierChoisi(e.target.value))}>
      <option value="">— Déduit du titre —</option>
      <option value={METIER_AUCUN}>— Aucun métier —</option>
      {noms.map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  );
}

/** Une ligne de travail supplémentaire (`ligneTravailDirecteurHTML`) : liseré ambre, étiquette d'origine, quantité, unité, prix. */
function LigneTravail({ t, metier, saisie, onSaisie, actif }: { t: Travail; metier: string | null; saisie: SaisieTravail | undefined; onSaisie: Props["onSaisie"]; actif: boolean }) {
  const s = saisie ?? { quantite: String(t.quantite ?? 1), unite: t.unite || UNITE_DEFAUT, prix: t.prix_vente_ht == null ? "" : String(t.prix_vente_ht) };
  const maj = (champ: keyof SaisieTravail, v: string) => onSaisie(t.id, { ...s, [champ]: v });
  const manquant = t.statut !== "chiffre" && !s.prix;
  return (
    <tr className={`p-ajout ${manquant ? "p-sans-prix" : ""}`}>
      <td className="pf-col-metier card-sub">{metier ?? <span style={{ opacity: 0.5 }}>—</span>}</td>
      <td className="pf-col-code" />
      <td><div className="row-mic"><span className="drag-handle" title="Glisser dans une ligne du bon pour l'y intégrer">⠿</span><span>{t.libelle || "—"} <span className="p-badge-origine">{badgeOrigine(t.origine)}</span></span></div></td>
      <td className="num pf-col-qte">
        <div className="pf-qte">
          <input type="number" step="0.01" min="0" aria-label={`Quantité de « ${t.libelle} »`} value={s.quantite.replace(",", ".")} disabled={!actif} onChange={(e) => maj("quantite", e.target.value)} />
          <input type="text" aria-label="Unité" value={s.unite} disabled={!actif} onChange={(e) => maj("unite", e.target.value)} />
        </div>
      </td>
      <td className="num pf-col-pu"><input type="number" step="0.01" min="0" aria-label={`Prix unitaire HT de « ${t.libelle} »`} value={s.prix.replace(",", ".")} placeholder="prix" disabled={!actif} onChange={(e) => maj("prix", e.target.value)} /></td>
      <td />
    </tr>
  );
}

/** Ce que chaque métier pèse (`sousTotauxMetiersHTML`), sur le document fusionné, dès deux groupes. */
function SousTotaux({ document }: { document: readonly LigneDocument[] }) {
  useModeDiscret();
  const connus = useContext(MetiersConnus);
  const groupes = montantsParMetier(document, connus);
  if (groupes.length < 2) return null;
  const total = somme(groupes.map((g) => g.montantHt));
  return (
    <div className="pf-sous-totaux">
      <div className="section-title" style={{ margin: "14px 0 6px" }}>Sous-total par métier</div>
      <table className="lignes-table">
        <tbody>
          {groupes.map((g) => (
            <tr key={g.metier ?? "sans"}>
              <td>{g.metier ? <span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent-2)" }}>{g.metier}</span> : <span className="card-sub">Hors chapitre nommé</span>}</td>
              <td className="card-sub">{g.nbLignes} ligne{g.nbLignes > 1 ? "s" : ""}</td>
              <td className="num mono" style={{ fontWeight: 600 }}>{formatEurosEcran(g.montantHt)} HT</td>
            </tr>
          ))}
          <tr><td colSpan={2} style={{ fontWeight: 700 }}>Total HT</td><td className="num mono" style={{ fontWeight: 700 }}>{formatEurosEcran(total)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * Le tableau des prix de la pré-facture (`chiffrageDirecteurHTML`) : chaque
 * ligne du bon se saisit — code, désignation, quantité et unité, prix —, le
 * métier se lit sur son chapitre et se choisit SUR le chapitre, et chaque
 * travail constaté vient à la suite du chapitre de son métier ; le reste sous
 * « Travaux supplémentaires constatés sur le chantier ».
 */
export function TableauPrefacture({ lignes, onLignes, travaux, taches, saisies, onSaisie, document, tvaDefaut, chiffrageTravaux, desactive }: Props) {
  useModeDiscret();
  const connus = useContext(MetiersConnus);
  const placement = placerTravaux(lignes, travaux, taches, connus);
  const maj = (i: number, champs: Partial<LigneEdition>) => onLignes(lignes.map((l, j) => (j === i ? { ...l, ...champs } : l)));
  const retirer = (i: number) => onLignes(lignes.filter((_, j) => j !== i));
  const ajouter = (type: LigneEdition["type"]) => onLignes([...lignes, ligneVide(tvaDefaut, type)]);
  const suite = (i: number) => (placement.apres.get(i) ?? []).map((t) => <LigneTravail key={t.id} t={t} metier={metierDuTravail(t, taches)} saisie={saisies[t.id]} onSaisie={onSaisie} actif={chiffrageTravaux} />);
  // Le chapitre qui couvre chaque ligne : le métier d'une ligne se lit sur lui.
  const chapitres = lignes.reduce<(LigneEdition | null)[]>((acc, l, i) => [...acc, l.type === "chapitre" ? l : (acc[i - 1] ?? null)], []);
  const rangs = lignes.map((l, i) => {
    const chapitre = chapitres[i] ?? null;
    if (l.type !== "ligne") {
      const allure = l.type === "chapitre" ? { fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".4px", color: "#C24E00" } : { fontStyle: "italic" as const, color: "#6B7686" };
      return (
        <Fragment key={l.cle}>
          <tr className={`dnd-row ${l.type === "chapitre" ? "p-chapitre" : "p-comment"}`}>
            <td className="pf-col-metier">{l.type === "chapitre" && <MetierDuChapitre ligne={l} desactive={desactive} onChange={(m) => maj(i, { metier: m })} />}</td>
            <td colSpan={4}><div className="row-mic"><span className="drag-handle" title="Déplacer">⠿</span><input type="text" aria-label={l.type === "chapitre" ? "Titre du chapitre" : "Commentaire"} value={l.designation} placeholder={l.type === "chapitre" ? "Titre du chapitre" : "Commentaire (ni quantité ni prix)"} style={{ width: "100%", ...allure }} disabled={desactive} onChange={(e) => maj(i, { designation: e.target.value })} /></div></td>
            <td className="num"><button type="button" className="btn small danger" title="Retirer" disabled={desactive} onClick={() => retirer(i)}>✕</button></td>
          </tr>
          {suite(i)}
        </Fragment>
      );
    }
    const vu = chapitre ? metierAffiche({ type: "chapitre", designation: chapitre.designation, metier: chapitre.metier }, connus) : { valeur: "" };
    const manquant = !(Number(l.prix_unitaire.replace(",", ".")) > 0);
    return (
      <Fragment key={l.cle}>
        <tr className={`dnd-row ${manquant ? "p-sans-prix" : ""}`}>
          <td className="pf-col-metier card-sub" title="Métier du chapitre auquel cette ligne appartient">{vu.valeur || <span style={{ opacity: 0.5 }}>—</span>}</td>
          <td className="pf-col-code"><div className="pf-code-pick"><input type="text" className="art-pick" aria-label={`Code, ligne ${i + 1}`} value={l.article_reference} placeholder="Code…" autoComplete="off" title="Tapez un code ou un mot de la désignation" disabled={desactive} onChange={(e) => maj(i, { article_reference: e.target.value })} /></div></td>
          <td><div className="row-mic"><span className="drag-handle" title="Déplacer">⠿</span><input type="text" aria-label={`Désignation, ligne ${i + 1}`} value={l.designation} placeholder="Désignation" style={{ width: "100%" }} disabled={desactive} onChange={(e) => maj(i, { designation: e.target.value })} /></div></td>
          <td className="num pf-col-qte">
            <div className="pf-qte">
              <input type="number" step="0.01" min="0" aria-label={`Quantité, ligne ${i + 1}`} value={l.quantite.replace(",", ".")} disabled={desactive} onChange={(e) => maj(i, { quantite: e.target.value })} />
              <input type="text" aria-label="Unité" value={l.unite || UNITE_DEFAUT} disabled={desactive} onChange={(e) => maj(i, { unite: e.target.value })} />
            </div>
          </td>
          <td className="num pf-col-pu"><input type="number" step="0.01" min="0" aria-label={`Prix unitaire HT, ligne ${i + 1}`} value={l.prix_unitaire.replace(",", ".")} placeholder="prix" disabled={desactive} onChange={(e) => maj(i, { prix_unitaire: e.target.value })} /></td>
          <td className="num"><button type="button" className="btn small danger" title="Retirer" disabled={desactive} onClick={() => retirer(i)}>✕</button></td>
        </tr>
        {suite(i)}
      </Fragment>
    );
  });
  return (
    <>
      <table className="lignes-table pf-table" style={{ marginTop: "8px" }} aria-label="Document de facturation">
        <thead>
          <tr>
            <th className="pf-col-metier">Métier</th>
            <th className="pf-col-code">Code</th>
            <th>Désignation</th>
            <th className="num">Qté / unité</th>
            <th className="num">Prix U. HT</th>
            <th />
          </tr>
        </thead>
        <tbody id="validationDirecteurLignes">
          {rangs.length ? rangs : <tr><td colSpan={6} className="card-sub">Ce bon de commande n&apos;a aucune ligne. Ajoutez-les ci-dessous.</td></tr>}
        </tbody>
        {placement.restants.length > 0 && (
          <tbody>
            <tr className="p-chapitre"><td colSpan={6}>Travaux supplémentaires constatés sur le chantier</td></tr>
            {placement.restants.map((t) => <LigneTravail key={t.id} t={t} metier={null} saisie={saisies[t.id]} onSaisie={onSaisie} actif={chiffrageTravaux} />)}
          </tbody>
        )}
      </table>
      <div id="validationDirecteurParMetier"><SousTotaux document={document} /></div>
      {!desactive && (
        <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
          <button type="button" className="btn small" onClick={() => ajouter("ligne")}>+ Ligne</button>
          <button type="button" className="btn small" onClick={() => ajouter("chapitre")}>+ Chapitre</button>
          <button type="button" className="btn small" onClick={() => ajouter("commentaire")}>+ Commentaire</button>
        </div>
      )}
    </>
  );
}
