import { useState, type FormEvent } from "react";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { Input } from "@/components/ui/input";
import { messageErreur } from "@/lib/erreurs";
import { cn } from "@/lib/utils";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import type { Entree } from "../api/listes";
import { CLES_DOMAINES, DOMAINES_LISTES, echange, ordonner, prochainePosition, schemaSaisieEntree, type DomaineListe } from "../domain/listes";
import { useEcrireEntrees, useEntrees } from "../hooks/useReglagesEcran";
import { ListeMetiers } from "./ListeMetiers";

type Onglet = "metiers" | DomaineListe;

/** Les listes de choix de la société, une par onglet ; les métiers gardent leur formulaire à couleurs (PAR-04, PAR-05). */
export function SectionListes() {
  const [onglet, setOnglet] = useState<Onglet>("metiers");
  const onglets: { id: Onglet; titre: string }[] = [{ id: "metiers", titre: "Métiers" }, ...CLES_DOMAINES.map((d) => ({ id: d, titre: DOMAINES_LISTES[d].titre }))];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Listes de choix</CardTitle>
        <div role="tablist" aria-label="Listes" className="flex flex-wrap gap-1 pt-2">
          {onglets.map((o) => (
            <button
              key={o.id}
              role="tab"
              type="button"
              aria-selected={o.id === onglet}
              onClick={() => setOnglet(o.id)}
              className={cn("rounded-md px-3 py-1 text-sm hover:bg-muted", o.id === onglet && "bg-primary/10 font-medium text-primary")}
            >
              {o.titre}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent role="tabpanel">{onglet === "metiers" ? <ListeMetiers /> : <ListeReferentiel key={onglet} domaine={onglet} />}</CardContent>
    </Card>
  );
}

function ListeReferentiel({ domaine }: { domaine: DomaineListe }) {
  const def = DOMAINES_LISTES[domaine];
  const entrees = useEntrees();
  const ecrire = useEcrireEntrees();
  const modifiable = usePermission("reglages", "modifier");
  const [nouveau, setNouveau] = useState("");
  const [enEdition, setEnEdition] = useState<{ id: string; libelle: string } | null>(null);
  const [refus, setRefus] = useState<string | null>(null);

  if (entrees.isPending) return <Chargement />;
  if (entrees.isError) return <Erreur erreur={entrees.error} reessayer={() => void entrees.refetch()} />;
  const liste = ordonner(entrees.data.filter((e) => e.domaine === domaine));
  const erreur = [ecrire.creer, ecrire.renommer, ecrire.supprimer, ecrire.placer].find((m) => m.isError)?.error;

  function ajouter(e: FormEvent) {
    e.preventDefault();
    const r = schemaSaisieEntree.safeParse({ libelle: nouveau });
    if (!r.success) return setRefus(r.error.issues[0]?.message ?? "Libellé invalide.");
    setRefus(null);
    ecrire.creer.mutate({ domaine, libelle: r.data.libelle, position: prochainePosition(liste) }, { onSuccess: () => setNouveau("") });
  }

  function renommer(e: FormEvent) {
    e.preventDefault();
    if (!enEdition) return;
    const r = schemaSaisieEntree.safeParse({ libelle: enEdition.libelle });
    if (!r.success) return setRefus(r.error.issues[0]?.message ?? "Libellé invalide.");
    setRefus(null);
    ecrire.renommer.mutate({ id: enEdition.id, libelle: r.data.libelle }, { onSuccess: () => setEnEdition(null) });
  }

  const deplacer = (e: Entree, sens: -1 | 1) => {
    const p = echange(liste, e.id, sens);
    if (p) ecrire.placer.mutate(p);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{def.aide}</p>
      {(refus || erreur) && <Alert variant="erreur">{refus ?? messageErreur(erreur)}</Alert>}
      {liste.length === 0 ? (
        <Vide message="Aucune entrée dans cette liste." />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {liste.map((e, i) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 p-2 text-sm">
              {enEdition?.id === e.id ? (
                <form onSubmit={renommer} className="flex flex-1 gap-2">
                  <Input aria-label="Nouveau libellé" value={enEdition.libelle} onChange={(ev) => setEnEdition({ id: e.id, libelle: ev.target.value })} autoFocus />
                  <Button type="submit" size="sm">Enregistrer</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEnEdition(null)}>Annuler</Button>
                </form>
              ) : (
                <span className="flex items-center gap-2">
                  {e.couleur && <span aria-hidden="true" className="h-3 w-3 rounded" style={{ background: e.couleur }} />}
                  {e.icone ? `${e.icone} ` : ""}
                  {e.libelle}
                  {e.code && <code className="text-xs text-muted-foreground">{e.code}</code>}
                </span>
              )}
              {modifiable && enEdition?.id !== e.id && (
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" aria-label={`Monter ${e.libelle}`} disabled={i === 0} onClick={() => deplacer(e, -1)}>↑</Button>
                  <Button size="sm" variant="ghost" aria-label={`Descendre ${e.libelle}`} disabled={i === liste.length - 1} onClick={() => deplacer(e, 1)}>↓</Button>
                  <Button size="sm" variant="outline" onClick={() => setEnEdition({ id: e.id, libelle: e.libelle })}>Renommer</Button>
                  <BoutonConfirme libelle="Supprimer" question={`Supprimer « ${e.libelle} » ?`} onConfirmer={() => ecrire.supprimer.mutate(e.id)} />
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {modifiable && (
        <form onSubmit={ajouter} className="flex gap-2">
          <Input aria-label={`Nouvelle ${def.singulier}`} placeholder={`Nouvelle ${def.singulier}`} value={nouveau} onChange={(e) => setNouveau(e.target.value)} />
          <Button type="submit" disabled={ecrire.creer.isPending}>Ajouter</Button>
        </form>
      )}
      <p className="text-xs text-muted-foreground">Le code interne est posé à la création et ne change plus : les fiches qui emploient une valeur la gardent.</p>
    </div>
  );
}
