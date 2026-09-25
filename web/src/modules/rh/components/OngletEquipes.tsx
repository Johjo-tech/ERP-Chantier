import { useState, type FormEvent } from "react";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { Input, Select } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { messageErreur } from "@/lib/erreurs";
import { useMetiers } from "@/modules/reglages/hooks/useReglagesEcran";
import { libelleEquipe, membresDe, sansEquipe, schemaSaisieEquipe, valeursEquipe, type Equipe } from "../domain/intervenants";
import { nomComplet, type Salarie } from "../domain/salarie";
import { useDroitsRh, useEquipes, useGererIntervenants, useGererSalaries, useSalariesRh } from "../hooks/useRh";
import { CasesMetiers } from "./communs";

/**
 * Les équipes et leurs membres (RH-02). Une équipe est une ligne de
 * `techniciens` ; ses membres sont les salariés actifs dont « Équipe » la
 * désigne. L'appartenance décide de qui peut déclarer les travaux faits : un
 * membre sans compte ne pointera jamais lui-même.
 */
export function OngletEquipes() {
  const equipes = useEquipes();
  const salaries = useSalariesRh();
  const droits = useDroitsRh();
  const gerer = useGererIntervenants();
  const rattacher = useGererSalaries().equipe;
  const [edition, setEdition] = useState<Equipe | "nouvelle" | null>(null);

  if (equipes.isPending || salaries.isPending) return <Chargement />;
  const erreur = equipes.error ?? salaries.error;
  if (erreur) return <Erreur erreur={erreur} reessayer={() => void Promise.all([equipes.refetch(), salaries.refetch()])} />;
  const libres = sansEquipe(salaries.data ?? []);
  const echec = gerer.supprimerEquipe.error ?? rattacher.error;

  return (
    <div className="flex flex-col gap-3">
      {droits.intervenants &&
        (edition ? (
          <FormulaireEquipe key={edition === "nouvelle" ? "nouvelle" : edition.id} equipe={edition === "nouvelle" ? null : edition} onFermer={() => setEdition(null)} />
        ) : (
          <div>
            <Button onClick={() => setEdition("nouvelle")}>+ Nouvelle équipe</Button>
          </div>
        ))}
      {echec && <Alert variant="erreur">{messageErreur(echec)}</Alert>}
      {(equipes.data ?? []).length === 0 ? (
        <Vide message="Aucune équipe. Créez-en une pour pouvoir planifier." />
      ) : (
        (equipes.data ?? []).map((e) => (
          <CarteEquipe key={e.id} equipe={e} membres={membresDe(salaries.data ?? [], e.id)} libres={libres} modifier={() => setEdition(e)} supprimer={() => gerer.supprimerEquipe.mutate(e.id)} rattacher={(salarieId, equipeId) => rattacher.mutate({ salarieId, equipeId })} />
        ))
      )}
      {libres.length > 0 && (
        <section aria-label="Salariés sans équipe" className="rounded-md border border-border p-3 text-sm">
          <h3 className="font-semibold">Salariés sans équipe ({libres.length})</h3>
          <p className="text-muted-foreground">{libres.map(nomComplet).join(" · ")}</p>
        </section>
      )}
    </div>
  );
}

interface PropsCarte {
  equipe: Equipe;
  membres: Salarie[];
  libres: Salarie[];
  modifier: () => void;
  supprimer: () => void;
  rattacher: (salarieId: string, equipeId: string | null) => void;
}

