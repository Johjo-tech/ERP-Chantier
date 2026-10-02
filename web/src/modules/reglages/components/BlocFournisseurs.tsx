import { useState } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ChampTexte } from "@/components/formulaire/Champ";
import { BarreRecherche } from "@/components/ui/barre-recherche";
import { messageErreur } from "@/lib/erreurs";
import { correspond } from "@/lib/recherche";
import { afficherToast } from "@/lib/toast";
import { useFormulaire } from "@/lib/useFormulaire";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { useDefilerVersFormulaire } from "@/modules/materiel/components/communs";
import type { Fournisseur } from "../api/intervenants";
import { schemaSaisieFournisseur, type SaisieFournisseur } from "../domain/intervenants";
import { useEcrireFournisseurs, useFournisseurs } from "../hooks/useReglagesEcran";

/** « 12 rue X, 69000 Lyon » (`withVille` de l'ancien écran). */
function avecVille(adresse: string | null, cp: string | null, ville: string | null): string {
  const cpVille = [cp, ville].filter(Boolean).join(" ");
  return [adresse, cpVille].filter(Boolean).join(", ");
}

/**
 * L'annuaire des fournisseurs — pièces, matériaux, location (PAR-06), au HTML
 * de `renderFournisseursSection` (app.js l. 18109). Un fournisseur ne se
 * supprime pas : il se retire des listes (D-ECR-PAR-12).
 */
