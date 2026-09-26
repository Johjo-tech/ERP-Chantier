import { useState, type ReactNode } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { BarreRecherche } from "@/components/ui/barre-recherche";
import { messageErreur } from "@/lib/erreurs";
import { correspond } from "@/lib/recherche";
import { afficherToast } from "@/lib/toast";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { useDefilerVersFormulaire } from "@/modules/materiel/components/communs";
import type { Entree } from "../api/listes";
import { CLES_DOMAINES, DOMAINES_LISTES, echange, ordonner, prochainePosition, schemaSaisieEntree, type DomaineListe } from "../domain/listes";
import { useEcrireEntrees, useEntrees } from "../hooks/useReglagesEcran";
import { ListeMetiers } from "./ListeMetiers";

type Onglet = "metiers" | DomaineListe;

/** `DOMAINES_REFERENTIEL.metiers` de l'ancien : la seule liste qui garde son propre écran. */
const METIERS = { titre: "Métiers", aide: "Les corps d'état de la société. Ils servent aux bons, aux tâches, aux équipes et aux sous-totaux par métier." };

/**
 * Les onglets et la phrase d'aide, communs à toutes les listes
 * (`ongletsReferentiel`, app.js l. 17688).
 */
function OngletsListes({ onglet, onChange }: { onglet: Onglet; onChange: (o: Onglet) => void }) {
  const onglets: { id: Onglet; titre: string }[] = [{ id: "metiers", titre: METIERS.titre }, ...CLES_DOMAINES.map((d) => ({ id: d, titre: DOMAINES_LISTES[d].titre }))];
  const aide = onglet === "metiers" ? METIERS.aide : DOMAINES_LISTES[onglet].aide;
  return (
    <>
      <div className="plus-subnav" role="tablist" aria-label="Listes" style={{ marginBottom: "12px", marginTop: "30px" }}>
        {onglets.map((o) => (
          <button key={o.id} type="button" role="tab" aria-selected={o.id === onglet} className={`plus-subnav-btn ${o.id === onglet ? "active" : ""}`} onClick={() => onChange(o.id)}>
            {o.titre}
          </button>
        ))}
      </div>
      <div className="card-sub" style={{ marginBottom: "12px" }}>
        {aide}
      </div>
    </>
  );
}

/** Les listes de choix de la société, une par onglet (`renderReferentielsSection`, app.js l. 17697) ; les métiers gardent leur écran (PAR-04, PAR-05). */
export function SectionListes() {
  const [onglet, setOnglet] = useState<Onglet>("metiers");
  if (onglet === "metiers") {
    return (
      <>
        <OngletsListes onglet={onglet} onChange={setOnglet} />
        <ListeMetiers />
      </>
    );
  }
  return <ListeReferentiel key={onglet} domaine={onglet} onglets={<OngletsListes onglet={onglet} onChange={setOnglet} />} />;
}

