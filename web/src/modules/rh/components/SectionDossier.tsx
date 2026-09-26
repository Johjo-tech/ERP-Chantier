import { useState, type FormEvent } from "react";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { formatDateFr, todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { useFormulaire } from "@/lib/useFormulaire";
import { useToastErreur } from "@/modules/materiel/components/communs";
import { schemaSaisieDocument } from "../api/dossier";
import { etatDocumentRh, libelleDocumentRh, trierDocumentsRh, typeDocumentRh, TYPES_DOCUMENT_RH, dossierSalarie, type DocumentRh } from "../domain/documents";
import { useDroitsRh, useGererDossier, useSeuilsRh } from "../hooks/useRh";
import { BoutonPiece, ChoixFichier } from "./communs";

/**
 * Le dossier documentaire d'un salarié (RH-04), au HTML de `dossierRhHTML`
 * (app.js l. 15813) : ce qu'il contient, ce qui lui manque, et de quoi
 * compléter. Une fiche pas encore enregistrée MONTRE les pièces qu'elle
 * attendra : masquée, la section se lisait comme absente.
 */
export function SectionDossier({ salarieId, documents }: { salarieId: string | null; documents: readonly DocumentRh[] }) {
  const droits = useDroitsRh();
  const seuils = useSeuilsRh();
  const [edition, setEdition] = useState<DocumentRh | "nouveau" | null>(null);
  const gerer = useGererDossier();
  useToastErreur(gerer.supprimerDocument.error);

  if (!salarieId) {
    return (
      <>
        <div className="card-sub">Enregistrez la fiche pour déposer ses pièces — un fichier se range sous l&apos;identifiant du salarié, qui n&apos;existe pas encore.</div>
        <div style={{ marginTop: "10px" }}>
          {TYPES_DOCUMENT_RH.filter((t) => t.obligatoire).map((t) => (
            <div key={t.code} className="chantier-file-row">
              <span style={{ flex: 1 }}>
                {t.icone} {t.libelle}
              </span>
              <span className="badge">à fournir</span>
            </div>
          ))}
        </div>
        <button type="button" className="btn small" style={{ marginTop: "10px" }} disabled title="Disponible dès que la fiche est enregistrée">
          + Ajouter un document
        </button>
      </>
    );
  }
  const docs = trierDocumentsRh(documents);
  const bilan = dossierSalarie(docs, todayISO(), seuils.documentLegal);
  return (
    <>
      {bilan.manquants.length ? (
        <div className="card-sub" style={{ color: "#a30f22" }}>
          ⚠ Manque au dossier : {bilan.manquants.map((t) => t.libelle).join(", ")}
        </div>
      ) : (
        <div className="card-sub" style={{ color: "#15803d" }}>
          ✓ Toutes les pièces obligatoires sont au dossier.
        </div>
      )}
      <div style={{ marginTop: "10px" }}>
        {docs.length === 0 ? (
          <div className="empty">Aucun document au dossier.</div>
        ) : (
          docs.map((d) => (
            <LigneDocument
              key={d.id}
              doc={d}
              seuil={seuils.documentLegal}
              modifier={droits.modifier ? () => setEdition(d) : null}
              retirer={
                droits.supprimer
                  ? () => {
                      if (window.confirm("Retirer ce document du dossier ? Le fichier joint sera supprimé.")) gerer.supprimerDocument.mutate(d);
                    }
                  : null
              }
            />
          ))
        )}
      </div>
      {droits.modifier &&
        (edition ? (
          <FormulaireDocument key={edition === "nouveau" ? "nouveau" : edition.id} salarieId={salarieId} doc={edition === "nouveau" ? null : edition} onFermer={() => setEdition(null)} />
        ) : (
          <button type="button" className="btn small primary" style={{ marginTop: "10px" }} onClick={() => setEdition("nouveau")}>
            + Ajouter un document
          </button>
        ))}
    </>
  );
}

/** L'état d'échéance d'une pièce (`etatDocumentRhBadge`, app.js l. 15783). */
function EtatDocument({ doc, seuil }: { doc: DocumentRh; seuil: number }) {
  const info = etatDocumentRh(doc, todayISO(), seuil);
  if (info.etat === "expire") return <span className="badge danger">Expiré le {formatDateFr(doc.dateExpiration)}</span>;
  if (info.etat === "bientot") return <span className="badge warn">Expire dans {info.jours} j</span>;
  if (info.etat === "valide") return <span className="card-sub">Valide jusqu&apos;au {formatDateFr(doc.dateExpiration)}</span>;
  // Un périssable sans date de fin ne déclenchera jamais d'alerte : le dire, sinon l'absence de badge se lit « tout va bien ».
  if (info.sansEcheance)
    return (
      <span className="badge warn" title="Aucune alerte ne préviendra de son expiration">
        Sans date de fin
      </span>
    );
  return null;
}

/** Une pièce du dossier (`documentRhRowHTML`, app.js l. 15793). */
export function LigneDocument({ doc, seuil, modifier, retirer }: { doc: DocumentRh; seuil: number; modifier: (() => void) | null; retirer: (() => void) | null }) {
  const t = typeDocumentRh(doc.type);
  const details = [t.libelle, doc.organisme, doc.numeroDocument ? `n° ${doc.numeroDocument}` : null, doc.dateDocument ? `du ${formatDateFr(doc.dateDocument)}` : null].filter(Boolean).join(" · ");
  return (
    <div className="chantier-file-row">
      <span style={{ flex: 1, minWidth: 0 }}>
        {t.icone} <strong>{libelleDocumentRh(doc)}</strong> <span className="card-sub">{details}</span>
        {doc.notes && <span className="card-sub">📝 {doc.notes}</span>}
      </span>
      <EtatDocument doc={doc} seuil={seuil} />
      <BoutonPiece chemin={doc.fichierChemin ?? null} />
      {modifier && (
        <button type="button" className="btn small" onClick={modifier}>
          Modifier
        </button>
      )}
      {retirer && (
        <button type="button" className="btn small danger" aria-label="Retirer ce document" onClick={retirer}>
          ✕
        </button>
      )}
    </div>
  );
}

/** `formDocumentRhHTML` (app.js l. 15854) : le panneau d'ajout ou de modification d'une pièce. */
function FormulaireDocument({ salarieId, doc, onFermer }: { salarieId: string; doc: DocumentRh | null; onFermer: () => void }) {
  const gerer = useGererDossier();
  const [fichier, setFichier] = useState<File | null>(null);
  const { valeurs, changer } = useFormulaire({
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
    const r = schemaSaisieDocument.safeParse(valeurs);
    if (!r.success) {
      afficherToast(r.error.issues[0]?.message ?? messageErreur(r.error));
      return;
    }
    const saisie = r.data;
    if (!doc && !fichier && !saisie.nom) {
      afficherToast("Donnez au moins un libellé ou joignez un fichier.");
      return;
    }
    const fini = { onSuccess: onFermer, onError: (err: unknown) => afficherToast(messageErreur(err)) };
    if (doc) gerer.modifierDocument.mutate({ doc, saisie, fichier }, fini);
    else gerer.ajouterDocument.mutate({ salarieId, saisie, fichier }, fini);
  }

  return (
    <form className="form-panel" style={{ marginTop: "12px" }} onSubmit={soumettre} noValidate aria-label={doc ? "Modifier le document" : "Ajouter un document au dossier"}>
      <h3>{doc ? "Modifier le document" : "Ajouter un document au dossier"}</h3>
      <div className="field-grid">
        <ChampChoix libelle="Type de document" valeur={valeurs.type} onChange={(v) => changer("type", v)} options={TYPES_DOCUMENT_RH.map((t) => ({ valeur: t.code, libelle: `${t.icone} ${t.libelle}` }))} />
        <ChampTexte libelle="Libellé" valeur={valeurs.nom} onChange={(v) => changer("nom", v)} placeholder={choisi.libelle} />
        <ChampTexte libelle="Organisme émetteur" valeur={valeurs.organisme} onChange={(v) => changer("organisme", v)} placeholder="Ex : CIBTP, médecine du travail…" />
        <ChampTexte libelle="Numéro du document" valeur={valeurs.numeroDocument} onChange={(v) => changer("numeroDocument", v)} />
        <ChampTexte libelle="Date du document" type="date" valeur={valeurs.dateDocument} onChange={(v) => changer("dateDocument", v)} />
        <div className="field">
          <label htmlFor="docRh_dateExpiration">Fin de validité</label>
          <input type="date" id="docRh_dateExpiration" value={valeurs.dateExpiration} onChange={(e) => changer("dateExpiration", e.target.value)} />
          <div className="card-sub" style={{ marginTop: "4px", display: choisi.perissable ? undefined : "none" }}>
            Sans cette date, aucune alerte ne préviendra de son expiration.
          </div>
        </div>
        <ChampTexte className="full" libelle="Notes" valeur={valeurs.notes} onChange={(v) => changer("notes", v)} />
      </div>
      <div className="achat-salarie-zone">
        <ChoixFichier libelle={doc?.fichierNom ? "Remplacer le fichier" : "Joindre le fichier"} onFichiers={(f) => setFichier(f[0] ?? null)} nomActuel={fichier?.name ?? doc?.fichierNom} />
      </div>
      <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
        <button type="submit" className="btn primary" disabled={mutation.isPending}>
          Enregistrer
        </button>
        <button type="button" className="btn ghost" onClick={onFermer}>
          Annuler
        </button>
      </div>
    </form>
  );
}
