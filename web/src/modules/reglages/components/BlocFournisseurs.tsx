import { useState, type FormEvent } from "react";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { ChampTexte, ChampZone } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { messageErreur } from "@/lib/erreurs";
import { useFormulaire } from "@/lib/useFormulaire";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import type { Fournisseur } from "../api/intervenants";
import { schemaSaisieFournisseur, type SaisieFournisseur } from "../domain/intervenants";
import { useEcrireFournisseurs, useFournisseurs } from "../hooks/useReglagesEcran";

/** L'annuaire des fournisseurs — pièces, matériaux, location (PAR-06). */
export function BlocFournisseurs() {
  const fournisseurs = useFournisseurs();
  const ecrire = useEcrireFournisseurs();
  const modifiable = usePermission("reglages", "modifier");
  const [edition, setEdition] = useState<Fournisseur | "nouveau" | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fournisseurs</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {ecrire.actif.isError && <Alert variant="erreur">{messageErreur(ecrire.actif.error)}</Alert>}
        {fournisseurs.isPending ? (
          <Chargement />
        ) : fournisseurs.isError ? (
          <Erreur erreur={fournisseurs.error} reessayer={() => void fournisseurs.refetch()} />
        ) : fournisseurs.data.length === 0 ? (
          <Vide message="Aucun fournisseur enregistré." />
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {fournisseurs.data.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-2 text-sm">
                <div>
                  <p className="font-medium">
                    {f.nom} {f.specialite && <span className="text-muted-foreground">— {f.specialite}</span>} {!f.actif && <Badge variant="neutre">inactif</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">{[f.contact_nom, f.telephone, f.email, f.ville].filter(Boolean).join(" · ")}</p>
                </div>
                {modifiable && (
                  <span className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setEdition(f)}>Modifier</Button>
                    <Button size="sm" variant="ghost" onClick={() => ecrire.actif.mutate({ id: f.id, actif: !f.actif })}>{f.actif ? "Désactiver" : "Réactiver"}</Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {modifiable &&
          (edition ? (
            <FormulaireFournisseur key={edition === "nouveau" ? "nouveau" : edition.id} fournisseur={edition === "nouveau" ? null : edition} onFermer={() => setEdition(null)} />
          ) : (
            <div>
              <Button onClick={() => setEdition("nouveau")}>Nouveau fournisseur</Button>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

const CHAMPS: readonly [keyof SaisieFournisseur, string][] = [
  ["nom", "Nom"],
  ["specialite", "Spécialité"],
  ["contact_nom", "Contact"],
  ["telephone", "Téléphone"],
  ["email", "E-mail"],
  ["siret", "SIRET"],
  ["adresse", "Adresse"],
  ["code_postal", "Code postal"],
  ["ville", "Ville"],
];

function FormulaireFournisseur({ fournisseur, onFermer }: { fournisseur: Fournisseur | null; onFermer: () => void }) {
  const ecrire = useEcrireFournisseurs();
  const initiales = Object.fromEntries([...CHAMPS.map(([c]) => c), "notes"].map((c) => [c, fournisseur?.[c as keyof Fournisseur]?.toString() ?? ""])) as Record<
    keyof SaisieFournisseur,
    string
  >;
  const { valeurs, erreurs, changer, valider } = useFormulaire(initiales);

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const saisie = valider(schemaSaisieFournisseur);
    if (saisie) ecrire.enregistrer.mutate({ avant: fournisseur, saisie }, { onSuccess: onFermer });
  }

  return (
    <form onSubmit={soumettre} noValidate className="grid gap-3 rounded-md border border-dashed border-border p-3 sm:grid-cols-2">
      {CHAMPS.map(([c, libelle]) => (
        <ChampTexte key={c} libelle={libelle} valeur={valeurs[c]} onChange={(v) => changer(c, v)} erreur={erreurs[c]} requis={c === "nom"} />
      ))}
      <div className="sm:col-span-2">
        <ChampZone libelle="Notes" valeur={valeurs.notes} onChange={(v) => changer("notes", v)} />
      </div>
      {ecrire.enregistrer.isError && <Alert variant="erreur" className="sm:col-span-2">{messageErreur(ecrire.enregistrer.error)}</Alert>}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={ecrire.enregistrer.isPending}>{ecrire.enregistrer.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
        <Button variant="ghost" onClick={onFermer}>Annuler</Button>
      </div>
    </form>
  );
}
