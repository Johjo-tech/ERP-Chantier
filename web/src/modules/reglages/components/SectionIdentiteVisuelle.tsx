import { useState, type FormEvent } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { messageErreur } from "@/lib/erreurs";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { logoHerite, verifierLogo } from "@/modules/societes/domain/logo";
import { schemaCouleur, type ReglagesSociete } from "@/modules/societes/domain/reglages-societe";
import { useChangerLogo, useEnregistrerReglages, useInfosEntreprise, useLienLogo, useReglagesSociete, useSociete } from "@/modules/societes/hooks/useSocieteReglages";
import { paletteSociete } from "@/modules/societes/theme/palette";
import { PiedEnregistrement } from "./champs";

/** Logo et couleurs, réunis : ils font une seule chose, l'apparence de la société (SOC-04, SOC-08). */
export function SectionIdentiteVisuelle() {
  const reglages = useReglagesSociete();
  if (reglages.isPending) return <Chargement />;
  if (reglages.isError) return <Erreur erreur={reglages.error} reessayer={() => void reglages.refetch()} />;
  return (
    <div className="flex flex-col gap-4">
      <BlocLogo />
      <BlocCouleurs reglages={reglages.data} />
    </div>
  );
}

function BlocLogo() {
  const modifiable = usePermission("reglages", "modifier");
  const societe = useSociete();
  const infos = useInfosEntreprise();
  const chemin = societe.data?.logo_url ?? null;
  const lien = useLienLogo(chemin);
  const changer = useChangerLogo();
  const [refus, setRefus] = useState<string | null>(null);
  const herite = logoHerite(infos.data);
  const image = chemin ? lien.data : herite;

  function choisir(fichier: File | undefined) {
    if (!fichier) return;
    const motif = verifierLogo(fichier);
    setRefus(motif);
    if (!motif) changer.mutate({ fichier, ancien: chemin });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo</CardTitle>
        <p className="text-sm text-muted-foreground">Repris par l'application et par les documents générés.</p>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        {image ? (
          <img src={image} alt={`Logo de ${societe.data?.nom ?? "la société"}`} className="max-h-20 max-w-56 rounded border border-border p-2" />
        ) : (
          <p className="text-sm text-muted-foreground">Aucun logo : les documents porteront le nom de la société.</p>
        )}
        {!chemin && herite && <p className="text-xs text-muted-foreground">Logo repris de l'ancienne application : déposez-le à nouveau pour le ranger avec les fichiers.</p>}
        {refus && <Alert variant="erreur">{refus}</Alert>}
        {changer.isError && <Alert variant="erreur">{messageErreur(changer.error)}</Alert>}
        {modifiable && (
          <div className="flex gap-2">
            <label className="inline-flex cursor-pointer items-center rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
              {chemin || herite ? "Changer le logo" : "Ajouter un logo"}
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="sr-only" onChange={(e) => choisir(e.target.files?.[0])} disabled={changer.isPending} />
            </label>
            {chemin && (
              <Button variant="ghost" size="sm" disabled={changer.isPending} onClick={() => changer.mutate({ fichier: null, ancien: chemin })}>
                Retirer
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Pastille({ fond, encre, libelle }: { fond: string; encre: string; libelle: string }) {
  return (
    <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: fond, color: encre }}>
      {libelle}
    </span>
  );
}

function BlocCouleurs({ reglages }: { reglages: ReglagesSociete }) {
  const modifiable = usePermission("reglages", "modifier");
  const enregistrer = useEnregistrerReglages();
  const [accent, setAccent] = useState(reglages.documents.couleurAccent);
  const [secondaire, setSecondaire] = useState(reglages.documents.couleurSecondaire);
  const p = paletteSociete(accent, secondaire);
  const valides = schemaCouleur.safeParse(accent).success && schemaCouleur.safeParse(secondaire).success;

  function soumettre(e: FormEvent) {
    e.preventDefault();
    if (!valides) return;
    enregistrer.mutate((r) => ({ ...r, documents: { ...r.documents, couleurAccent: accent, couleurSecondaire: secondaire } }));
  }

  return (
    <form onSubmit={soumettre}>
      <Card>
        <CardHeader>
          <CardTitle>Couleurs de la société</CardTitle>
          <p className="text-sm text-muted-foreground">
            La principale porte les titres, les filets et le total TTC ; la secondaire les en-têtes de tableau. Les tons clair et foncé s'en déduisent, lisibles par construction.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              Principale
              <input type="color" value={p.accent.toLowerCase()} disabled={!modifiable} onChange={(e) => setAccent(e.target.value)} className="h-9 w-14 rounded border border-input" />
            </label>
            <label className="flex items-center gap-2">
              Secondaire
              <input type="color" value={p.secondaire.toLowerCase()} disabled={!modifiable} onChange={(e) => setSecondaire(e.target.value)} className="h-9 w-14 rounded border border-input" />
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Aperçu de la palette">
            <Pastille fond={p.accent} encre={p.surAccent} libelle="Accent" />
            <Pastille fond={p.accentFonce} encre={p.surAccentFonce} libelle="Titres" />
            <Pastille fond={p.accentClair} encre="#182233" libelle="Fonds" />
            <Pastille fond={p.secondaire} encre={p.surSecondaire} libelle="En-têtes" />
            <Pastille fond={p.secondaireClair} encre="#182233" libelle="Cartouches" />
          </div>
          <PiedEnregistrement modifiable={modifiable} enCours={enregistrer.isPending} erreur={enregistrer.error} succes={enregistrer.isSuccess ? "Couleurs enregistrées : l'écran les applique." : null} />
        </CardContent>
      </Card>
    </form>
  );
}
