import { useMemo, useState, type ReactNode } from "react";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { messageErreur } from "@/lib/erreurs";
import { formatEurosEcran } from "@/lib/modeDiscret";
import type { LigneDpgfBase } from "../api/dpgf";
import type { Chantier } from "../domain/chantier";
import { avancementChantier, estFactureeEntierement, lignesFigees } from "../domain/dpgf";
import { validerLignesDpgf, type BrouillonLigneDpgf } from "../domain/saisie-dpgf";
import { useDpgf, useEnregistrerLignesDpgf, useSupprimerLigneDpgf, useTachesPlanifiees } from "../hooks/useChantiers";
import { useDevisAvecLignes, useMetiers } from "../hooks/useFiche";
import { BoutonDepot } from "./Fichiers";
import { DialoguePlanifier } from "./DialoguePlanifier";
import { FormulaireAjoutDpgf } from "./FormulaireAjoutDpgf";
import { ImportDpgf } from "./ImportDpgf";
import { RepriseDevis } from "./RepriseDevis";
import { TableDpgf } from "./TableDpgf";

interface Props {
  chantier: Chantier;
  /** Actions apportées par d'autres modules (situation de travaux), composées dans app/. */
  actions?: ReactNode;
  actionsSelection?: (ids: string[]) => ReactNode;
  fichierAImporter: File | null;
  importer: (f: File | null) => void;
}

const depuisServeur = (l: LigneDpgfBase, figee: boolean): BrouillonLigneDpgf => ({
  id: l.id,
  type: l.type,
  designation: l.designation,
  quantite: String(l.quantite).replace(".", ","),
  prix_unitaire: String(l.prix_unitaire).replace(".", ","),
  metier: l.metier ?? "",
  figee,
});

