import { useState } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateFr } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { formatEuros, montant } from "@/lib/money";
import { categorieDe, categoriesAchat, totauxParCategorie, trierAchats } from "../domain/achats";
import { useAchats, useCategoriesAchat, useSupprimerAchat } from "../hooks/useFiche";
import { FormulaireAchat } from "./FormulaireAchat";

/**
 * Les achats du chantier (CHA-11) : totaux par catégorie avec leur part du
 * total, filtre par catégorie, ajout, suppression. Réservé à qui gère le
 * chantier (lecture et écriture « chantiers / modifier »).
 */
export function BlocAchats({ chantierId }: { chantierId: string }) {
  const achats = useAchats(chantierId);
  const referentiel = useCategoriesAchat();
  const supprimer = useSupprimerAchat(chantierId);
  const [filtre, setFiltre] = useState("");
  const categories = categoriesAchat(referentiel.data ?? []);

  if (achats.isPending) return <Chargement libelle="Chargement des achats…" />;
  if (achats.isError) return <Erreur erreur={achats.error} reessayer={() => void achats.refetch()} />;
  const { parCategorie, total } = totauxParCategorie(categories, achats.data);
  const visibles = trierAchats(filtre ? achats.data.filter((a) => a.categorie === filtre) : achats.data);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Achats</CardTitle>
        <p className="font-semibold tabular-nums">
          {formatEuros(total)} <span className="text-sm font-normal text-muted-foreground">au total</span>
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {referentiel.isError && <Alert variant="erreur">Catégories indisponibles, liste par défaut : {messageErreur(referentiel.error)}</Alert>}
        <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Totaux par catégorie">
          {parCategorie.map(({ categorie, montant: m, pourcentage }) => (
            <button
              key={categorie.code}
              type="button"
              aria-pressed={filtre === categorie.code}
              onClick={() => setFiltre(filtre === categorie.code ? "" : categorie.code)}
              className={`flex flex-col gap-1 rounded-md border p-2 text-left ${filtre === categorie.code ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <span className="text-sm"><span aria-hidden="true">{categorie.icone}</span> {categorie.libelle}</span>
              <span className="font-semibold tabular-nums">{formatEuros(m)}</span>
              <span className="h-1.5 w-full rounded bg-muted" aria-label={`${pourcentage} % du total`} role="img">
                <span className="block h-full rounded" style={{ width: `${pourcentage}%`, background: categorie.couleur }} />
              </span>
            </button>
          ))}
        </div>
        {filtre && (
          <Button size="sm" variant="ghost" className="self-start" onClick={() => setFiltre("")}>
            Retirer le filtre « {categorieDe(categories, filtre).libelle} »
          </Button>
        )}
        <FormulaireAchat chantierId={chantierId} categories={categories} />
        {supprimer.isError && <Alert variant="erreur">{messageErreur(supprimer.error)}</Alert>}
        {visibles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun achat enregistré pour l'instant.</p>
        ) : (
          <ul className="divide-y divide-border">
            {visibles.map((a) => {
              const cat = categorieDe(categories, a.categorie);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span aria-hidden="true">{cat.icone}</span>
                  <span className="flex-1">
                    {a.designation}
                    {a.heures ? <span className="text-muted-foreground"> ({String(a.heures).replace(".", ",")} h)</span> : null}
                    <span className="block text-xs text-muted-foreground">
                      {cat.libelle} · {formatDateFr(a.date_achat)}
                      {a.fournisseur ? ` · ${a.fournisseur}` : ""}
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">{formatEuros(montant(a.montant))}</span>
                  <BoutonConfirme libelle="Retirer" question="Retirer cet achat ?" onConfirmer={() => supprimer.mutate(a.id)} />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
