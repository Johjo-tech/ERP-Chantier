import { useId, useState, type CSSProperties } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { formatDateFr, todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { SEUILS_DEFAUT } from "@/modules/societes/domain/reglages-societe";
import { useInfosEntreprise, useLienFichier, useReglagesSociete } from "@/modules/societes/hooks/useSocieteReglages";
import type { DocumentLegal } from "../api/documentsLegaux";
import { TAILLE_MAX_PIECE, TYPES_DOCUMENTS_LEGAUX, documentsHerites, etatEcheance, libelleEcheance, schemaSaisieDocumentLegal, trierParEcheance } from "../domain/documents-legaux";
import { useAjouterDocumentLegal, useDocumentsLegaux, useSupprimerDocumentLegal } from "../hooks/useReglagesEcran";

/** Vert tant que la pièce vaut, orangé à l'approche, rouge une fois expirée (`renderDocumentsLegauxSection`). */
const COULEURS = { aucune: "#5BC97A", valide: "#5BC97A", bientot: "#F0A82E", expire: "#EF5A6F" } as const;

/**
 * Kbis, assurances, attestations — avec alerte avant expiration (SOC-09), au
 * HTML de `renderDocumentsLegauxSection` (app.js l. 13026). La date d'émission
 * de l'ancienne ligne d'ajout n'a pas de colonne (D-SOC-14) : seule l'échéance
 * se saisit ; le seuil est celui des réglages RH (D-RH-04).
 */
export function SectionDocumentsLegaux() {
  const docs = useDocumentsLegaux();
  const reglages = useReglagesSociete();
  const infos = useInfosEntreprise();
  const modifiable = usePermission("reglages", "modifier");
  const seuil = reglages.data?.seuils.documentLegal ?? SEUILS_DEFAUT.documentLegal;
  const herites = documentsHerites(infos.data);

  return (
    <div className="card" style={{ marginTop: "22px" }}>
      <div className="card-title" style={{ marginBottom: "4px" }}>
        📑 Documents légaux de l&apos;entreprise
      </div>
      <div className="card-sub" style={{ marginBottom: "14px" }}>
        KBIS, assurances, attestations — avec alerte automatique avant expiration.
      </div>
      {modifiable && <LigneAjout />}
      <div className="achats-list" style={{ marginTop: "10px" }}>
        {docs.isPending ? (
          <Chargement />
        ) : docs.isError ? (
          <Erreur erreur={docs.error} reessayer={() => void docs.refetch()} />
        ) : docs.data.length === 0 ? (
          <div className="empty">Aucun document légal enregistré.</div>
        ) : (
          trierParEcheance(docs.data).map((d) => <LigneDocument key={d.id} doc={d} seuil={seuil} modifiable={modifiable} />)
        )}
      </div>
      {herites.length > 0 && (
        <div className="card-sub" style={{ marginTop: "10px" }}>
          Repris de l&apos;ancienne application (à redéposer ici) :{" "}
          {herites.map((h) => `${h.type ?? "Document"}${h.dateExpiration ? ` — expire le ${formatDateFr(h.dateExpiration)}` : ""}`).join(" · ")}
        </div>
      )}
    </div>
  );
}

function LigneDocument({ doc, seuil, modifiable }: { doc: DocumentLegal; seuil: number; modifiable: boolean }) {
  const supprimer = useSupprimerDocumentLegal();
  const lien = useLienFichier(doc.fichier_chemin);
  const etat = etatEcheance(doc.date_validite, todayISO(), seuil);
  const badge = libelleEcheance(etat);
  const c = COULEURS[etat.niveau];
  return (
    <div className="achat-row" style={{ "--cat-color": c } as CSSProperties}>
      <div className="achat-row-icon" style={{ background: `${c}22`, color: c }}>
        📑
      </div>
      <div className="achat-row-main">
        <div className="achat-designation">
          {doc.type ?? doc.nom}
          {doc.fichier_chemin && lien.data && (
            <>
              {" · "}
              <a href={lien.data} target="_blank" rel="noreferrer">
                📎 voir
              </a>
            </>
          )}
        </div>
        <div className="achat-date">
          {doc.date_validite ? ` · expire le ${formatDateFr(doc.date_validite)}` : ""}
          {badge && (
            <>
              {" "}
              <span className={`badge ${etat.niveau === "expire" ? "danger" : "warn"}`}>{badge}</span>
            </>
          )}
        </div>
      </div>
      {modifiable && (
        <button
          type="button"
          className="btn small danger"
          aria-label={`Supprimer ${doc.type ?? doc.nom}`}
          disabled={supprimer.isPending}
          onClick={() => {
            if (window.confirm("Supprimer ce document ?")) supprimer.mutate(doc, { onError: (e) => afficherToast(messageErreur(e)) });
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

/** La ligne `.entretien-add-row` : type, échéance, fichier, « + Ajouter ». */
function LigneAjout() {
  const ajouter = useAjouterDocumentLegal();
  const idFichier = useId();
  const [type, setType] = useState<string>(TYPES_DOCUMENTS_LEGAUX[0]);
  const [validite, setValidite] = useState("");
  const [fichier, setFichier] = useState<File | null>(null);

  function envoyer() {
    const r = schemaSaisieDocumentLegal.safeParse({ type, nom: "", date_validite: validite });
    if (!r.success) {
      afficherToast(r.error.issues[0]?.message ?? "Saisie invalide.");
      return;
    }
    if (fichier && fichier.size > TAILLE_MAX_PIECE) {
      afficherToast("Le fichier dépasse 10 Mo.");
      return;
    }
    ajouter.mutate(
      { saisie: r.data, fichier },
      {
        onSuccess: () => {
          setValidite("");
          setFichier(null);
          afficherToast("Document légal enregistré.", "success");
        },
        onError: (e) => afficherToast(messageErreur(e)),
      }
    );
  }

  return (
    <div className="entretien-add-row" role="group" aria-label="Ajouter un document légal">
      <select id="docLegalType" aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}>
        {TYPES_DOCUMENTS_LEGAUX.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <input type="date" id="docLegalExpiration" aria-label="Date d'expiration (si applicable)" placeholder="Date d'expiration (si applicable)" value={validite} onChange={(e) => setValidite(e.target.value)} />
      <label className="btn small" style={{ cursor: "pointer" }} htmlFor={idFichier} title={fichier?.name}>
        📎 Fichier
        <input type="file" id={idFichier} accept=".pdf,image/*" style={{ display: "none" }} onChange={(e) => setFichier(e.target.files?.[0] ?? null)} />
      </label>
      <button type="button" className="btn primary" disabled={ajouter.isPending} onClick={envoyer}>
        + Ajouter
      </button>
    </div>
  );
}