/** « DPGF chiffré — suivi d'avancement » (CHA-06 à CHA-09, CHA-15), repliable. */
export function BlocDpgf({ chantier, actions, actionsSelection, fichierAImporter, importer }: Props) {
  const dpgf = useDpgf(chantier.id);
  const taches = useTachesPlanifiees(chantier.id);
  const metiers = useMetiers();
  const devis = useDevisAvecLignes(chantier.id);
  const enregistrer = useEnregistrerLignesDpgf(chantier.id);
  const supprimer = useSupprimerLigneDpgf(chantier.id);
  const [replie, setReplie] = useState(false);
  const [modifiees, setModifiees] = useState<Record<string, BrouillonLigneDpgf>>({});
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [aPlanifier, setAPlanifier] = useState<LigneDpgfBase | null>(null);
  const figees = useMemo(() => lignesFigees(dpgf.data ?? [], taches.data ?? []), [dpgf.data, taches.data]);
  const devisSource = useMemo(() => new Map((devis.data ?? []).map((d) => [d.id, d.numero ?? "brouillon"])), [devis.data]);

  if (dpgf.isPending) return <Chargement libelle="Chargement du DPGF…" />;
  if (dpgf.isError) return <Erreur erreur={dpgf.error} reessayer={() => void dpgf.refetch()} />;
  const lignes = dpgf.data;
  const a = avancementChantier(lignes);
  const positionSuivante = lignes.reduce((max, x) => Math.max(max, x.position), -1) + 1;
  const brouillon = (l: LigneDpgfBase) => modifiees[l.id] ?? depuisServeur(l, figees.has(l.id));
  const nbModifiees = Object.keys(modifiees).length;
  const selectionnees = lignes.filter((l) => selection.has(l.id) && !estFactureeEntierement(l)).map((l) => l.id);

  function changer(l: LigneDpgfBase, champ: "designation" | "quantite" | "prix_unitaire" | "metier", valeur: string) {
    setModifiees((m) => ({ ...m, [l.id]: { ...brouillon(l), [champ]: valeur } }));
  }
  function basculer(id: string) {
    setSelection((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toutEnregistrer() {
    const v = validerLignesDpgf(Object.values(modifiees));
    if (!v.ok) return setErreurs(v.erreurs);
    setErreurs({});
    enregistrer.mutate(v.lignes, { onSuccess: () => setModifiees({}) });
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" aria-expanded={!replie} aria-controls={`dpgf-${chantier.id}`} onClick={() => setReplie(!replie)} title={replie ? "Déplier" : "Replier"}>
            {replie ? "+" : "−"}
          </Button>
          <CardTitle>DPGF chiffré — suivi d'avancement</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          {replie ? `${lignes.filter((l) => l.type === "ligne").length} ligne(s) — ${formatEurosEcran(a.total)} HT` : "Cochez les lignes à facturer, puis validez ci-dessous"}
        </p>
        {actions}
      </CardHeader>
      {!replie && (
        <CardContent id={`dpgf-${chantier.id}`} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-border p-2">
            <span className="text-sm">
              <strong>Importer un DPGF existant</strong> — fichier Excel (.xlsx) ou CSV, lignes extraites automatiquement
            </span>
            <BoutonDepot libelle="Analyser un fichier" accepte=".xlsx,.xls,.csv" onFichier={importer} />
          </div>
          {fichierAImporter && <ImportDpgf key={`${fichierAImporter.name}-${fichierAImporter.lastModified}`} chantierId={chantier.id} fichier={fichierAImporter} lignes={lignes} figees={figees} fermer={() => importer(null)} />}
          <RepriseDevis chantierId={chantier.id} devis={devis.data ?? []} lignes={lignes} figees={figees} />
          {(enregistrer.isError || supprimer.isError) && <Alert variant="erreur">{messageErreur(enregistrer.error ?? supprimer.error)}</Alert>}
          {taches.isError && <Erreur erreur={taches.error} reessayer={() => void taches.refetch()} />}
          {lignes.length === 0 ? (
            <Vide message="Aucune ligne pour l'instant." />
          ) : (
            <TableDpgf
              lignes={lignes}
              brouillon={brouillon}
              changer={changer}
              erreurs={erreurs}
              selection={selection}
              basculer={basculer}
              taches={taches.data ?? []}
              metiers={metiers.data ?? []}
              devisSource={devisSource}
              // Le bon reprend le métier ENREGISTRÉ : une saisie en attente doit d'abord partir.
              onPlanifier={(l) => (modifiees[l.id] ? setErreurs({ [`${l.id}.designation`]: "Enregistrez d'abord les modifications de cette ligne." }) : setAPlanifier(l))}
              onSupprimer={(id) => supprimer.mutate(id)}
            />
          )}
          {aPlanifier && (
            <DialoguePlanifier key={aPlanifier.id} chantier={chantier} ligne={aPlanifier} taches={taches.data ?? []} fermer={() => setAPlanifier(null)} planifiee={() => setAPlanifier(null)} />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={toutEnregistrer} disabled={!nbModifiees || enregistrer.isPending}>
              {enregistrer.isPending ? "Enregistrement…" : `Enregistrer les lignes${nbModifiees ? ` (${nbModifiees})` : ""}`}
            </Button>
            {nbModifiees > 0 && <Button size="sm" variant="ghost" onClick={() => setModifiees({})}>Annuler les modifications</Button>}
            <span className="ml-auto">{actionsSelection?.(selectionnees)}</span>
          </div>
          <dl className="grid gap-1 text-sm sm:grid-cols-3">
            <div><dt className="inline text-muted-foreground">Total DPGF (HT) : </dt><dd className="inline font-semibold tabular-nums">{formatEurosEcran(a.total)}</dd></div>
            <div><dt className="inline text-muted-foreground">Déjà facturé : </dt><dd className="inline font-semibold tabular-nums">{formatEurosEcran(a.facture)} ({a.pourcentage} %)</dd></div>
            <div><dt className="inline text-muted-foreground">Reste à facturer : </dt><dd className="inline font-semibold tabular-nums">{formatEurosEcran(a.reste)}</dd></div>
          </dl>
          <FormulaireAjoutDpgf chantierId={chantier.id} positionSuivante={positionSuivante} />
        </CardContent>
      )}
    </Card>
  );
}
