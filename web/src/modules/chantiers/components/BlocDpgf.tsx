import { type FormEvent } from "react";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { messageErreur } from "@/lib/erreurs";
import { formatEuros, montant } from "@/lib/money";
import { useFormulaire } from "@/lib/useFormulaire";
import { avancementChantier, montantLigneDpgf } from "../domain/dpgf";
import { schemaNouvelleLigneDpgf } from "../domain/saisie-dpgf";
import { useAjouterLigneDpgf, useDpgf, useSupprimerLigneDpgf } from "../hooks/useChantiers";

const VIDE = { type: "ligne", designation: "", quantite: "1", prix_unitaire: "", unite: "u" };

/** Le DPGF d'un chantier : ses lignes, son total, ce qui en est déjà facturé. */
export function BlocDpgf({ chantierId, actions }: { chantierId: string; actions?: React.ReactNode }) {
  const dpgf = useDpgf(chantierId);
  const ajouter = useAjouterLigneDpgf(chantierId);
  const supprimer = useSupprimerLigneDpgf(chantierId);
  const { valeurs, erreurs, changer, valider, reinitialiser } = useFormulaire(VIDE);

  if (dpgf.isPending) return <Chargement libelle="Chargement du DPGF…" />;
  if (dpgf.isError) return <Erreur erreur={dpgf.error} reessayer={() => void dpgf.refetch()} />;
  const lignes = dpgf.data;
  const a = avancementChantier(lignes);

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const l = valider(schemaNouvelleLigneDpgf);
    const position = lignes.reduce((max, x) => Math.max(max, x.position), -1) + 1;
    if (l) ajouter.mutate({ position, ligne: l }, { onSuccess: () => reinitialiser(VIDE) });
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between">
        <CardTitle>DPGF</CardTitle>
        <p className="text-sm text-muted-foreground">
          Total {formatEuros(a.total)} HT · facturé {formatEuros(a.facture)} ({a.pourcentage} %) · reste {formatEuros(a.reste)}
        </p>
        {actions}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {(ajouter.isError || supprimer.isError) && <Alert variant="erreur">{messageErreur(ajouter.error ?? supprimer.error)}</Alert>}
        {lignes.length === 0 ? (
          <Vide message="Aucune ligne au DPGF." />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Désignation</Th>
                <Th className="text-right">Qté</Th>
                <Th className="text-right">PU HT</Th>
                <Th className="text-right">Total HT</Th>
                <Th className="text-right">Avancement</Th>
                <Th><span className="sr-only">Actions</span></Th>
              </Tr>
            </THead>
            <TBody>
              {lignes.map((l) =>
                l.type !== "ligne" ? (
                  <Tr key={l.id} className={l.type === "chapitre" ? "bg-muted/60" : ""}>
                    <Td colSpan={6} className={l.type === "chapitre" ? "font-semibold" : "italic text-muted-foreground"}>{l.designation}</Td>
                  </Tr>
                ) : (
                  <Tr key={l.id}>
                    <Td>{l.designation}</Td>
                    <Td className="text-right tabular-nums">{String(l.quantite).replace(".", ",")} {l.unite}</Td>
                    <Td className="text-right tabular-nums">{formatEuros(montant(l.prix_unitaire))}</Td>
                    <Td className="text-right tabular-nums">{formatEuros(montantLigneDpgf(l))}</Td>
                    <Td className="text-right tabular-nums">{String(l.avancement_cumule).replace(".", ",")} %</Td>
                    <Td className="text-right">
                      {/* Une ligne déjà facturée ne se supprime pas : elle porte l'historique des situations. */}
                      {l.avancement_cumule === 0 && (
                        <BoutonConfirme libelle="Retirer" question="Retirer cette ligne ?" onConfirmer={() => supprimer.mutate(l.id)} />
                      )}
                    </Td>
                  </Tr>
                )
              )}
            </TBody>
          </Table>
        )}
        <form onSubmit={soumettre} noValidate className="grid gap-2 border-t border-border pt-3 sm:grid-cols-7">
          <ChampChoix
            libelle="Type"
            valeur={valeurs.type}
            onChange={(v) => changer("type", v)}
            options={[{ valeur: "ligne", libelle: "Ligne" }, { valeur: "chapitre", libelle: "Chapitre" }]}
          />
          <div className="sm:col-span-2">
            <ChampTexte libelle="Désignation" valeur={valeurs.designation} onChange={(v) => changer("designation", v)} erreur={erreurs.designation} />
          </div>
          <ChampTexte libelle="Quantité" inputMode="decimal" valeur={valeurs.quantite} onChange={(v) => changer("quantite", v)} erreur={erreurs.quantite} desactive={valeurs.type === "chapitre"} />
          <ChampTexte libelle="Unité" valeur={valeurs.unite} onChange={(v) => changer("unite", v)} desactive={valeurs.type === "chapitre"} />
          <ChampTexte libelle="PU HT" inputMode="decimal" valeur={valeurs.prix_unitaire} onChange={(v) => changer("prix_unitaire", v)} erreur={erreurs.prix_unitaire} desactive={valeurs.type === "chapitre"} />
          <div className="flex items-end">
            <Button type="submit" variant="secondary" disabled={ajouter.isPending}>
              Ajouter
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
