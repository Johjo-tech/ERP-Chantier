import { useState, type FormEvent } from "react";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BoutonConfirme } from "@/components/ui/confirmation";
import { formatDateFr, todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { useFormulaire } from "@/lib/useFormulaire";
import { schemaSaisieDocument } from "../api/dossier";
import { etatDocumentRh, libelleDocumentRh, trierDocumentsRh, typeDocumentRh, TYPES_DOCUMENT_RH, dossierSalarie, type DocumentRh } from "../domain/documents";
import { useDroitsRh, useGererDossier, useSeuilsRh } from "../hooks/useRh";
import { BoutonPiece, ChoixFichier } from "./communs";

/**
 * Le dossier documentaire d'un salarié (RH-04) : ce qu'il contient, ce qui lui
 * manque, et de quoi compléter. Une fiche pas encore enregistrée MONTRE les
 * pièces qu'elle attendra : masquée, la section se lisait comme absente.
 */
export function SectionDossier({ salarieId, documents }: { salarieId: string | null; documents: readonly DocumentRh[] }) {
  const droits = useDroitsRh();
  const seuils = useSeuilsRh();
  const [edition, setEdition] = useState<DocumentRh | "nouveau" | null>(null);
  const gerer = useGererDossier();

  if (!salarieId) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p className="text-muted-foreground">Enregistrez la fiche pour déposer ses pièces — un fichier se range sous l'identifiant du salarié, qui n'existe pas encore.</p>
        <ul className="divide-y divide-border">
          {TYPES_DOCUMENT_RH.filter((t) => t.obligatoire).map((t) => (
            <li key={t.code} className="flex justify-between py-1">
              <span>{t.icone} {t.libelle}</span>
              <Badge variant="neutre">à fournir</Badge>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const docs = trierDocumentsRh(documents);
  const bilan = dossierSalarie(docs, todayISO(), seuils.documentLegal);
  return (
    <div className="flex flex-col gap-2 text-sm">
      {bilan.manquants.length ? (
        <p className="text-destructive">⚠ Manque au dossier : {bilan.manquants.map((t) => t.libelle).join(", ")}</p>
      ) : (
        <p className="text-success">✓ Toutes les pièces obligatoires sont au dossier.</p>
      )}
      {gerer.supprimerDocument.isError && <Alert variant="erreur">{messageErreur(gerer.supprimerDocument.error)}</Alert>}
      {docs.length === 0 ? (
        <p className="text-muted-foreground">Aucun document au dossier.</p>
      ) : (
        <ul className="divide-y divide-border">
          {docs.map((d) => (
            <LigneDocument key={d.id} doc={d} seuil={seuils.documentLegal} modifier={droits.modifier ? () => setEdition(d) : null} retirer={droits.supprimer ? () => gerer.supprimerDocument.mutate(d) : null} />
          ))}
        </ul>
      )}
      {droits.modifier &&
        (edition ? (
          <FormulaireDocument key={edition === "nouveau" ? "nouveau" : edition.id} salarieId={salarieId} doc={edition === "nouveau" ? null : edition} onFermer={() => setEdition(null)} />
        ) : (
          <div>
            <Button size="sm" onClick={() => setEdition("nouveau")}>+ Ajouter un document</Button>
          </div>
        ))}
    </div>
  );
}

export function LigneDocument({ doc, seuil, modifier, retirer }: { doc: DocumentRh; seuil: number; modifier: (() => void) | null; retirer: (() => void) | null }) {
  const t = typeDocumentRh(doc.type);
  const info = etatDocumentRh(doc, todayISO(), seuil);
  const details = [t.libelle, doc.organisme, doc.numeroDocument ? `n° ${doc.numeroDocument}` : null, doc.dateDocument ? `du ${formatDateFr(doc.dateDocument)}` : null].filter(Boolean).join(" · ");
  return (
    <li className="flex flex-wrap items-center gap-2 py-1.5">
      <span className="min-w-0 flex-1">
        {t.icone} <strong>{libelleDocumentRh(doc)}</strong> <span className="text-xs text-muted-foreground">{details}</span>
        {doc.notes && <span className="block text-xs text-muted-foreground">📝 {doc.notes}</span>}
      </span>
      {info.etat === "expire" && <Badge variant="danger">Expiré le {formatDateFr(doc.dateExpiration)}</Badge>}
      {info.etat === "bientot" && <Badge variant="alerte">Expire dans {info.jours} j</Badge>}
      {info.etat === "valide" && <span className="text-xs text-muted-foreground">Valide jusqu'au {formatDateFr(doc.dateExpiration)}</span>}
      {info.sansEcheance && <Badge variant="alerte" title="Aucune alerte ne préviendra de son expiration">Sans date de fin</Badge>}
      <BoutonPiece chemin={doc.fichierChemin ?? null} />
      {modifier && <Button size="sm" variant="outline" onClick={modifier}>Modifier</Button>}
      {retirer && <BoutonConfirme libelle="✕" question="Retirer ce document du dossier ? Le fichier joint sera supprimé." onConfirmer={retirer} />}
    </li>
  );
}

function FormulaireDocument({ salarieId, doc, onFermer }: { salarieId: string; doc: DocumentRh | null; onFermer: () => void }) {
  const gerer = useGererDossier();
  const [fichier, setFichier] = useState<File | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const { valeurs, erreurs, changer, valider } = useFormulaire({
    type: doc?.type ?? "contrat",
    nom: doc?.nom ?? "",
    organisme: doc?.organisme ?? "",
    numeroDocument: doc?.numeroDocument ?? "",
    dateDocument: doc?.dateDocument ?? "",
    dateExpiration: doc?.dateExpiration ?? "",
    notes: doc?.notes ?? "",
  });
  const choisi = typeDocumentRh(valeurs.type);
  const mutation = doc ? gerer.modifierDocument : gerer.ajouterDocument;

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const saisie = valider(schemaSaisieDocument);
    if (!saisie) return;
    if (!doc && !fichier && !saisie.nom) return setRefus("Donnez au moins un libellé ou joignez un fichier.");
    setRefus(null);
    if (doc) gerer.modifierDocument.mutate({ doc, saisie, fichier }, { onSuccess: onFermer });
    else gerer.ajouterDocument.mutate({ salarieId, saisie, fichier }, { onSuccess: onFermer });
  }

  return (
    <form onSubmit={soumettre} noValidate aria-label={doc ? "Modifier le document" : "Ajouter un document au dossier"} className="grid gap-3 rounded-md border border-dashed border-border p-3 sm:grid-cols-2">
      <ChampChoix libelle="Type de document" valeur={valeurs.type} onChange={(v) => changer("type", v)} options={TYPES_DOCUMENT_RH.map((t) => ({ valeur: t.code, libelle: `${t.icone} ${t.libelle}` }))} />
      <ChampTexte libelle="Libellé" valeur={valeurs.nom} onChange={(v) => changer("nom", v)} placeholder={choisi.libelle} />
      <ChampTexte libelle="Organisme émetteur" valeur={valeurs.organisme} onChange={(v) => changer("organisme", v)} placeholder="Ex : CIBTP, médecine du travail…" />
      <ChampTexte libelle="Numéro du document" valeur={valeurs.numeroDocument} onChange={(v) => changer("numeroDocument", v)} />
      <ChampTexte libelle="Date du document" type="date" valeur={valeurs.dateDocument} onChange={(v) => changer("dateDocument", v)} erreur={erreurs.dateDocument} />
      <ChampTexte
        libelle="Fin de validité"
        type="date"
        valeur={valeurs.dateExpiration}
        onChange={(v) => changer("dateExpiration", v)}
        erreur={erreurs.dateExpiration}
        aide={choisi.perissable ? "Sans cette date, aucune alerte ne préviendra de son expiration." : undefined}
      />
      <div className="sm:col-span-2">
        <ChampTexte libelle="Notes" valeur={valeurs.notes} onChange={(v) => changer("notes", v)} />
      </div>
      <div className="sm:col-span-2">
        <ChoixFichier libelle={doc?.fichierNom ? "Remplacer le fichier" : "Joindre le fichier"} onFichiers={(f) => setFichier(f[0] ?? null)} nomActuel={fichier?.name ?? doc?.fichierNom} />
      </div>
      {(refus || mutation.isError) && <Alert variant="erreur" className="sm:col-span-2">{refus ?? messageErreur(mutation.error)}</Alert>}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
        <Button variant="ghost" onClick={onFermer}>Annuler</Button>
      </div>
    </form>
  );
}
