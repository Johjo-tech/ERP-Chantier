import { useState, type FormEvent } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ChampTexte } from "@/components/formulaire/Champ";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { useDefilerVersFormulaire, useToastErreur } from "@/modules/materiel/components/communs";
import { libelleEquipe, membresDe, sansEquipe, schemaSaisieEquipe, valeursEquipe, type Equipe } from "../domain/intervenants";
import { nomComplet, type Salarie } from "../domain/salarie";
import { useMetiersRh, useDroitsRh, useEquipes, useGererIntervenants, useGererSalaries, useSalariesRh } from "../hooks/useRh";
import { CasesMetiers } from "./communs";

/**
 * Les équipes et leurs membres (RH-02), au HTML de `renderEquipesRH` (app.js
 * l. 15517). Une équipe est une ligne de `techniciens` ; ses membres sont les
 * salariés actifs dont « Équipe » la désigne. L'appartenance décide de qui peut
 * déclarer les travaux faits : un membre sans compte ne pointera jamais lui-même.
 */
export function OngletEquipes() {
  const equipes = useEquipes();
  const salaries = useSalariesRh();
  const droits = useDroitsRh();
  const gerer = useGererIntervenants();
  const rattacher = useGererSalaries().equipe;
  useToastErreur(gerer.supprimerEquipe.error ?? rattacher.error);
  const [edition, setEdition] = useState<Equipe | "nouvelle" | null>(null);

  if (equipes.isPending || salaries.isPending) return <Chargement />;
  const erreur = equipes.error ?? salaries.error;
  if (erreur) return <Erreur erreur={erreur} reessayer={() => void Promise.all([equipes.refetch(), salaries.refetch()])} />;
  const libres = sansEquipe(salaries.data ?? []);
  const lier = (salarieId: string, equipeId: string | null) =>
    rattacher.mutate({ salarieId, equipeId }, { onSuccess: () => afficherToast(equipeId ? "Salarié rattaché à l'équipe." : "Salarié retiré de l'équipe.", "success") });

  return (
    <>
      <div className="page-head">
        <h1>Équipes</h1>
        {droits.intervenants && !edition && (
          <button type="button" className="btn primary" onClick={() => setEdition("nouvelle")}>
            + Nouvelle équipe
          </button>
        )}
      </div>
      <div id="formZoneTechnicien">
        {edition && <FormulaireEquipe key={edition === "nouvelle" ? "nouvelle" : edition.id} equipe={edition === "nouvelle" ? null : edition} onFermer={() => setEdition(null)} />}
      </div>
      {(equipes.data ?? []).length === 0 ? (
        <div className="empty">Aucune équipe. Créez-en une pour pouvoir planifier.</div>
      ) : (
        (equipes.data ?? []).map((e) => (
          <CarteEquipe
            key={e.id}
            equipe={e}
            membres={membresDe(salaries.data ?? [], e.id)}
            libres={libres}
            modifier={() => setEdition(e)}
            supprimer={() => {
              if (window.confirm("Supprimer définitivement cet élément ?")) gerer.supprimerEquipe.mutate(e.id);
            }}
            rattacher={lier}
          />
        ))
      )}
      {libres.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: "26px" }}>
            Salariés sans équipe ({libres.length})
          </div>
          <div className="card">
            <div className="card-sub">{libres.map(nomComplet).join(" · ")}</div>
          </div>
        </>
      )}
    </>
  );
}

interface PropsCarte {
  equipe: Equipe;
  membres: Salarie[];
  libres: Salarie[];
  modifier: () => void;
  supprimer: () => void;
  rattacher: (salarieId: string, equipeId: string | null) => void;
}