export function BlocFournisseurs() {
  const fournisseurs = useFournisseurs();
  const ecrire = useEcrireFournisseurs();
  const modifiable = usePermission("reglages", "modifier");
  const [recherche, setRecherche] = useState("");
  const [edition, setEdition] = useState<Fournisseur | "nouveau" | null>(null);
  const tous = fournisseurs.data ?? [];
  const affiches = tous.filter((f) => correspond(recherche, f.nom, f.specialite, f.ville, f.contact_nom));

  return (
    <>
      <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "30px" }}>
        <span>Fournisseurs</span>
        {modifiable && (
          <button type="button" className="btn small primary" onClick={() => setEdition("nouveau")}>
            + Nouveau fournisseur
          </button>
        )}
      </div>
      <div className="card-sub" style={{ marginBottom: "12px" }}>
        Pièces, matériaux, location. C&apos;est ce nom qui regroupe les pièces commandées en dossiers.
      </div>
      <BarreRecherche id="fournisseur" libelle="Rechercher un fournisseur" valeur={recherche} onChange={setRecherche} placeholder="Rechercher : nom, spécialité, ville…" affiches={affiches.length} total={tous.length} />
      <div id="formZoneFournisseur">
        {edition && <FormulaireFournisseur key={edition === "nouveau" ? "nouveau" : edition.id} fournisseur={edition === "nouveau" ? null : edition} onFermer={() => setEdition(null)} />}
      </div>
      <div id="liste-fournisseur">
        {fournisseurs.isPending && <Chargement />}
        {fournisseurs.isError && <Erreur erreur={fournisseurs.error} reessayer={() => void fournisseurs.refetch()} />}
        {fournisseurs.isSuccess && affiches.length === 0 && <div className="empty">{recherche.trim() ? "Aucun fournisseur ne correspond à la recherche." : "Aucun fournisseur enregistré."}</div>}
        {affiches.map((f) => (
          <div key={f.id} className="card">
            <div className="card-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="card-title">
                  {f.nom}
                  {!f.actif && (
                    <>
                      {" "}
                      <span className="badge gray" style={{ marginLeft: "6px" }}>
                        Retiré
                      </span>
                    </>
                  )}
                </div>
                <div className="card-sub">{[f.specialite, f.contact_nom, f.telephone, avecVille(f.adresse, f.code_postal, f.ville)].filter(Boolean).join(" · ") || "—"}</div>
              </div>
              {f.telephone && (
                <a className="btn small" href={`tel:${f.telephone.replace(/[^+0-9]/g, "")}`} title="Appeler" aria-label={`Appeler ${f.nom}`}>
                  ☎
                </a>
              )}
            </div>
            {modifiable && (
              <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button type="button" className="btn small" onClick={() => setEdition(f)}>
                  Modifier
                </button>
                <button
                  type="button"
                  className={`btn small ${f.actif ? "danger" : ""}`}
                  title="Les commandes passées gardent son nom : elles restent lisibles."
                  onClick={() => ecrire.actif.mutate({ id: f.id, actif: !f.actif }, { onError: (e) => afficherToast(messageErreur(e)) })}
                >
                  {f.actif ? "Retirer" : "Remettre"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

const CHAMPS: readonly [keyof SaisieFournisseur, string, string?][] = [
  ["specialite", "Spécialité", "Ex : Plomberie, Électricité, Outillage"],
  ["contact_nom", "Contact", "Ex : M. Durand"],
  ["telephone", "Téléphone"],
  ["email", "Email"],
];

/** `fournisseurForm` (app.js l. 18140) : la disponibilité « Proposé dans les listes » y est la même case que « Retirer ». */
function FormulaireFournisseur({ fournisseur, onFermer }: { fournisseur: Fournisseur | null; onFermer: () => void }) {
  const ecrire = useEcrireFournisseurs();
  const cles: (keyof SaisieFournisseur)[] = ["nom", "specialite", "contact_nom", "telephone", "email", "adresse", "code_postal", "ville", "siret", "notes"];
  const initiales = Object.fromEntries(cles.map((c) => [c, fournisseur?.[c as keyof Fournisseur]?.toString() ?? ""])) as Record<keyof SaisieFournisseur, string>;
  const { valeurs, changer } = useFormulaire(initiales);
  const [actif, setActif] = useState(fournisseur?.actif ?? true);
  useDefilerVersFormulaire("formZoneFournisseur");

  function enregistrer() {
    const r = schemaSaisieFournisseur.safeParse(valeurs);
    if (!r.success) {
      window.alert(r.error.issues[0]?.message ?? "Saisie invalide.");
      return;
    }
    ecrire.enregistrer.mutate(
      { avant: fournisseur, saisie: r.data },
      {
        onSuccess: () => {
          if (fournisseur && actif !== fournisseur.actif) ecrire.actif.mutate({ id: fournisseur.id, actif });
          onFermer();
          afficherToast(fournisseur ? "Fournisseur modifié." : "Fournisseur créé.", "success");
        },
        onError: (e) => afficherToast(messageErreur(e)),
      }
    );
  }

  const c = (cle: keyof SaisieFournisseur) => ({ valeur: valeurs[cle], onChange: (v: string) => changer(cle, v) });
  return (
    <div className="form-panel">
      <h3>{fournisseur ? "Modifier le fournisseur" : "Nouveau fournisseur"}</h3>
      <div className="field-grid">
        <ChampTexte className="full" libelle="Nom" {...c("nom")} placeholder="Ex : Point P, Rexel, Cedeo…" />
        {CHAMPS.map(([cle, libelle, exemple]) => (
          <ChampTexte key={cle} libelle={libelle} type={cle === "email" ? "email" : cle === "telephone" ? "tel" : "text"} {...c(cle)} {...(exemple ? { placeholder: exemple } : {})} />
        ))}
        <ChampTexte className="full" libelle="Adresse" {...c("adresse")} />
        <ChampTexte libelle="Code postal" inputMode="numeric" {...c("code_postal")} />
        <ChampTexte libelle="Ville" {...c("ville")} />
        <ChampTexte libelle="SIRET" {...c("siret")} />
        <div className="field">
          <div className="reglage-titre">Disponibilité</div>
          <label className="bc-tache-row">
            <input type="checkbox" id="fo_actif" checked={actif} disabled={!fournisseur} onChange={(e) => setActif(e.target.checked)} />
            <span>Proposé dans les listes</span>
          </label>
        </div>
        <ChampTexte className="full" libelle="Notes" {...c("notes")} />
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
