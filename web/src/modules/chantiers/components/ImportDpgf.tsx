import { useEffect, useId, useState } from "react";
import { Chargement } from "@/components/etats/Etats";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Table, TBody, Td, THead, Tr } from "@/components/ui/table";
import { messageErreur } from "@/lib/erreurs";
import type { LigneDpgfBase } from "../api/dpgf";
import { devinerLignesAIgnorer, lignesDepuisCorrespondance, nombreDeColonnes, rolesPour, type RoleColonne } from "../domain/import-dpgf";
import { lireFichierDpgf, type FichierDpgfLu } from "../fichiers/lecture-dpgf";
import { useImporterDpgf } from "../hooks/useChantiers";

const LIBELLES: Record<RoleColonne, string> = { designation: "Désignation", qte: "Quantité", prix: "Prix unitaire", ignore: "Ignorer" };
const APERCU = 8;

interface Props {
  chantierId: string;
  fichier: File;
  lignes: readonly LigneDpgfBase[];
  figees: ReadonlySet<string>;
  fermer: () => void;
}

/**
 * Correspondance des colonnes d'un DPGF importé (CHA-08) : feuille, lignes
 * d'en-tête à ignorer, rôle de chaque colonne, aperçu. Les rôles sont devinés
 * comme l'ancien écran, puis corrigeables un par un.
 */
export function ImportDpgf({ chantierId, fichier, lignes, figees, fermer }: Props) {
  const titre = useId();
  const [lu, setLu] = useState<FichierDpgfLu | null>(null);
  const [erreurLecture, setErreurLecture] = useState<unknown>(null);
  const [feuille, setFeuille] = useState("");
  const [aIgnorer, setAIgnorer] = useState("0");
  const [roles, setRoles] = useState<RoleColonne[]>([]);
  const [refus, setRefus] = useState<string | null>(null);
  const importer = useImporterDpgf(chantierId);

  function choisirFeuille(l: FichierDpgfLu, nom: string) {
    const rangees = l.feuilles[nom] ?? [];
    const n = devinerLignesAIgnorer(rangees);
    setFeuille(nom);
    setAIgnorer(String(n));
    setRoles(rolesPour(rangees, n));
  }

  useEffect(() => {
    let actif = true;
    lireFichierDpgf(fichier).then(
      (l) => {
        if (!actif) return;
        setLu(l);
        choisirFeuille(l, l.courante);
      },
      (e: unknown) => actif && setErreurLecture(e)
    );
    return () => {
      actif = false;
    };
  }, [fichier]);

  if (erreurLecture) return <Alert variant="erreur">Impossible de lire ce fichier : {messageErreur(erreurLecture)} <Button size="sm" variant="ghost" onClick={fermer}>Fermer</Button></Alert>;
  if (!lu) return <Chargement libelle="Lecture du fichier…" />;
  const rangees = lu.feuilles[feuille] ?? [];
  const n = Math.max(0, Number.parseInt(aIgnorer, 10) || 0);
  const nbColonnes = nombreDeColonnes(rangees);
  const aRemplacer = lignes.filter((l) => !figees.has(l.id)).map((l) => l.id);

  function changerIgnorees(v: string) {
    setAIgnorer(v);
    setRoles(rolesPour(rangees, Math.max(0, Number.parseInt(v, 10) || 0)));
  }

  function confirmer() {
    const r = lignesDepuisCorrespondance(rangees, n, roles);
    if (!r.ok) return setRefus(r.motif);
    setRefus(null);
    const suivante = lignes.reduce((max, l) => (figees.has(l.id) ? Math.max(max, l.position) : max), -1) + 1;
    importer.mutate({ lignes: r.lignes, aRemplacer, positionSuivante: suivante }, { onSuccess: fermer });
  }

  return (
    <section role="dialog" aria-labelledby={titre} className="flex flex-col gap-3 rounded-md border border-primary/40 bg-primary/5 p-3">
      <h3 id={titre} className="text-sm font-semibold">Importer « {fichier.name} »</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        {lu.noms.length > 1 && <ChampChoix libelle="Feuille du classeur" valeur={feuille} onChange={(v) => choisirFeuille(lu, v)} options={lu.noms.map((x) => ({ valeur: x, libelle: x }))} />}
        <ChampTexte libelle="Lignes d'en-tête à ignorer" inputMode="numeric" valeur={aIgnorer} onChange={changerIgnorees} />
      </div>
      <div className="overflow-x-auto">
        <Table>
          <THead>
            <Tr>
              {Array.from({ length: nbColonnes }, (_, c) => (
                <th key={c} className="p-1">
                  <Select aria-label={`Rôle de la colonne ${c + 1}`} className="text-xs" value={roles[c] ?? "ignore"} onChange={(e) => setRoles(roles.map((r, i) => (i === c ? (e.target.value as RoleColonne) : r)))}>
                    {(Object.keys(LIBELLES) as RoleColonne[]).map((r) => <option key={r} value={r}>{LIBELLES[r]}</option>)}
                  </Select>
                </th>
              ))}
            </Tr>
          </THead>
          <TBody>
            {rangees.slice(n, n + APERCU).map((r, i) => (
              <Tr key={i}>{Array.from({ length: nbColonnes }, (_, c) => <Td key={c} className="text-xs">{String(r[c] ?? "")}</Td>)}</Tr>
            ))}
          </TBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        L'import remplace les {aRemplacer.length} ligne(s) actuelle(s) du DPGF{figees.size ? ` ; ${figees.size} ligne(s) déjà facturée(s) ou planifiée(s) sont conservées` : ""}.
      </p>
      {refus && <Alert variant="erreur">{refus}</Alert>}
      {importer.isError && <Alert variant="erreur">{messageErreur(importer.error)}</Alert>}
      <div className="flex gap-2">
        <Button size="sm" onClick={confirmer} disabled={importer.isPending}>{importer.isPending ? "Import…" : "Importer les lignes"}</Button>
        <Button size="sm" variant="ghost" onClick={fermer}>Annuler</Button>
      </div>
    </section>
  );
}
