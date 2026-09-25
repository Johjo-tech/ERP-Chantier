import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { messageErreur } from "@/lib/erreurs";
import { useFormulaire } from "@/lib/useFormulaire";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
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

function Formulaire({ materiel, etats, categories }: { materiel: Materiel | null; etats: string[]; categories: string[] }) {
  const navigate = useNavigate();
  const enregistrer = useEnregistrerMateriel(materiel?.id);
  const initiales = saisieDepuis(materiel, etats[0] ?? "");
  const { valeurs, erreurs, changer, valider } = useFormulaire({ ...initiales, categorie: valeurDansListe(categories, initiales.categorie) });

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const s = valider(schemaSaisieMateriel);
    if (s) enregistrer.mutate(s, { onSuccess: (r) => void navigate(`/materiel/${r.id}`) });
  }

  return (
    <form onSubmit={soumettre} noValidate className="flex max-w-3xl flex-col gap-4">
      <EnTetePage titre={materiel ? `Modifier ${materiel.nom}` : "Nouveau matériel"} />
      {enregistrer.isError && <Alert variant="erreur">{messageErreur(enregistrer.error)}</Alert>}
      <Card>
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">
          <ChampTexte libelle="Nom du matériel" requis placeholder="Ex : Perforateur Hilti TE 60" valeur={valeurs.nom} onChange={(v) => changer("nom", v)} erreur={erreurs.nom} />
          <ChampChoix
            libelle="Catégorie"
            valeur={valeurs.categorie}
            onChange={(v) => changer("categorie", v)}
            options={[{ valeur: "", libelle: "— Non précisé —" }, ...categories.map((c) => ({ valeur: c, libelle: c }))]}
            aide="La liste se règle dans Réglages › Listes de choix."
          />
          <ChampChoix libelle="État général" valeur={valeurs.etat_general} onChange={(v) => changer("etat_general", v)} options={etats.map((e) => ({ valeur: e, libelle: e }))} />
          <ChampTexte libelle="N° de série (optionnel)" valeur={valeurs.numero_serie} onChange={(v) => changer("numero_serie", v)} />
          <ChampTexte libelle="Date d'achat" type="date" valeur={valeurs.date_achat} onChange={(v) => changer("date_achat", v)} erreur={erreurs.date_achat} />
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button type="submit" disabled={enregistrer.isPending}>
          {enregistrer.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button variant="ghost" asChild>
          <Link to={materiel ? `/materiel/${materiel.id}` : "/materiel"}>Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