function CarteEquipe({ equipe, membres, libres, modifier, supprimer, rattacher }: PropsCarte) {
  const droits = useDroitsRh();
  const [choix, setChoix] = useState("");
  const nom = libelleEquipe(equipe);
  const metiers = equipe.metiers.length ? equipe.metiers.join(", ") : equipe.metier;
  return (
    <article aria-label={`Équipe ${nom}`} className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            {equipe.couleur && <span aria-hidden="true" className="size-3 rounded-full" style={{ background: equipe.couleur }} />}
            {nom}
          </h3>
          <p className="text-sm text-muted-foreground">{metiers ? `🔧 ${metiers}` : "Aucun métier"} · {membres.length} membre{membres.length > 1 ? "s" : ""}</p>
        </div>
        {droits.intervenants && (
          <span className="flex gap-2">
            <Button size="sm" variant="outline" onClick={modifier}>Modifier</Button>
            <BoutonConfirme libelle="Supprimer" question={`Supprimer l'équipe ${nom} ? Ses membres et ses tâches passeront « sans équipe ».`} onConfirmer={supprimer} />
          </span>
        )}
      </div>
      {membres.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Aucun membre. Cette équipe ne peut rien déclarer.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border text-sm">
          {membres.map((s) => (
            <li key={s.id} className="flex items-center gap-2 py-1">
              <span className="flex-1">{nomComplet(s)}{s.poste && <span className="text-muted-foreground"> · {s.poste}</span>}</span>
              {!s.profileId && <Badge variant="alerte" title="Sans compte, ce membre ne peut pas déclarer ses travaux lui-même">⚠ sans compte</Badge>}
              {droits.modifier && <Button size="sm" variant="ghost" onClick={() => rattacher(s.id, null)}>Retirer</Button>}
            </li>
          ))}
        </ul>
      )}
      {droits.modifier && libres.length > 0 && (
        <div className="mt-2 flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor={`ajout-${equipe.id}`}>Ajouter un salarié à {nom}</Label>
            <Select id={`ajout-${equipe.id}`} value={choix} onChange={(e) => setChoix(e.target.value)}>
              <option value="">— Choisir —</option>
              {libres.map((s) => (
                <option key={s.id} value={s.id}>{nomComplet(s)}</option>
              ))}
            </Select>
          </div>
          <Button size="sm" disabled={!choix} onClick={() => { rattacher(choix, equipe.id); setChoix(""); }}>+ Ajouter</Button>
        </div>
      )}
    </article>
  );
}

function FormulaireEquipe({ equipe, onFermer }: { equipe: Equipe | null; onFermer: () => void }) {
  const gerer = useGererIntervenants();
  const metiers = useMetiers();
  const initiales = valeursEquipe(equipe);
  const [nom, setNom] = useState(initiales.nom);
  const [couleur, setCouleur] = useState(initiales.couleur);
  const [coches, setCoches] = useState<string[]>(initiales.metiers);
  const [erreur, setErreur] = useState<string | null>(null);

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const r = schemaSaisieEquipe.safeParse({ nom, couleur, metiers: coches });
    if (!r.success) return setErreur(r.error.issues[0]?.message ?? "Saisie invalide.");
    setErreur(null);
    gerer.equipe.mutate({ id: equipe?.id ?? null, saisie: r.data }, { onSuccess: onFermer });
  }

  return (
    <form onSubmit={soumettre} noValidate aria-label={equipe ? "Modifier l'équipe" : "Nouvelle équipe"} className="grid gap-3 rounded-md border border-dashed border-border p-3 sm:grid-cols-2">
      <ChampTexte libelle="Nom de l'équipe" valeur={nom} onChange={setNom} requis placeholder="Ex : Équipe peinture, Karim & Yanis…" erreur={erreur ?? undefined} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="couleur-equipe">Couleur au planning</Label>
        <Input id="couleur-equipe" type="color" className="h-9 w-20 p-1" value={couleur} onChange={(e) => setCouleur(e.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <CasesMetiers legende="Métier(s)" referentiel={(metiers.data ?? []).map((m) => m.libelle)} coches={coches} onChange={setCoches} />
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">Les membres se rattachent ci-dessous, ou depuis la fiche de chaque salarié.</p>
      {gerer.equipe.isError && <Alert variant="erreur" className="sm:col-span-2">{messageErreur(gerer.equipe.error)}</Alert>}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={gerer.equipe.isPending}>Enregistrer</Button>
        <Button variant="ghost" onClick={onFermer}>Annuler</Button>
      </div>
    </form>
  );
}
