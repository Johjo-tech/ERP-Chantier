import type { FormEvent, ReactNode } from "react";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import { useFormulaire } from "@/lib/useFormulaire";
import { nomPersonne, saisiePretVierge, schemaSaisiePret, type PersonneAnnuaire, type SaisiePret } from "../domain/prets";

interface Props {
  personnes: readonly PersonneAnnuaire[];
  etats: readonly string[];
  etatInitial: string;
  enCours: boolean;
  erreur: unknown;
  onPreter: (s: SaisiePret) => void;
  /** Ce qui se saisit en plus pour un véhicule : le schéma de l'état au départ. */
  complement?: ReactNode;
}

/** Prêter un objet du parc (matériel ou véhicule) : à qui, dans quel état, depuis quand, pour combien de jours. */
export function FormulairePret({ personnes, etats, etatInitial, enCours, erreur, onPreter, complement }: Props) {
  const { valeurs, erreurs, changer, valider } = useFormulaire(saisiePretVierge(etatInitial));

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const s = valider(schemaSaisiePret);
    if (s) onPreter(s);
  }

  return (
    <form onSubmit={soumettre} noValidate aria-label="Prêter" className="flex flex-col gap-3">
      {!!erreur && <Alert variant="erreur">{messageErreur(erreur)}</Alert>}
      <div className="grid gap-3 sm:grid-cols-4">
        <ChampChoix
          libelle="Prêté à"
          requis
          valeur={valeurs.salarie_id}
          onChange={(v) => changer("salarie_id", v)}
          erreur={erreurs.salarie_id}
          options={[{ valeur: "", libelle: "— Choisir —" }, ...personnes.map((p) => ({ valeur: p.id, libelle: nomPersonne(p) }))]}
        />
        <ChampChoix libelle="État au prêt" valeur={valeurs.etat} onChange={(v) => changer("etat", v)} options={etats.map((e) => ({ valeur: e, libelle: e }))} />
        <ChampTexte libelle="Date du prêt" type="date" valeur={valeurs.date_debut} onChange={(v) => changer("date_debut", v)} erreur={erreurs.date_debut} />
        <ChampTexte libelle="Durée (jours)" inputMode="numeric" valeur={valeurs.duree_jours} onChange={(v) => changer("duree_jours", v)} erreur={erreurs.duree_jours} />
      </div>
      {complement}
      <div>
        <Button type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Prêter"}
        </Button>
      </div>
    </form>
  );
}