function CarteEquipe({ equipe, membres, libres, modifier, supprimer, rattacher }: PropsCarte) {
  const droits = useDroitsRh();
  const [choix, setChoix] = useState("");
  const nom = libelleEquipe(equipe);
  const metiers = equipe.metiers.length ? equipe.metiers.join(", ") : equipe.metier;
  return (
    <div className="card" role="article" aria-label={`Équipe ${nom}`}>
      <div className="card-row">
        <div>
          <div className="card-title">{nom}</div>
          <div className="card-sub">
            {metiers ? `🔧 ${metiers}` : "Aucun métier"} · {membres.length} membre{membres.length > 1 ? "s" : ""}
          </div>
        </div>
        {droits.intervenants && (
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="btn small" onClick={modifier}>
              Modifier
            </button>
            <button type="button" className="btn small danger" onClick={supprimer}>
              Supprimer
            </button>
          </div>
        )}
      </div>
      <div style={{ marginTop: "10px" }}>
        {membres.length === 0 ? (
          <div className="empty" style={{ margin: "6px 0" }}>
            Aucun membre. Cette équipe ne peut rien déclarer.
          </div>
        ) : (
          membres.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 0", borderTop: "1px solid var(--border)" }}>
              <span style={{ flex: 1 }}>
                {nomComplet(s)}
                {s.poste && (
                  <>
                    {" "}
                    <span className="card-sub">· {s.poste}</span>
                  </>
                )}
              </span>
              {!s.profileId && (
                <span className="card-sub" title="Sans compte, ce membre ne peut pas déclarer ses travaux lui-même">
                  ⚠ sans compte
                </span>
              )}
              {droits.modifier && (
                <button type="button" className="btn small ghost" onClick={() => rattacher(s.id, null)}>
                  Retirer
                </button>
              )}
            </div>
          ))
        )}
      </div>
      {droits.modifier && libres.length > 0 && (
        <div style={{ marginTop: "10px", display: "flex", gap: "8px", alignItems: "center" }}>
          <select aria-label={`Ajouter un salarié à ${nom}`} style={{ flex: 1 }} value={choix} onChange={(e) => setChoix(e.target.value)}>
            <option value="">— Ajouter un salarié —</option>
            {libres.map((s) => (
              <option key={s.id} value={s.id}>
                {nomComplet(s)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn small"
            onClick={() => {
              if (!choix) return;
              rattacher(choix, equipe.id);
              setChoix("");
            }}
          >
            + Ajouter
          </button>
        </div>
      )}
    </div>
  );
}

/** `technicienForm` (app.js l. 18761) : nom, couleur au planning, métiers. */
function FormulaireEquipe({ equipe, onFermer }: { equipe: Equipe | null; onFermer: () => void }) {
  const gerer = useGererIntervenants();
  const metiers = useMetiersRh();
  const initiales = valeursEquipe(equipe);
  const [nom, setNom] = useState(initiales.nom);
  const [couleur, setCouleur] = useState(initiales.couleur);
  const [coches, setCoches] = useState<string[]>(initiales.metiers);
  useDefilerVersFormulaire("formZoneTechnicien");

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const r = schemaSaisieEquipe.safeParse({ nom, couleur, metiers: coches });
    if (!r.success) {
      window.alert(r.error.issues[0]?.message ?? "Saisie invalide.");
      return;
    }
    gerer.equipe.mutate(
      { id: equipe?.id ?? null, saisie: r.data },
      {
        onSuccess: () => {
          onFermer();
          afficherToast(equipe ? "Équipe modifiée." : "Équipe créée.", "success");
        },
        onError: (err) => afficherToast(messageErreur(err)),
      }
    );
  }

  return (
    <form className="form-panel" onSubmit={soumettre} noValidate aria-label={equipe ? "Modifier l'équipe" : "Nouvelle équipe"}>
      <h3>{equipe ? "Modifier l'équipe" : "Nouvelle équipe"}</h3>
      <div className="field-grid">
        <ChampTexte className="full" libelle="Nom de l'équipe" valeur={nom} onChange={setNom} placeholder="Ex : Équipe peinture, Karim & Yanis…" />
        <div className="field">
          <label htmlFor="tc_couleur">Couleur au planning</label>
          <input id="tc_couleur" type="color" value={couleur} onChange={(e) => setCouleur(e.target.value)} />
        </div>
        <div className="field full">
          <label>Métier(s)</label>
          <CasesMetiers legende="Métier(s)" referentiel={metiers.data} coches={coches} onChange={setCoches} />
        </div>
      </div>
      <p className="card-sub" style={{ marginTop: "4px" }}>
        Les membres se rattachent depuis l&apos;onglet Équipes du RH, ou depuis la fiche de chaque salarié.
      </p>
      <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
        <button type="submit" className="btn primary" disabled={gerer.equipe.isPending}>
          Enregistrer
        </button>
        <button type="button" className="btn ghost" onClick={onFermer}>
          Annuler
        </button>
      </div>
    </form>
  );
}
