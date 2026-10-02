import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { deplacer, dupliquer, ligneVide, modifier, retirer, type ErreurLigne, type LigneEdition } from "../domain/lignes";
import type { ChampReferenceLigne } from "./reference";
import { sousTotauxChapitres } from "../domain/totaux";
import { useUnitesLignes } from "../hooks/useUnites";
import { LigneEditable } from "./LigneEditable";

interface Props {
  lignes: LigneEdition[];
  onChange: (lignes: LigneEdition[]) => void;
  tvaDefaut: number;
  /** Absent : le référentiel « unite » de la société, sinon la liste de repli (DEV-08). */
  unites?: readonly string[];
  taux: readonly number[];
  erreurs?: readonly ErreurLigne[];
  lectureSeule?: boolean;
  /** Champ de référence (choix d'article), branché par app/. */
  ChampReference?: ChampReferenceLigne | undefined;
  /** Métier d'un chapitre (bons de commande), branché par le module qui connaît les métiers. */
  ChampMetier?: ChampReferenceLigne | undefined;
}

/** L'éditeur de lignes commun aux devis, factures et bons : lignes, chapitres, commentaires. */
export function EditeurLignes({ lignes, onChange, tvaDefaut, unites: imposees, taux, erreurs = [], lectureSeule = false, ChampReference, ChampMetier }: Props) {
  useModeDiscret();
  const referentiel = useUnitesLignes();
  const unites = imposees ?? referentiel;
  const sousTotaux = sousTotauxChapitres(lignes);
  // Le sous-total d'un chapitre s'affiche à la fin du chapitre : avant le suivant, ou en bas.
  const finsDeChapitre = new Map<number, number>();
  let chapitre = -1;
  lignes.forEach((l, i) => {
    if (l.type === "chapitre") {
      if (chapitre >= 0) finsDeChapitre.set(i - 1, chapitre);
      chapitre += 1;
    }
  });
  if (chapitre >= 0) finsDeChapitre.set(lignes.length - 1, chapitre);

  function agir(index: number, action: "monter" | "descendre" | "dupliquer" | "retirer") {
    if (action === "monter") onChange(deplacer(lignes, index, -1));
    if (action === "descendre") onChange(deplacer(lignes, index, 1));
    if (action === "dupliquer") onChange(dupliquer(lignes, index));
    if (action === "retirer") onChange(retirer(lignes, index, tvaDefaut));
  }

  return (
    <div className="flex flex-col gap-2">
      <Table>
        <THead>
          <Tr>
            <Th>Désignation</Th>
            <Th className="text-right">Qté</Th>
            <Th>Unité</Th>
            <Th className="text-right">PU HT</Th>
            <Th>TVA</Th>
            <Th className="text-right">Total HT</Th>
            <Th className="text-right">Total TTC</Th>
            {!lectureSeule && <Th><span className="sr-only">Actions</span></Th>}
          </Tr>
        </THead>
        <TBody>
          {lignes.map((l, i) => {
            const fin = finsDeChapitre.get(i);
            const st = fin === undefined ? undefined : sousTotaux[fin];
            return (
              <Fragment key={l.cle}>
                <LigneEditable
                  ligne={l}
                  index={i}
                  nombre={lignes.length}
                  unites={unites}
                  taux={taux}
                  erreurs={erreurs}
                  lectureSeule={lectureSeule}
                  onChange={(champ, v) => onChange(modifier(lignes, i, champ, v))}
                  onRemplacer={(nouvelle) => onChange(lignes.map((x, j) => (j === i ? nouvelle : x)))}
                  ChampReference={ChampReference}
                  ChampMetier={ChampMetier}
                  onAction={(a) => agir(i, a)}
                />
                {st && (
                  <Tr className="border-b-2">
                    <Td colSpan={5} className="text-right text-sm text-muted-foreground">Sous-total du chapitre</Td>
                    <Td className="text-right font-medium tabular-nums">{formatEurosEcran(st)}</Td>
                    <Td colSpan={lectureSeule ? 1 : 2} />
                  </Tr>
                )}
              </Fragment>
            );
          })}
        </TBody>
      </Table>
      {!lectureSeule && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => onChange([...lignes, ligneVide(tvaDefaut)])}>+ Ligne</Button>
          <Button variant="secondary" size="sm" onClick={() => onChange([...lignes, ligneVide(tvaDefaut, "chapitre")])}>+ Chapitre</Button>
          <Button variant="secondary" size="sm" onClick={() => onChange([...lignes, ligneVide(tvaDefaut, "commentaire")])}>+ Commentaire</Button>
        </div>
      )}
    </div>
  );
}
