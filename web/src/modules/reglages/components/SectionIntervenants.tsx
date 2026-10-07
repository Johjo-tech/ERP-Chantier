import { useState } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ChampTexte } from "@/components/formulaire/Champ";
import { BarreRecherche } from "@/components/ui/barre-recherche";
import { messageErreur } from "@/lib/erreurs";
import { correspond } from "@/lib/recherche";
import { afficherToast } from "@/lib/toast";
import { useFormulaire } from "@/lib/useFormulaire";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { useMembres } from "@/modules/comptes/hooks/useComptes";
import { useDefilerVersFormulaire } from "@/modules/materiel/components/communs";
import { OngletSousTraitants } from "@/modules/rh/components/OngletSousTraitants";
import type { FicheConducteur } from "../api/intervenants";
import { comptesLiables, schemaSaisieConducteur } from "../domain/intervenants";
import { useEcrireConducteurs, useFichesConducteurs } from "../hooks/useReglagesEcran";
import { BlocFournisseurs } from "./BlocFournisseurs";

/**
 * Réglages › Intervenants, comme l'ancien écran (app.js l. 12415) : conducteurs
 * de travaux, sous-traitants, fournisseurs. Les sous-traitants reviennent ici
 * de l'onglet RH où web/ les avait mis (D-ECR-PAR-05).
 */
export function SectionIntervenants() {
  return (
    <>
      <BlocConducteurs />
      <OngletSousTraitants />
      <BlocFournisseurs />
    </>
  );
}

/**
 * `renderConducteursSection` (app.js l. 17922). Une fiche ne se supprime pas :
 * elle se RETIRE, et ses documents gardent leur conducteur (D-ECR-PAR-12).
 */
function BlocConducteurs() {
  const fiches = useFichesConducteurs();
  const ecrire = useEcrireConducteurs();
  const modifiable = usePermission("reglages", "modifier");
  const [recherche, setRecherche] = useState("");
  const [edition, setEdition] = useState<FicheConducteur | "nouveau" | null>(null);
  const toutes = fiches.data ?? [];
  const affichees = toutes.filter((c) => correspond(recherche, c.nom, c.telephone, c.email));

  return (
    <>
      <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "30px" }}>
        <span>Conducteurs de travaux</span>
        {modifiable && (
          <button type="button" className="btn small primary" onClick={() => setEdition("nouveau")}>
            + Nouveau conducteur
          </button>
        )}
      </div>
      <BarreRecherche id="conducteur" libelle="Rechercher un conducteur" valeur={recherche} onChange={setRecherche} placeholder="Rechercher : nom, téléphone, e-mail…" affiches={affichees.length} total={toutes.length} />
      <div id="formZoneConducteur">
        {edition && <FormulaireConducteur key={edition === "nouveau" ? "nouveau" : edition.id} fiche={edition === "nouveau" ? null : edition} fiches={toutes} onFermer={() => setEdition(null)} />}
      </div>
      <div id="liste-conducteur">
        {fiches.isPending && <Chargement />}
        {fiches.isError && <Erreur erreur={fiches.error} reessayer={() => void fiches.refetch()} />}
        {fiches.isSuccess && affichees.length === 0 && (
          <div className="empty">{recherche.trim() ? "Aucun conducteur ne correspond à la recherche." : "Aucun conducteur de travaux enregistré pour cette société."}</div>
        )}
        {affichees.map((c) => (
          <div key={c.id} className="card">
            <div className="card-row">
              <div>
                <div className="card-title">
                  {c.nom}
                  {!c.actif && (
                    <span className="badge gray" style={{ marginLeft: "6px" }}>
                      Retiré
                    </span>
                  )}
                </div>
                {(c.telephone || c.email) && <div className="card-sub">{[c.telephone, c.email].filter(Boolean).join(" · ")}</div>}
                {!c.profile_id && (
                  <div className="card-sub" title="Sans compte, son tableau de bord montre les affaires de toute la société">
                    ⚠ sans compte utilisateur
                  </div>
                )}
              </div>
            </div>
            {modifiable && (
              <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
                <button type="button" className="btn small" onClick={() => setEdition(c)}>
                  Modifier
                </button>
                <button
                  type="button"
                  className={`btn small ${c.actif ? "danger" : ""}`}
                  onClick={() => ecrire.actif.mutate({ id: c.id, actif: !c.actif }, { onError: (e) => afficherToast(messageErreur(e)) })}
                >
                  {c.actif ? "Retirer" : "Remettre"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/** `conducteurForm` (app.js l. 17945). */
function FormulaireConducteur({ fiche, fiches, onFermer }: { fiche: FicheConducteur | null; fiches: readonly FicheConducteur[]; onFermer: () => void }) {
  const ecrire = useEcrireConducteurs();
  const membres = useMembres();
  const { valeurs, changer } = useFormulaire({
    nom: fiche?.nom ?? "",
    email: fiche?.email ?? "",
    telephone: fiche?.telephone ?? "",
    profile_id: fiche?.profile_id ?? "",
  });
  const comptes = comptesLiables(membres.data ?? [], fiches, fiche?.id ?? null);
  useDefilerVersFormulaire("formZoneConducteur");

  function enregistrer() {
    const r = schemaSaisieConducteur.safeParse(valeurs);
    if (!r.success) {
      window.alert(r.error.issues[0]?.message ?? "Saisie invalide.");
      return;
    }
    ecrire.enregistrer.mutate(
      { avant: fiche, saisie: r.data },
      {
        onSuccess: () => {
          onFermer();
          afficherToast(fiche ? "Conducteur modifié." : "Conducteur créé.", "success");
        },
        onError: (e) => afficherToast(messageErreur(e)),
      }
    );
  }

  return (
    <div className="form-panel">
      <h3>{fiche ? "Modifier le conducteur" : "Nouveau conducteur de travaux"}</h3>
      {fiche?.salarie_id && (
        <div className="wf-banner ok" style={{ marginBottom: "12px" }}>
          👤 Cette fiche suit un salarié des RH. Modifiez son nom, son téléphone ou son courriel <b>dans l&apos;onglet RH</b> : le prochain enregistrement de sa fiche RH réécrirait ce qui serait changé ici.
        </div>
      )}
      <div className="field-grid">
        <ChampTexte className="full" libelle="Nom" valeur={valeurs.nom} onChange={(v) => changer("nom", v)} placeholder="Ex : M. Martin" />
        <ChampTexte libelle="Téléphone" type="tel" valeur={valeurs.telephone} onChange={(v) => changer("telephone", v)} />
        <ChampTexte libelle="Email" type="email" valeur={valeurs.email} onChange={(v) => changer("email", v)} />
        <div className="field full">
          <label htmlFor="cd_profileId">Compte utilisateur</label>
          <select id="cd_profileId" value={valeurs.profile_id} onChange={(e) => changer("profile_id", e.target.value)}>
            {[{ valeur: "", libelle: "— Aucun —" }, ...comptes].map((o) => (
              <option key={o.valeur} value={o.valeur}>
                {o.libelle}
              </option>
            ))}
          </select>
          <div className="card-sub" style={{ marginTop: "4px" }}>
            Sans compte, son tableau de bord montrera les affaires de toute la société au lieu des siennes.
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
        <button type="button" className="btn primary" disabled={ecrire.enregistrer.isPending} onClick={enregistrer}>
          Enregistrer
        </button>
        <button type="button" className="btn ghost" onClick={onFermer}>
          Annuler
        </button>
      </div>
    </div>
  );
}