function ListeReferentiel({ domaine, onglets }: { domaine: DomaineListe; onglets: ReactNode }) {
  const def = DOMAINES_LISTES[domaine];
  const entrees = useEntrees();
  const ecrire = useEcrireEntrees();
  const modifiable = usePermission("reglages", "modifier");
  const [recherche, setRecherche] = useState("");
  const [edition, setEdition] = useState<Entree | "nouvelle" | null>(null);

  const liste = entrees.data ? ordonner(entrees.data.filter((e) => e.domaine === domaine)) : [];
  const affichees = liste.filter((e) => correspond(recherche, e.libelle, e.code));
  const deplacer = (e: Entree, sens: -1 | 1) => {
    const p = echange(liste, e.id, sens);
    if (p) ecrire.placer.mutate(p, { onError: (err) => afficherToast(messageErreur(err)) });
  };

  return (
    <>
      <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "30px" }}>
        <span>Listes de choix</span>
        {modifiable && (
          <button type="button" className="btn small primary" onClick={() => setEdition("nouvelle")}>
            + Nouvelle {def.singulier}
          </button>
        )}
      </div>
      {onglets}
      <BarreRecherche id="referentiel" libelle={`Rechercher dans ${def.titre}`} valeur={recherche} onChange={setRecherche} placeholder="Rechercher…" affiches={affichees.length} total={liste.length} />
      <div id="formZoneReferentiel">
        {edition && <FormulaireEntree key={edition === "nouvelle" ? "nouvelle" : edition.id} domaine={domaine} entree={edition === "nouvelle" ? null : edition} position={prochainePosition(liste)} onFermer={() => setEdition(null)} />}
      </div>
      <div id="liste-referentiel">
        {entrees.isPending && <Chargement />}
        {entrees.isError && <Erreur erreur={entrees.error} reessayer={() => void entrees.refetch()} />}
        {entrees.isSuccess && affichees.length === 0 && <div className="empty">{recherche.trim() ? "Aucun entrée ne correspond à la recherche." : "Aucune entrée dans cette liste."}</div>}
        {affichees.map((e, i) => (
          <div key={e.id} className="card">
            <div className="card-row">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {e.couleur && <span style={{ width: "16px", height: "16px", borderRadius: "4px", background: e.couleur, flexShrink: 0, border: "1px solid rgba(0,0,0,.1)" }} />}
                <div className="card-title">
                  {e.icone ? `${e.icone} ` : ""}
                  {e.libelle}
                </div>
              </div>
              {e.code && <span className="card-sub mono">{e.code}</span>}
            </div>
            {modifiable && (
              <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
                <button type="button" className="btn small ghost" title="Monter" aria-label={`Monter ${e.libelle}`} disabled={i === 0} onClick={() => deplacer(e, -1)}>
                  ▲
                </button>
                <button type="button" className="btn small ghost" title="Descendre" aria-label={`Descendre ${e.libelle}`} disabled={i === affichees.length - 1} onClick={() => deplacer(e, 1)}>
                  ▼
                </button>
                <button type="button" className="btn small" onClick={() => setEdition(e)}>
                  Modifier
                </button>
                <button
                  type="button"
                  className="btn small danger"
                  title="Les fiches qui portent cette valeur la gardent : elle continuera d'être proposée tant qu'une fiche l'emploie."
                  onClick={() => {
                    if (window.confirm("Supprimer définitivement cet élément ?")) ecrire.supprimer.mutate(e.id, { onError: (err) => afficherToast(messageErreur(err)) });
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

/** `referentielForm` (app.js l. 17745) : le libellé ; le code, posé par l'application, se lit sans se changer. */
function FormulaireEntree({ domaine, entree, position, onFermer }: { domaine: DomaineListe; entree: Entree | null; position: number; onFermer: () => void }) {
  const def = DOMAINES_LISTES[domaine];
  const ecrire = useEcrireEntrees();
  const [libelle, setLibelle] = useState(entree?.libelle ?? "");
  useDefilerVersFormulaire("formZoneReferentiel");

  function enregistrer() {
    const r = schemaSaisieEntree.safeParse({ libelle });
    if (!r.success) {
      window.alert("Le libellé est requis.");
      return;
    }
    const fini = { onSuccess: onFermer, onError: (e: unknown) => afficherToast(messageErreur(e)) };
    if (entree) ecrire.renommer.mutate({ id: entree.id, libelle: r.data.libelle }, fini);
    else ecrire.creer.mutate({ domaine, libelle: r.data.libelle, position }, fini);
  }

  return (
    <div className="form-panel">
      <h3>
        {entree ? "Modifier" : "Nouvelle"} {def.singulier} — {def.titre}
      </h3>
      <div className="field-grid">
        <div className="field full">
          <label htmlFor="ref_libelle">Libellé</label>
          <input type="text" id="ref_libelle" value={libelle} placeholder={`Ex : ${def.singulier === "unité" ? "m²" : "Échafaudage"}`} onChange={(e) => setLibelle(e.target.value)} />
        </div>
        {entree?.code && (
          <div className="field full">
            <div className="reglage-titre">Code interne</div>
            <div className="card-sub">
              <code>{entree.code}</code> — posé par l&apos;application, il ne se change pas : c&apos;est lui que l&apos;écran teste pour ouvrir les champs particuliers.
            </div>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
        <button type="button" className="btn primary" disabled={ecrire.creer.isPending || ecrire.renommer.isPending} onClick={enregistrer}>
          Enregistrer
        </button>
        <button type="button" className="btn ghost" onClick={onFermer}>
          Annuler
        </button>
      </div>
    </div>
  );
}
