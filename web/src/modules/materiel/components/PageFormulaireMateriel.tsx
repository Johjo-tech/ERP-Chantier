import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { useFormulaire } from "@/lib/useFormulaire";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { useDefilerVersFormulaire } from "./communs";
import { composerListe, etatsProposes, saisieDepuis, schemaSaisieMateriel, valeurDansListe, type Materiel } from "../domain/materiel";
import { useEnregistrerMateriel, useMateriel, useMateriels, useReferentielMateriel } from "../hooks/useMateriel";

export function PageFormulaireMateriel() {
  const { id } = useParams();
  const materiel = useMateriel(id);
  const etats = useReferentielMateriel("etat_materiel");
  const categories = useReferentielMateriel("categorie_materiel");
  const tous = useMateriels();
  if ((id && materiel.isPending) || etats.isPending || categories.isPending || tous.isPending) return <Chargement />;
  if (id && materiel.isError) return <Erreur erreur={materiel.error} reessayer={() => void materiel.refetch()} />;
  const m = materiel.data ?? null;
  const listeEtats = etatsProposes(etats.data ?? [], m?.etat_general ?? null);
  // Les catégories déjà employées par les fiches restent proposées (`categoriesMaterielEmployees`).
  const listeCategories = composerListe(categories.data ?? [], [...(tous.data ?? []).map((x) => x.categorie), m?.categorie ?? null]);
  const f = <Formulaire key={id ?? "nouveau"} materiel={m} etats={listeEtats} categories={listeCategories} />;
  return m ? <GardeSociete societeId={m.societe_id} retour="/materiel">{f}</GardeSociete> : f;
}

/**
 * Le formulaire de `materielForm` (app.js l. 14737) sous l'en-tête « Matériel »
 * sans bouton : `.form-panel`, `.field-grid`, « Enregistrer » / « Annuler ».
 * Un refus se dit comme avant (fenêtre d'alerte, bulle d'échec), et la
 * création ramène à la liste, où l'ancien refermait le formulaire.
 */
function Formulaire({ materiel, etats, categories }: { materiel: Materiel | null; etats: string[]; categories: string[] }) {
  const navigate = useNavigate();
  const enregistrer = useEnregistrerMateriel(materiel?.id);
  const initiales = saisieDepuis(materiel, etats[0] ?? "");
  const { valeurs, changer } = useFormulaire({ ...initiales, categorie: valeurDansListe(categories, initiales.categorie) });
  const retour = materiel ? `/materiel/${materiel.id}` : "/materiel";
  useDefilerVersFormulaire("formZoneMateriel");

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const r = schemaSaisieMateriel.safeParse(valeurs);
    if (!r.success) {
      window.alert(r.error.issues[0]?.message ?? "Saisie invalide.");
      return;
    }
    enregistrer.mutate(r.data, {
      onSuccess: () => {
        afficherToast(materiel ? "Matériel modifié." : "Matériel créé.", "success");
        void navigate(retour);
      },
      onError: (err) => afficherToast(messageErreur(err)),
    });
  }

  return (
    <>
      <div className="page-head">
        <h1>Matériel</h1>
      </div>
      <div id="formZoneMateriel">
        <form className="form-panel" onSubmit={soumettre} noValidate>
          <h3>{materiel ? "Modifier le matériel" : "Nouveau matériel"}</h3>
          <div className="field-grid">
            <ChampTexte libelle="Nom du matériel" placeholder="Ex : Perforateur Hilti TE 60" valeur={valeurs.nom} onChange={(v) => changer("nom", v)} />
            <ChampChoix
              libelle="Catégorie"
              valeur={valeurs.categorie}
              onChange={(v) => changer("categorie", v)}
              options={[{ valeur: "", libelle: "— Non précisé —" }, ...categories.map((c) => ({ valeur: c, libelle: c }))]}
            />
            <ChampChoix libelle="État général" valeur={valeurs.etat_general} onChange={(v) => changer("etat_general", v)} options={etats.map((e) => ({ valeur: e, libelle: e }))} />
            <ChampTexte libelle="N° de série (optionnel)" valeur={valeurs.numero_serie} onChange={(v) => changer("numero_serie", v)} />
            <ChampTexte libelle="Date d'achat" type="date" valeur={valeurs.date_achat} onChange={(v) => changer("date_achat", v)} />
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
      </div>
    </>
  );
}
