import { useState } from "react";
import { Link } from "react-router";
import { Chargement } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import { rapportRejetsCsv } from "@/modules/articles/domain/import";
import { telechargerTexte } from "@/modules/articles/components/telechargement";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import type { ResultatImportFactures } from "../api/factures";
import { lignesRapportFactures } from "../domain/apercu-factures";
import { natureDuFichier, type CategorieTva } from "../domain/factures";
import { useApercuFactures, useEcrireFactures, useSupprimerBrouillons } from "../hooks/useImportExport";
import { ApercuFactures } from "./ApercuFactures";

interface Fichier {
  nom: string;
  octets: ArrayBuffer;
}

/**
 * Reprise d'un historique de facturation (IMP-20 à IMP-23) : les pièces déjà
 * émises ailleurs, avec LEUR numéro. Une facture numérotée ne se corrige ni ne
 * se supprime plus : l'aperçu, et ses totaux, sont le seul moment de vérité.
 */
export function PageImportFactures() {
  const autorise = usePermission("factures", "modifier");
  const [entetes, setEntetes] = useState<Fichier | null>(null);
  const [lignes, setLignes] = useState<Fichier | null>(null);
  const [categorie, setCategorie] = useState<CategorieTva | undefined>(undefined);
  const [progres, setProgres] = useState("");
  const apercu = useApercuFactures();
  const ecrire = useEcrireFactures((fait, total) => setProgres(`Écriture : ${fait} / ${total} pièces`));

  const titre = <EnTetePage titre="Reprendre un historique de facturation" actions={<Button variant="ghost" asChild><Link to="/factures">Retour aux factures</Link></Button>} />;
  if (!autorise) return <>{titre}<Alert variant="erreur">La reprise crée des factures définitives : il faut pouvoir créer ET modifier les factures.</Alert></>;

  function relancer(e: Fichier | null, l: Fichier | null, c: CategorieTva | undefined) {
    if (e) apercu.mutate({ entetes: e.octets, lignes: l?.octets ?? null, categorieTauxZero: c });
  }

  /* Un seul champ, un ou deux fichiers : c'est le programme qui reconnaît
     lequel est lequel. « Indécis » va aux factures, sauf si la place est prise. */
  async function choisir(liste: FileList | null) {
    let e = entetes;
    let l = lignes;
    for (const f of [...(liste ?? [])]) {
      const fichier = { nom: f.name, octets: await f.arrayBuffer() };
      const nature = natureDuFichier(fichier.octets);
      if (nature === "lignes" || (nature === "indecis" && e)) l = fichier;
      else e = fichier;
    }
    setEntetes(e);
    setLignes(l);
    ecrire.reset();
    relancer(e, l, categorie);
  }

  const rapport = () => apercu.data && telechargerTexte("import-factures-rapport.csv", `\uFEFF${rapportRejetsCsv(lignesRapportFactures(apercu.data))}`);

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      {titre}
      <p className="text-sm text-muted-foreground">
        Déposez le fichier des factures — une ligne par pièce : numéro, date (AAAA-MM-JJ), client, HT, TVA, TTC — et, s'il existe, le détail
        des lignes par compte comptable. Séparateur, encodage et noms de colonnes sont reconnus. <strong>Ces pièces ne pourront plus être
        modifiées ni supprimées</strong> une fois écrites.
      </p>
      <div>
        <label htmlFor="fichiers-factures" className="mb-1 block text-sm font-medium">Fichier(s) à reprendre</label>
        <input id="fichiers-factures" type="file" accept=".csv,.txt,text/csv" multiple disabled={ecrire.isPending} onChange={(ev) => void choisir(ev.target.files)} />
        {(entetes || lignes) && (
          <p className="mt-1 text-xs text-muted-foreground">
            Factures : {entetes?.nom ?? "—"} · Lignes : {lignes?.nom ?? "aucun fichier (facultatif)"}
          </p>
        )}
      </div>
      {apercu.isPending && <Chargement libelle="Lecture des fichiers…" />}
      {apercu.isError && <Alert variant="erreur">Les fichiers n'ont pas pu être lus : {messageErreur(apercu.error)}</Alert>}
      {apercu.data && !ecrire.isSuccess && !ecrire.isPending && (
        <ApercuFactures
          apercu={apercu.data}
          avecLignes={!!lignes}
          categorie={categorie}
          enCours={ecrire.isPending}
          onCategorie={(c) => {
            setCategorie(c);
            relancer(entetes, lignes, c);
          }}
          onEcrire={() => apercu.data && ecrire.mutate(apercu.data)}
          onRapport={rapport}
        />
      )}
      {ecrire.isPending && <Chargement libelle={progres || "Écriture…"} />}
      {ecrire.isError && <Alert variant="erreur">{messageErreur(ecrire.error)}</Alert>}
      {ecrire.isSuccess && <ResultatReprise resultat={ecrire.data} onRapport={rapport} />}
    </div>
  );
}

function ResultatReprise({ resultat: r, onRapport }: { resultat: ResultatImportFactures; onRapport: () => void }) {
  const supprimer = useSupprimerBrouillons();
  return (
    <>
      <Alert variant="succes">
        Reprise terminée — {r.ecrites} pièce(s) et {r.lignes} ligne(s) écrites{r.clientsCrees ? `, ${r.clientsCrees} fiche(s) client créée(s)` : ""}.
      </Alert>
      {r.echecs.length > 0 && (
        <Alert variant="erreur">
          <p className="font-semibold">{r.echecs.length} pièce(s) refusée(s)</p>
          <ul className="list-disc pl-5">
            {r.echecs.slice(0, 10).map((e) => <li key={e.numero}>{e.numero} — {e.motif} (à l'étape « {e.etape} »)</li>)}
          </ul>
        </Alert>
      )}
      {r.brouillonsOrphelins.length > 0 && !supprimer.isSuccess && (
        <Alert variant="erreur">
          <p>
            {r.brouillonsOrphelins.length} brouillon(s) sans numéro — {r.brouillonsOrphelins.map((b) => b.numero).slice(0, 10).join(", ")}. Incomplets, ils
            n'apparaissent pas dans la liste ; sans numéro, ils peuvent encore être supprimés.
          </p>
          <Button size="sm" variant="destructive" disabled={supprimer.isPending} onClick={() => supprimer.mutate(r.brouillonsOrphelins.map((b) => b.id))}>
            Supprimer ces brouillons
          </Button>
        </Alert>
      )}
      {supprimer.isSuccess && <Alert variant="succes">{supprimer.data} brouillon(s) supprimé(s).</Alert>}
      {supprimer.isError && <Alert variant="erreur">{messageErreur(supprimer.error)}</Alert>}
      <div>
        <Button variant="outline" onClick={onRapport}>Télécharger le rapport</Button>
      </div>
    </>
  );
}
