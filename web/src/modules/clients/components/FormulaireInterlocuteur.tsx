import { useId, type FormEvent } from "react";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { useFormulaire } from "@/lib/useFormulaire";
import { schemaSaisieInterlocuteur } from "../domain/interlocuteur";
import { useEnregistrerInterlocuteur } from "../hooks/useClients";

export interface InterlocuteurEdite {
  id: string | null;
  nom: string;
  fonction: string | null;
  telephone: string | null;
  email: string | null;
}

/** L'interlocuteur de l'ancien (`interlocuteurForm`), ouvert dans la carte de son client. */
export function FormulaireInterlocuteur({
  client,
  edite,
  onFermer,
}: {
  client: { id: string; nom: string };
  edite: InterlocuteurEdite | null;
  onFermer: () => void;
}) {
  const enregistrer = useEnregistrerInterlocuteur(client.id);
  const { valeurs, erreurs, changer, valider } = useFormulaire({
    nom: edite?.nom ?? "",
    fonction: edite?.fonction ?? "",
    telephone: edite?.telephone ?? "",
    email: edite?.email ?? "",
  });
  const ids = { nom: useId(), fonction: useId(), telephone: useId(), email: useId() };

  function soumettre(e: FormEvent) {
    e.preventDefault();
    // Le refus de l'ancien, dit par la boîte du navigateur.
    if (!valeurs.nom.trim()) return window.alert("Le nom de l'interlocuteur est requis.");
    const saisie = valider(schemaSaisieInterlocuteur);
    if (!saisie) return;
    enregistrer.mutate(
      { id: edite?.id ?? null, saisie },
      { onSuccess: onFermer, onError: (err) => afficherToast(messageErreur(err)) }
    );
  }

  return (
    <form className="form-panel" style={{ marginTop: "10px" }} onSubmit={soumettre} noValidate aria-label="Interlocuteur">
      <h3>{edite?.id ? "Modifier l'interlocuteur" : `Nouvel interlocuteur — ${client.nom}`}</h3>
      <div className="field-grid">
        <div className="field">
          <label htmlFor={ids.nom}>Nom</label>
          <input type="text" id={ids.nom} value={valeurs.nom} placeholder="Ex : M. Martin" onChange={(e) => changer("nom", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={ids.fonction}>Fonction</label>
          <input type="text" id={ids.fonction} value={valeurs.fonction} placeholder="Ex : Gestionnaire, Comptabilité…" onChange={(e) => changer("fonction", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={ids.telephone}>Téléphone</label>
          <input type="tel" id={ids.telephone} value={valeurs.telephone} onChange={(e) => changer("telephone", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={ids.email}>Email</label>
          <input type="email" id={ids.email} value={valeurs.email} aria-invalid={!!erreurs.email} onChange={(e) => changer("email", e.target.value)} />
          {erreurs.email && (
            <small role="alert" className="champ-erreur">
              {erreurs.email}
            </small>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <button type="submit" className="btn primary" disabled={enregistrer.isPending}>
          Enregistrer
        </button>
        <button type="button" className="btn ghost" onClick={onFermer}>
          Annuler
        </button>
      </div>
    </form>
  );
}
