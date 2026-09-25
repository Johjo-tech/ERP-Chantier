import { useState } from "react";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { Input } from "@/components/ui/input";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { correspond } from "@/lib/recherche";
import { echeanceDocumentSousTraitant, type SousTraitant } from "../domain/intervenants";
import { useDocumentsSousTraitants, useDroitsRh, useGererIntervenants, useSeuilsRh, useSousTraitants } from "../hooks/useRh";
import { FormulaireSousTraitant } from "./FormulaireSousTraitant";

/**
 * Les sous-traitants (PAR-06) : entreprises, métiers, compte relié (AUTH-44) et
 * documents à échéance (décennale, vigilance URSSAF…). La liste s'ouvre à qui
 * voit l'onglet RH ; l'écriture suit `peut_ecrire()` ET la matrice (D-RH-05).
 */
export function OngletSousTraitants() {
  const liste = useSousTraitants();
  const documents = useDocumentsSousTraitants();
  const droits = useDroitsRh();
  const seuils = useSeuilsRh();
  const gerer = useGererIntervenants();
  const [recherche, setRecherche] = useState("");
  const [edition, setEdition] = useState<SousTraitant | "nouveau" | null>(null);

  if (liste.isPending) return <Chargement />;
  if (liste.isError) return <Erreur erreur={liste.error} reessayer={() => void liste.refetch()} />;
  const filtres = liste.data.filter((s) => correspond(recherche, s.nom, s.metier, s.metiers.join(" "), s.ville, s.siret));
  const docsDe = (id: string) => (documents.data ?? []).filter((d) => d.sousTraitantId === id);
  const aujourdHui = todayISO();

  if (edition) {
    return <FormulaireSousTraitant key={edition === "nouveau" ? "nouveau" : edition.id} fiche={edition === "nouveau" ? null : edition} fiches={liste.data} documents={edition === "nouveau" ? [] : docsDe(edition.id)} onFermer={() => setEdition(null)} />;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Input aria-label="Rechercher un sous-traitant" className="min-w-56 flex-1" placeholder="Rechercher : nom, métier, ville, SIRET…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        {droits.intervenants && <Button onClick={() => setEdition("nouveau")}>+ Nouveau sous-traitant</Button>}
      </div>
      {gerer.supprimerSousTraitant.isError && <Alert variant="erreur">{messageErreur(gerer.supprimerSousTraitant.error)}</Alert>}
      {filtres.length === 0 ? (
        <Vide message="Aucun sous-traitant enregistré pour cette société." />
      ) : (
        <ul className="flex flex-col gap-2">
          {filtres.map((s) => {
            const alertes = docsDe(s.id).map((d) => echeanceDocumentSousTraitant(d.dateValidite, aujourdHui, seuils.documentLegal)).filter((a) => a !== null);
            const metiers = s.metiers.length ? s.metiers.join(", ") : s.metier;
            return (
              <li key={s.id} className="rounded-md border border-border p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {s.nom}
                  {alertes.some((a) => a.niveau === "expire") && <Badge variant="danger">document expiré</Badge>}
                  {!alertes.some((a) => a.niveau === "expire") && alertes.length > 0 && <Badge variant="alerte">document à renouveler</Badge>}
                  {!s.contactProfileId && <Badge variant="neutre" title="Sans compte relié, l'entreprise ne voit pas ses tâches au planning">sans compte</Badge>}
                </p>
                {(s.telephone || s.email) && <p className="text-muted-foreground">{[s.telephone, s.email].filter(Boolean).join(" · ")}</p>}
                {metiers && <p className="text-muted-foreground">🔧 {metiers}</p>}
                {droits.intervenants && (
                  <span className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEdition(s)}>Modifier</Button>
                    <BoutonConfirme libelle="Supprimer" question={`Supprimer ${s.nom} et ses documents ?`} onConfirmer={() => gerer.supprimerSousTraitant.mutate({ id: s.id, documents: docsDe(s.id) })} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
