import { useState } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { BarreRecherche } from "@/components/ui/barre-recherche";
import { messageErreur } from "@/lib/erreurs";
import { correspond } from "@/lib/recherche";
import { afficherToast } from "@/lib/toast";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { useDefilerVersFormulaire } from "@/modules/materiel/components/communs";
import type { Metier } from "../api/listes";
import { echange, ordonner, PALETTE_METIERS, prochainePosition, schemaSaisieMetier } from "../domain/listes";
import { useEcrireMetiers, useMetiers } from "../hooks/useReglagesEcran";

type Edition = Metier | "nouveau" | null;

/**
 * Les métiers (PAR-05), au HTML de `renderMetiersSection` (app.js l. 17801) :
 * couleur choisie dans la palette, position, et deux règles tenues par la base
 * — suppression refusée si le métier est employé (le motif de la base se dit
 * dans la bulle), renommage propagé partout sauf dans les factures émises.
 */
export function ListeMetiers() {
  const metiers = useMetiers();
  const ecrire = useEcrireMetiers();
  const modifiable = usePermission("reglages", "modifier");
  const [recherche, setRecherche] = useState("");
  const [edition, setEdition] = useState<Edition>(null);

  const liste = metiers.data ? ordonner(metiers.data) : [];
  const affiches = liste.filter((m) => correspond(recherche, m.libelle));
  const deplacer = (m: Metier, sens: -1 | 1) => {
    const p = echange(liste, m.id, sens);
    if (p) ecrire.placer.mutate(p, { onError: (e) => afficherToast(messageErreur(e)) });
  };

  return (
    <>
      <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "30px" }}>
        <span>Métiers</span>
        {modifiable && (
          <button type="button" className="btn small primary" onClick={() => setEdition("nouveau")}>
            + Nouveau métier
          </button>
        )}
      </div>
      <BarreRecherche id="metierPerso" libelle="Rechercher un métier" valeur={recherche} onChange={setRecherche} placeholder="Rechercher un métier…" affiches={affiches.length} total={liste.length} />
      <div id="formZoneMetierPerso">
        {edition && <FormulaireMetier key={edition === "nouveau" ? "nouveau" : edition.id} metier={edition === "nouveau" ? null : edition} position={prochainePosition(liste)} onFermer={() => setEdition(null)} />}
      </div>
      <div id="liste-metierPerso">
        {metiers.isPending && <Chargement />}
        {metiers.isError && <Erreur erreur={metiers.error} reessayer={() => void metiers.refetch()} />}
        {metiers.isSuccess && affiches.length === 0 && <div className="empty">{recherche.trim() ? "Aucun métier ne correspond à la recherche." : "Aucun métier enregistré pour cette société."}</div>}
        {affiches.map((m, i) => (
          <div key={m.id} className="card">
            <div className="card-row">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "16px", height: "16px", borderRadius: "4px", background: m.couleur ?? "#999", flexShrink: 0, border: "1px solid rgba(0,0,0,.1)" }} />
                <div className="card-title">{m.libelle}</div>
              </div>
            </div>
            {modifiable && (
              <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
                <button type="button" className="btn small ghost" title="Monter" aria-label={`Monter ${m.libelle}`} disabled={i === 0} onClick={() => deplacer(m, -1)}>
                  ▲
                </button>
                <button type="button" className="btn small ghost" title="Descendre" aria-label={`Descendre ${m.libelle}`} disabled={i === affiches.length - 1} onClick={() => deplacer(m, 1)}>
                  ▼
                </button>
                <button type="button" className="btn small" onClick={() => setEdition(m)}>
                  Modifier
                </button>
                <button
                  type="button"
                  className="btn small danger"
                  title="Un métier employé par des bons, des tâches ou des lignes ne peut pas être supprimé : renommez-le, le nouveau nom suivra partout."
                  onClick={() => {
                    if (window.confirm("Supprimer définitivement cet élément ?")) ecrire.supprimer.mutate(m.id, { onError: (e) => afficherToast(messageErreur(e), "error", DUREE_REFUS_MS) });
                  }}
                >
                  Supprimer
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/** Le motif de refus que la base écrit est long : l'ancien le laissait huit secondes (`deleteItem`). */
const DUREE_REFUS_MS = 8000;

/** `metierPersoForm` (app.js l. 17875) : le nom et la palette de pastilles. */
function FormulaireMetier({ metier, position, onFermer }: { metier: Metier | null; position: number; onFermer: () => void }) {
  const ecrire = useEcrireMetiers();
  const [libelle, setLibelle] = useState(metier?.libelle ?? "");
  const [couleur, setCouleur] = useState<string>(metier?.couleur ?? PALETTE_METIERS[0]);
  useDefilerVersFormulaire("formZoneMetierPerso");

  function enregistrer() {
    const r = schemaSaisieMetier.safeParse({ libelle, couleur });
    if (!r.success) {
      window.alert("Le nom du métier est requis.");
      return;
    }
    const fini = { onSuccess: onFermer, onError: (e: unknown) => afficherToast(messageErreur(e)) };
    if (metier) ecrire.modifier.mutate({ id: metier.id, saisie: r.data }, fini);
    else ecrire.creer.mutate({ saisie: r.data, position }, fini);
  }

  return (
    <div className="form-panel">
      <h3>{metier ? "Modifier le métier" : "Nouveau métier"}</h3>
      <div className="field-grid">
        <div className="field full">
          <label htmlFor="mp_nom">Nom du métier</label>
          <input type="text" id="mp_nom" value={libelle} placeholder="Ex : Menuiserie, Serrurerie, Peinture…" onChange={(e) => setLibelle(e.target.value)} />
        </div>
        <div className="field full">
          <div className="reglage-titre">Couleur</div>
          <div className="metier-palette" role="group" aria-label="Couleur">
            {PALETTE_METIERS.map((c) => (
              <button key={c} type="button" className={`metier-swatch ${c === couleur ? "is-selected" : ""}`} style={{ background: c }} title={c} aria-label={c} aria-pressed={c === couleur} onClick={() => setCouleur(c)} />
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
        <button type="button" className="btn primary" disabled={ecrire.creer.isPending || ecrire.modifier.isPending} onClick={enregistrer}>
          Enregistrer
        </button>
        <button type="button" className="btn ghost" onClick={onFermer}>
          Annuler
        </button>
      </div>
    </div>
  );
}
