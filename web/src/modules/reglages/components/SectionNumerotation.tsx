import { useState, type FormEvent } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, THead, Td, Th, Tr } from "@/components/ui/table";
import { usePermission, useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import {
  apercuNumero,
  baisses,
  lignesNumerotation,
  schemaSaisieCompteur,
  type LigneNumerotation,
  type SaisieCompteur,
  type TypeSerie,
} from "../domain/numerotation";
import { anneeCourante, useCompteurs, useReglerCompteurs } from "../hooks/useReglagesEcran";
import { PiedEnregistrement } from "./champs";

/** Préfixe et point de départ de chaque série pour l'année (PAR-03). La base attribue, l'écran règle. */
export function SectionNumerotation() {
  const annee = anneeCourante();
  const compteurs = useCompteurs(annee);
  const regler = useReglerCompteurs(annee);
  if (compteurs.isPending) return <Chargement />;
  if (compteurs.isError) return <Erreur erreur={compteurs.error} reessayer={() => void compteurs.refetch()} />;
  const lignes = lignesNumerotation(compteurs.data, annee);
  return <TableauNumerotation key={JSON.stringify(lignes)} lignes={lignes} annee={annee} regler={regler} />;
}

type Saisies = Record<TypeSerie, { prefixe: string; valeur: string }>;

function TableauNumerotation({ lignes, annee, regler }: { lignes: LigneNumerotation[]; annee: number; regler: ReturnType<typeof useReglerCompteurs> }) {
  const societe = useSocieteActive();
  const modifiable = usePermission("reglages", "modifier");
  const [saisies, setSaisies] = useState<Saisies>(
    () => Object.fromEntries(lignes.map((l) => [l.type, { prefixe: l.prefixe, valeur: String(l.valeur) }])) as Saisies
  );
  const [erreur, setErreur] = useState<string | null>(null);
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);

  function lire(): Record<TypeSerie, SaisieCompteur> | null {
    const sortie: Partial<Record<TypeSerie, SaisieCompteur>> = {};
    for (const l of lignes) {
      const r = schemaSaisieCompteur.safeParse(saisies[l.type]);
      if (!r.success) {
        setErreur(`${l.libelle} : ${r.error.issues[0]?.message ?? "saisie invalide."}`);
        return null;
      }
      sortie[l.type] = r.data;
    }
    setErreur(null);
    return sortie as Record<TypeSerie, SaisieCompteur>;
  }

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const series = lire();
    if (!series) return;
    // Baisser un compteur réattribuerait des numéros déjà émis : on le fait confirmer.
    const b = baisses(lignes, series);
    const question = b.map((x) => `${x.libelle} : de ${x.de} à ${x.a}`).join(" ; ");
    if (b.length && aConfirmer !== question) {
      setAConfirmer(question);
      return;
    }
    setAConfirmer(null);
    regler.mutate(series);
  }

  const changer = (type: TypeSerie, champ: "prefixe" | "valeur", v: string) => {
    setAConfirmer(null);
    setSaisies((s) => ({ ...s, [type]: { ...s[type], [champ]: v } }));
  };

  return (
    <form onSubmit={soumettre} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Numérotation</CardTitle>
          <p className="text-sm text-muted-foreground">
            Préfixe et dernier numéro attribué de chaque série, pour {societe.nom} en {annee}. Les numéros sont attribués par la base, de façon atomique.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Table>
            <THead>
              <Tr>
                <Th>Document</Th>
                <Th>Préfixe</Th>
                <Th>Dernier n° attribué</Th>
                <Th>Prochain</Th>
              </Tr>
            </THead>
            <TBody>
              {lignes.map((l) => {
                const s = saisies[l.type];
                return (
                  <Tr key={l.type}>
                    <Td>{l.libelle}</Td>
                    <Td>
                      <Input aria-label={`Préfixe — ${l.libelle}`} className="w-24" maxLength={8} value={s.prefixe} disabled={!modifiable} onChange={(e) => changer(l.type, "prefixe", e.target.value)} />
                    </Td>
                    <Td>
                      <Input aria-label={`Dernier numéro — ${l.libelle}`} className="w-28" inputMode="numeric" value={s.valeur} disabled={!modifiable} onChange={(e) => changer(l.type, "valeur", e.target.value)} />
                    </Td>
                    <Td>
                      <code>{apercuNumero(s.prefixe, Number.parseInt(s.valeur, 10) || 0, annee)}</code>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
          <p className="text-xs text-muted-foreground">Les bons de commande n'ont pas de série : leur numéro figure sur le document du client. Les compteurs repartent de zéro chaque année civile.</p>
          {erreur && <Alert variant="erreur">{erreur}</Alert>}
          {aConfirmer && (
            <Alert variant="erreur">
              {aConfirmer} — baisser un compteur réattribuera des numéros déjà utilisés. Enregistrez à nouveau pour confirmer.
              <Button type="button" variant="ghost" size="sm" className="ml-2" onClick={() => setAConfirmer(null)}>
                Annuler
              </Button>
            </Alert>
          )}
          <PiedEnregistrement
            modifiable={modifiable}
            enCours={regler.isPending}
            erreur={regler.error}
            succes={regler.isSuccess ? "Numérotation enregistrée." : null}
            libelle={aConfirmer ? "Confirmer et enregistrer" : "Enregistrer la numérotation"}
          />
        </CardContent>
      </Card>
    </form>
  );
}
