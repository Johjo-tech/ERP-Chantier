import type { FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { messageErreur } from "@/lib/erreurs";
import { useFormulaire } from "@/lib/useFormulaire";
import { nomPersonne } from "@/modules/materiel/domain/prets";
import { usePersonnes } from "@/modules/materiel/hooks/useMateriel";
import { GardeSociete } from "@/modules/societes/components/GardeSociete";
import { libelleVehicule, saisieDepuis, schemaSaisieVehicule, typesProposes, type Vehicule } from "../domain/vehicule";
import { useEnregistrerVehicule, useVehicule } from "../hooks/useVehicules";

export function PageFormulaireVehicule() {
  const { id } = useParams();
  const vehicule = useVehicule(id);
  if (id && vehicule.isPending) return <Chargement />;
  if (id && vehicule.isError) return <Erreur erreur={vehicule.error} reessayer={() => void vehicule.refetch()} />;
  const f = <Formulaire key={id ?? "nouveau"} vehicule={vehicule.data ?? null} />;
  return vehicule.data ? <GardeSociete societeId={vehicule.data.societe_id} retour="/vehicules">{f}</GardeSociete> : f;
}

type Valeurs = ReturnType<typeof saisieDepuis>;

function Formulaire({ vehicule }: { vehicule: Vehicule | null }) {
  const navigate = useNavigate();
  const personnes = usePersonnes();
  const enregistrer = useEnregistrerVehicule(vehicule?.id);
  const { valeurs, erreurs, changer, valider } = useFormulaire(saisieDepuis(vehicule));

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const s = valider(schemaSaisieVehicule);
    if (s) enregistrer.mutate(s, { onSuccess: (v) => void navigate(`/vehicules/${v.id}`) });
  }

  const champ = (nom: keyof Valeurs, libelle: string, extra: Partial<Parameters<typeof ChampTexte>[0]> = {}) => (
    <ChampTexte libelle={libelle} valeur={valeurs[nom]} onChange={(v) => changer(nom, v)} erreur={erreurs[nom]} {...extra} />
  );

  return (
    <form onSubmit={soumettre} noValidate className="flex max-w-3xl flex-col gap-4">
      <EnTetePage titre={vehicule ? `Modifier ${libelleVehicule(vehicule)}` : "Nouveau véhicule"} />
      {enregistrer.isError && <Alert variant="erreur">{messageErreur(enregistrer.error)}</Alert>}
      {Object.keys(erreurs).length > 0 && <Alert variant="erreur">Le formulaire contient des erreurs : corrigez les champs signalés.</Alert>}
      <Card>
        <CardHeader>
          <CardTitle>Véhicule</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {/* La plaque EN PREMIER, et obligatoire : c'est elle qui identifie. */}
          {champ("immatriculation", "Immatriculation", { requis: true, placeholder: "Ex : AB-123-CD", aide: "Mise en capitales à l'enregistrement." })}
          {champ("marque", "Marque", { placeholder: "Ex : Renault" })}
          {champ("modele", "Modèle", { placeholder: "Ex : Trafic" })}
          <ChampChoix libelle="Type de véhicule" valeur={valeurs.type_vehicule} onChange={(v) => changer("type_vehicule", v)} erreur={erreurs.type_vehicule} options={typesProposes(valeurs.type_vehicule)} />
          <ChampChoix
            libelle="TVA sur ce véhicule"
            valeur={valeurs.tva_applicable}
            onChange={(v) => changer("tva_applicable", v)}
            options={[{ valeur: "oui", libelle: "Avec TVA" }, { valeur: "non", libelle: "Sans TVA" }]}
            aide="Propose 20 % ou 0 % à la vente."
          />
          {champ("motorisation", "Motorisation", { placeholder: "Ex : Diesel 2.0L 145ch" })}
          {champ("taille_pneus", "Taille de pneus", { placeholder: "Ex : 205/65 R16" })}
          {champ("kilometrage", "Kilométrage actuel", { inputMode: "numeric" })}
          {champ("date_achat", "Date d'achat", { type: "date" })}
          {champ("date_controle_technique", "Prochain contrôle technique", { type: "date" })}
          <ChampChoix
            libelle="Conducteur attitré"
            valeur={valeurs.conducteur_salarie_id}
            onChange={(v) => changer("conducteur_salarie_id", v)}
            options={[{ valeur: "", libelle: "— Sans conducteur / non renseigné —" }, ...(personnes.data ?? []).map((p) => ({ valeur: p.id, libelle: nomPersonne(p) }))]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Télépéage</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {champ("telepeage_fournisseur", "Fournisseur", { placeholder: "Ex : Bip&Go, Ulys…" })}
          {champ("telepeage_numero", "N° de badge / abonnement")}
          {champ("telepeage_validite", "Validité / renouvellement", { type: "date" })}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Carte carburant</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {champ("carte_carburant_fournisseur", "Fournisseur", { placeholder: "Ex : Total, DKV, Shell…" })}
          {champ("carte_carburant_numero", "N° de carte")}
          {champ("carte_carburant_validite", "Date d'expiration", { type: "date", aide: "Jamais le code PIN : il n'a rien à faire dans l'application." })}
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button type="submit" disabled={enregistrer.isPending}>
          {enregistrer.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button variant="ghost" asChild>
          <Link to={vehicule ? `/vehicules/${vehicule.id}` : "/vehicules"}>Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
