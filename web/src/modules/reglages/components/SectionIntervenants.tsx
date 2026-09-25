import { useState, type FormEvent } from "react";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { messageErreur } from "@/lib/erreurs";
import { useFormulaire } from "@/lib/useFormulaire";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { useMembres } from "@/modules/comptes/hooks/useComptes";
import type { FicheConducteur } from "../api/intervenants";
import { comptesLiables, schemaSaisieConducteur } from "../domain/intervenants";
import { useEcrireConducteurs, useFichesConducteurs } from "../hooks/useReglagesEcran";
import { BlocFournisseurs } from "./BlocFournisseurs";

/** Conducteurs de travaux et fournisseurs (PAR-06). Sous-traitants et équipes : écran RH. */
export function SectionIntervenants() {
  return (
    <div className="flex flex-col gap-4">
      <BlocConducteurs />
      <BlocFournisseurs />
    </div>
  );
}

function BlocConducteurs() {
  const fiches = useFichesConducteurs();
  const ecrire = useEcrireConducteurs();
  const modifiable = usePermission("reglages", "modifier");
  const [edition, setEdition] = useState<FicheConducteur | "nouveau" | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conducteurs de travaux</CardTitle>
        <p className="text-sm text-muted-foreground">Proposés dans les devis, bons, factures et chantiers. Un conducteur retiré garde ses affaires.</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {ecrire.actif.isError && <Alert variant="erreur">{messageErreur(ecrire.actif.error)}</Alert>}
        {fiches.isPending ? (
          <Chargement />
        ) : fiches.isError ? (
          <Erreur erreur={fiches.error} reessayer={() => void fiches.refetch()} />
        ) : fiches.data.length === 0 ? (
          <Vide message="Aucun conducteur de travaux enregistré pour cette société." />
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {fiches.data.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-2 text-sm">
                <div>
                  <p className="font-medium">
                    {c.nom} {!c.actif && <Badge variant="neutre">retiré</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">{[c.telephone, c.email].filter(Boolean).join(" · ")}</p>
                  {!c.profile_id && <p className="text-xs text-muted-foreground">⚠ Sans compte : son tableau de bord montre les affaires de toute la société.</p>}
                </div>
                {modifiable && (
                  <span className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setEdition(c)}>Modifier</Button>
                    <Button size="sm" variant="ghost" onClick={() => ecrire.actif.mutate({ id: c.id, actif: !c.actif })}>
                      {c.actif ? "Retirer" : "Remettre"}
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {modifiable &&
          (edition ? (
            <FormulaireConducteur
              key={edition === "nouveau" ? "nouveau" : edition.id}
              fiche={edition === "nouveau" ? null : edition}
              fiches={fiches.data ?? []}
              onFermer={() => setEdition(null)}
            />
          ) : (
            <div>
              <Button onClick={() => setEdition("nouveau")}>Nouveau conducteur</Button>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

function FormulaireConducteur({ fiche, fiches, onFermer }: { fiche: FicheConducteur | null; fiches: readonly FicheConducteur[]; onFermer: () => void }) {
  const ecrire = useEcrireConducteurs();
  const membres = useMembres();
  const { valeurs, erreurs, changer, valider } = useFormulaire({
    nom: fiche?.nom ?? "",
    email: fiche?.email ?? "",
    telephone: fiche?.telephone ?? "",
    profile_id: fiche?.profile_id ?? "",
  });
  const comptes = comptesLiables(membres.data ?? [], fiches, fiche?.id ?? null);

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const saisie = valider(schemaSaisieConducteur);
    if (saisie) ecrire.enregistrer.mutate({ avant: fiche, saisie }, { onSuccess: onFermer });
  }

  return (
    <form onSubmit={soumettre} noValidate className="grid gap-3 rounded-md border border-dashed border-border p-3 sm:grid-cols-2">
      {fiche?.salarie_id && (
        <Alert className="sm:col-span-2">Cette fiche suit un salarié : modifiez nom, téléphone et e-mail dans sa fiche RH, qui réécrirait ce qui serait changé ici.</Alert>
      )}
      <div className="sm:col-span-2">
        <ChampTexte libelle="Nom" valeur={valeurs.nom} onChange={(v) => changer("nom", v)} erreur={erreurs.nom} requis />
      </div>
      <ChampTexte libelle="Téléphone" type="tel" valeur={valeurs.telephone} onChange={(v) => changer("telephone", v)} />
      <ChampTexte libelle="E-mail" type="email" valeur={valeurs.email} onChange={(v) => changer("email", v)} erreur={erreurs.email} />
      <div className="sm:col-span-2">
        <ChampChoix
          libelle="Compte utilisateur"
          valeur={valeurs.profile_id}
          onChange={(v) => changer("profile_id", v)}
          options={[{ valeur: "", libelle: "— Aucun —" }, ...comptes]}
          aide="Sans compte, son tableau de bord montrera les affaires de toute la société au lieu des siennes."
        />
      </div>
      {ecrire.enregistrer.isError && <Alert variant="erreur" className="sm:col-span-2">{messageErreur(ecrire.enregistrer.error)}</Alert>}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={ecrire.enregistrer.isPending}>{ecrire.enregistrer.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
        <Button variant="ghost" onClick={onFermer}>Annuler</Button>
      </div>
    </form>
  );
}
