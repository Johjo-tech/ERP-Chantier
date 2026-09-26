import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { useFormulaire } from "@/lib/useFormulaire";
import { nomPersonne } from "@/modules/materiel/domain/prets";
import { useDefilerVersFormulaire } from "@/modules/materiel/components/communs";
import { usePersonnes } from "@/modules/materiel/hooks/useMateriel";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { libelleVehicule, saisieDepuis, schemaSaisieVehicule, typesProposes, type Vehicule } from "../domain/vehicule";
import { useEnregistrerVehicule, useVehicule } from "../hooks/useVehicules";

/**
 * Création : sous l'en-tête « Véhicules » sans bouton, dans `#formZoneVehicule`.
 * Modification : dans la fiche, sous son en-tête (retour + titre), comme
 * `renderVehiculeDetail` quand `formOpen.vehicule` est posé (app.js l. 14995).
 */
export function PageFormulaireVehicule() {
  const { id } = useParams();
  const vehicule = useVehicule(id);
  if (id && vehicule.isPending) return <Chargement />;
  if (id && vehicule.isError) return <Erreur erreur={vehicule.error} reessayer={() => void vehicule.refetch()} />;
  const v = vehicule.data ?? null;
  if (!v) {
    return (
      <>
        <div className="page-head">
          <h1>Véhicules</h1>
        </div>
        <div id="formZoneVehicule">
          <Formulaire vehicule={null} />
        </div>
      </>
    );
  }
  return (
    <GardeSociete societeId={v.societe_id} retour="/vehicules">
      <div className="page-head">
        <h1>Véhicules</h1>
      </div>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <Link className="btn small" to="/vehicules">
            ← Retour aux véhicules
          </Link>
          <h1 style={{ margin: 0 }}>{libelleVehicule(v)}</h1>
        </div>
      </div>
      <Formulaire key={v.id} vehicule={v} />
    </GardeSociete>
  );
}

type Valeurs = ReturnType<typeof saisieDepuis>;

/**
 * `vehiculeForm` (app.js l. 15084) : la plaque en premier, la bascule « Avec
 * TVA / Sans TVA », puis télépéage et carte carburant. Écart décidé : la
 * validité de la carte carburant est une date (D-VEH-05), l'ancien champ texte
 * « Validité / code PIN » faisait refuser tout l'enregistrement.
 */
function Formulaire({ vehicule }: { vehicule: Vehicule | null }) {
  const navigate = useNavigate();
  const personnes = usePersonnes();
  const enregistrer = useEnregistrerVehicule(vehicule?.id);
  const { valeurs, changer } = useFormulaire(saisieDepuis(vehicule));
  const retour = vehicule ? `/vehicules/${vehicule.id}` : "/vehicules";
  useDefilerVersFormulaire(vehicule ? "" : "formZoneVehicule");

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const r = schemaSaisieVehicule.safeParse(valeurs);
    if (!r.success) {
      window.alert(r.error.issues[0]?.message ?? "Saisie invalide.");
      return;
    }
    enregistrer.mutate(r.data, {
      onSuccess: () => {
        afficherToast(vehicule ? "Véhicule modifié." : "Véhicule créé.", "success");
        void navigate(retour);
      },
      onError: (err) => afficherToast(messageErreur(err)),
    });
  }

  const champ = (nom: keyof Valeurs, libelle: string, extra: Partial<Parameters<typeof ChampTexte>[0]> = {}) => (
    <ChampTexte libelle={libelle} valeur={valeurs[nom]} onChange={(v) => changer(nom, v)} {...extra} />
  );
  const avecTva = valeurs.tva_applicable === "oui";

  return (
    <form className="form-panel" onSubmit={soumettre} noValidate>
      <h3>{vehicule ? "Modifier le véhicule" : "Nouveau véhicule"}</h3>
      <div className="field-grid">
        <div className="field">
          <label htmlFor="veh_immatriculation">Immatriculation</label>
          <input
            type="text"
            id="veh_immatriculation"
            value={valeurs.immatriculation}
            placeholder="Ex : AB-123-CD"
            style={{ textTransform: "uppercase" }}
            onChange={(e) => changer("immatriculation", e.target.value)}
          />
        </div>
        {champ("marque", "Marque", { placeholder: "Ex : Renault" })}
        {champ("modele", "Modèle", { placeholder: "Ex : Trafic" })}
        <ChampChoix libelle="Type de véhicule" valeur={valeurs.type_vehicule} onChange={(v) => changer("type_vehicule", v)} options={typesProposes(valeurs.type_vehicule)} />
        <div className="field">
          <label id="veh_tva_libelle">TVA sur ce véhicule</label>
          <div className="tva-toggle-row" role="group" aria-labelledby="veh_tva_libelle">
            <button type="button" className={`tva-toggle-btn ${avecTva ? "is-active" : ""}`} aria-pressed={avecTva} onClick={() => changer("tva_applicable", "oui")}>
              Avec TVA
            </button>
            <button type="button" className={`tva-toggle-btn ${!avecTva ? "is-active" : ""}`} aria-pressed={!avecTva} onClick={() => changer("tva_applicable", "non")}>
              Sans TVA
            </button>
          </div>
        </div>
        {champ("motorisation", "Motorisation", { placeholder: "Ex : Diesel 2.0L 145ch" })}
        {champ("taille_pneus", "Taille de pneus", { placeholder: "Ex : 205/65 R16" })}
        {champ("kilometrage", "Kilométrage actuel", { type: "number" })}
        {champ("date_achat", "Date d'achat", { type: "date" })}
        {champ("date_controle_technique", "Prochain contrôle technique", { type: "date" })}
        <ChampChoix
          libelle="Conducteur attitré"
          valeur={valeurs.conducteur_salarie_id}
          onChange={(v) => changer("conducteur_salarie_id", v)}
          options={[{ valeur: "", libelle: "— Sans conducteur / non renseigné —" }, ...(personnes.data ?? []).map((p) => ({ valeur: p.id, libelle: nomPersonne(p) }))]}
        />
      </div>
      <div className="section-title" style={{ marginTop: "10px" }}>
        🛣️ Télépéage
      </div>
      <div className="field-grid">
        {champ("telepeage_fournisseur", "Fournisseur", { placeholder: "Ex : Bip&Go, Ulys…" })}
        {champ("telepeage_numero", "N° de badge / abonnement")}
        {champ("telepeage_validite", "Validité / renouvellement", { type: "date" })}
      </div>
      <div className="section-title" style={{ marginTop: "6px" }}>
        ⛽ Carte carburant
      </div>
      <div className="field-grid">
        {champ("carte_carburant_fournisseur", "Fournisseur", { placeholder: "Ex : Total, DKV, Shell…" })}
        {champ("carte_carburant_numero", "N° de carte")}
        {champ("carte_carburant_validite", "Date d'expiration", { type: "date" })}
      </div>
      <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
        <button type="submit" className="btn primary" disabled={enregistrer.isPending}>
          Enregistrer
        </button>
        <Link className="btn ghost" to={retour}>
          Annuler
        </Link>
      </div>
    </form>
  );
}
