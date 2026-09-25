import { useState, type FormEvent } from "react";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { messageErreur } from "@/lib/erreurs";
import { cn } from "@/lib/utils";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import type { Metier } from "../api/listes";
import { echange, ordonner, PALETTE_METIERS, prochainePosition, schemaSaisieMetier } from "../domain/listes";
import { useEcrireMetiers, useMetiers } from "../hooks/useReglagesEcran";

/**
 * Les métiers (PAR-05) : couleur choisie dans la palette, position, et deux
 * règles tenues par la base — suppression refusée si le métier est employé,
 * renommage propagé partout sauf dans les factures émises.
 */
export function ListeMetiers() {
  const metiers = useMetiers();
  const ecrire = useEcrireMetiers();
  const modifiable = usePermission("reglages", "modifier");
  const [edition, setEdition] = useState<{ id: string | null; libelle: string; couleur: string } | null>(null);

  if (metiers.isPending) return <Chargement />;
  if (metiers.isError) return <Erreur erreur={metiers.error} reessayer={() => void metiers.refetch()} />;
  const liste = ordonner(metiers.data);
  const erreur = [ecrire.creer, ecrire.modifier, ecrire.supprimer, ecrire.placer].find((m) => m.isError)?.error;

  const deplacer = (m: Metier, sens: -1 | 1) => {
    const p = echange(liste, m.id, sens);
    if (p) ecrire.placer.mutate(p);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Les corps d'état de la société : bons, tâches, équipes et sous-totaux par métier.</p>
      {erreur !== undefined && <Alert variant="erreur">{messageErreur(erreur)}</Alert>}
      {liste.length === 0 ? (
        <Vide message="Aucun métier enregistré pour cette société." />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {liste.map((m, i) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-2 text-sm">
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="h-4 w-4 rounded border border-border" style={{ background: m.couleur ?? "#999999" }} />
                {m.libelle}
              </span>
              {modifiable && (
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" aria-label={`Monter ${m.libelle}`} disabled={i === 0} onClick={() => deplacer(m, -1)}>↑</Button>
                  <Button size="sm" variant="ghost" aria-label={`Descendre ${m.libelle}`} disabled={i === liste.length - 1} onClick={() => deplacer(m, 1)}>↓</Button>
                  <Button size="sm" variant="outline" onClick={() => setEdition({ id: m.id, libelle: m.libelle, couleur: m.couleur ?? PALETTE_METIERS[0] })}>Modifier</Button>
                  <BoutonConfirme libelle="Supprimer" question={`Supprimer le métier « ${m.libelle} » ?`} onConfirmer={() => ecrire.supprimer.mutate(m.id)} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {modifiable &&
        (edition ? (
          <FormulaireMetier
            valeur={edition}
            onChange={setEdition}
            enCours={ecrire.creer.isPending || ecrire.modifier.isPending}
            onFermer={() => setEdition(null)}
            onEnregistrer={(saisie) => {
              const fermer = { onSuccess: () => setEdition(null) };
              if (edition.id) ecrire.modifier.mutate({ id: edition.id, saisie }, fermer);
              else ecrire.creer.mutate({ saisie, position: prochainePosition(liste) }, fermer);
            }}
          />
        ) : (
          <div>
            <Button onClick={() => setEdition({ id: null, libelle: "", couleur: PALETTE_METIERS[0] })}>Nouveau métier</Button>
          </div>
        ))}
    </div>
  );
}

interface EditionMetier {
  id: string | null;
  libelle: string;
  couleur: string;
}

function FormulaireMetier(props: {
  valeur: EditionMetier;
  onChange: (v: EditionMetier) => void;
  onEnregistrer: (s: { libelle: string; couleur: string }) => void;
  onFermer: () => void;
  enCours: boolean;
}) {
  const [erreur, setErreur] = useState<string | undefined>();
  const v = props.valeur;
  function soumettre(e: FormEvent) {
    e.preventDefault();
    const r = schemaSaisieMetier.safeParse(v);
    if (!r.success) return setErreur(r.error.issues[0]?.message);
    setErreur(undefined);
    props.onEnregistrer(r.data);
  }
  return (
    <form onSubmit={soumettre} noValidate className="flex flex-col gap-3 rounded-md border border-dashed border-border p-3">
      <ChampTexte libelle="Nom du métier" valeur={v.libelle} onChange={(libelle) => props.onChange({ ...v, libelle })} erreur={erreur} placeholder="Ex : Menuiserie, Serrurerie…" />
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Couleur</legend>
        <div className="flex flex-wrap gap-1.5">
          {PALETTE_METIERS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={c === v.couleur}
              onClick={() => props.onChange({ ...v, couleur: c })}
              className={cn("h-7 w-7 rounded border border-border", c === v.couleur && "ring-2 ring-ring ring-offset-2")}
              style={{ background: c }}
            />
          ))}
        </div>
      </fieldset>
      {v.id && <p className="text-xs text-muted-foreground">Renommer suit partout — bons, tâches, lignes —, sauf les factures déjà émises.</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={props.enCours}>{props.enCours ? "Enregistrement…" : "Enregistrer"}</Button>
        <Button variant="ghost" onClick={props.onFermer}>Annuler</Button>
      </div>
    </form>
  );
}
