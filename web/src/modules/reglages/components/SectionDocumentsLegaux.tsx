import { useState, type FormEvent } from "react";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { formatDateFr, todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { erreursParChamp } from "@/lib/validation";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { useInfosEntreprise, useLienFichier, useReglagesSociete } from "@/modules/societes/hooks/useSocieteReglages";
import type { DocumentLegal } from "../api/documentsLegaux";
import {
  TAILLE_MAX_PIECE,
  TYPES_DOCUMENTS_LEGAUX,
  documentsHerites,
  etatEcheance,
  libelleEcheance,
  schemaSaisieDocumentLegal,
  trierParEcheance,
} from "../domain/documents-legaux";
import { useAjouterDocumentLegal, useDocumentsLegaux, useSupprimerDocumentLegal } from "../hooks/useReglagesEcran";

/** Kbis, assurances, attestations — avec alerte avant expiration (SOC-09). */
export function SectionDocumentsLegaux() {
  const docs = useDocumentsLegaux();
  const reglages = useReglagesSociete();
  const infos = useInfosEntreprise();
  const modifiable = usePermission("reglages", "modifier");
  const seuil = reglages.data?.seuils.documentLegal ?? 30;
  const herites = documentsHerites(infos.data);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents légaux de l'entreprise</CardTitle>
        <p className="text-sm text-muted-foreground">Alerte à {seuil} jours de l'échéance (réglable dans Référentiels › RH).</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {modifiable && <FormulaireAjout />}
        {docs.isPending ? (
          <Chargement />
        ) : docs.isError ? (
          <Erreur erreur={docs.error} reessayer={() => void docs.refetch()} />
        ) : docs.data.length === 0 ? (
          <Vide message="Aucun document légal enregistré." />
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {trierParEcheance(docs.data).map((d) => (
              <LigneDocument key={d.id} doc={d} seuil={seuil} modifiable={modifiable} />
            ))}
          </ul>
        )}
        {herites.length > 0 && (
          <div className="text-sm">
            <p className="font-medium">Repris de l'ancienne application (à redéposer ici)</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {herites.map((h, i) => (
                <li key={h.id ?? i}>
                  {h.type ?? "Document"}
                  {h.dateExpiration ? ` — expire le ${formatDateFr(h.dateExpiration)}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LigneDocument({ doc, seuil, modifiable }: { doc: DocumentLegal; seuil: number; modifiable: boolean }) {
  const supprimer = useSupprimerDocumentLegal();
  const lien = useLienFichier(doc.fichier_chemin);
  const etat = etatEcheance(doc.date_validite, todayISO(), seuil);
  const badge = libelleEcheance(etat);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
      <div>
        <p className="font-medium">
          {doc.type ?? doc.nom}
          {doc.nom !== doc.type && doc.type ? ` — ${doc.nom}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {doc.date_validite ? `Valable jusqu'au ${formatDateFr(doc.date_validite)}` : "Sans date de validité"}
          {badge && (
            <Badge className="ml-2" variant={etat.niveau === "expire" ? "danger" : "alerte"}>
              {badge}
            </Badge>
          )}
        </p>
        {supprimer.isError && <p className="text-xs text-destructive">{messageErreur(supprimer.error)}</p>}
      </div>
      <div className="flex gap-2">
        {doc.fichier_chemin && lien.data && (
          <Button asChild variant="outline" size="sm">
            <a href={lien.data} target="_blank" rel="noreferrer">
              Voir {doc.fichier_nom ?? "le fichier"}
            </a>
          </Button>
        )}
        {modifiable && <BoutonConfirme libelle="Supprimer" question="Supprimer ce document ?" enCours={supprimer.isPending} onConfirmer={() => supprimer.mutate(doc)} />}
      </div>
    </li>
  );
}

function FormulaireAjout() {
  const ajouter = useAjouterDocumentLegal();
  const [valeurs, setValeurs] = useState({ type: TYPES_DOCUMENTS_LEGAUX[0] as string, nom: "", date_validite: "" });
  const [fichier, setFichier] = useState<File | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const r = schemaSaisieDocumentLegal.safeParse(valeurs);
    if (!r.success) return setErreurs(erreursParChamp(r.error));
    if (fichier && fichier.size > TAILLE_MAX_PIECE) return setErreurs({ fichier: "Le fichier dépasse 10 Mo." });
    setErreurs({});
    ajouter.mutate(
      { saisie: r.data, fichier },
      {
        onSuccess: () => {
          setValeurs((v) => ({ ...v, nom: "", date_validite: "" }));
          setFichier(null);
        },
      }
    );
  }

  return (
    <form onSubmit={soumettre} noValidate className="grid gap-3 rounded-md border border-dashed border-border p-3 sm:grid-cols-2">
      <ChampChoix libelle="Type" valeur={valeurs.type} onChange={(v) => setValeurs((x) => ({ ...x, type: v }))} options={TYPES_DOCUMENTS_LEGAUX.map((t) => ({ valeur: t, libelle: t }))} />
      <ChampTexte libelle="Intitulé (facultatif)" valeur={valeurs.nom} onChange={(v) => setValeurs((x) => ({ ...x, nom: v }))} />
      <ChampTexte libelle="Valable jusqu'au" type="date" valeur={valeurs.date_validite} onChange={(v) => setValeurs((x) => ({ ...x, date_validite: v }))} erreur={erreurs.date_validite} />
      <div className="flex flex-col gap-1.5 text-sm">
        <label htmlFor="piece-legale">Fichier (PDF ou image)</label>
        <input id="piece-legale" type="file" accept=".pdf,image/*" onChange={(e) => setFichier(e.target.files?.[0] ?? null)} />
        {erreurs.fichier && <p className="text-xs text-destructive">{erreurs.fichier}</p>}
      </div>
      {ajouter.isError && <Alert variant="erreur" className="sm:col-span-2">{messageErreur(ajouter.error)}</Alert>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={ajouter.isPending}>
          {ajouter.isPending ? "Ajout…" : "Ajouter le document"}
        </Button>
      </div>
    </form>
  );
}
