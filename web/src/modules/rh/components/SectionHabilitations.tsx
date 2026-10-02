import { useToastErreur } from "@/modules/materiel/components/communs";
import { libelleDepuisNomFichier, TYPE_HABILITATION, type DocumentRh } from "../domain/documents";
import { useDroitsRh, useGererDossier, useSeuilsRh, type HabilitationEnAttente } from "../hooks/useRh";
import { ChoixFichier } from "./communs";
import { LigneDocument } from "./SectionDossier";

interface Props {
  salarieId: string | null;
  documents: readonly DocumentRh[];
  enAttente: HabilitationEnAttente[];
  onEnAttente: (h: HabilitationEnAttente[]) => void;
}

/**
 * Habilitations et certifications (CACES, habilitation électrique, AIPR), au
 * HTML de `habilitationsZoneHTML` (app.js l. 16576). Elles vont au dossier
 * (type `habilitation`, D-RH-03) ; choisies avant l'enregistrement, elles
 * attendent et partent avec la fiche.
 */
export function SectionHabilitations({ salarieId, documents, enAttente, onEnAttente }: Props) {
  const droits = useDroitsRh();
  const seuils = useSeuilsRh();
  const gerer = useGererDossier();
  useToastErreur(gerer.supprimerDocument.error);
  const deja = documents.filter((d) => d.type === TYPE_HABILITATION);
  const maj = (cle: string, champ: "nom" | "dateExpiration", valeur: string) => onEnAttente(enAttente.map((h) => (h.cle === cle ? { ...h, [champ]: valeur } : h)));
  const ajouter = (fichiers: (File | null)[]) =>
    onEnAttente([...enAttente, ...fichiers.map((fichier) => ({ cle: crypto.randomUUID(), nom: fichier ? libelleDepuisNomFichier(fichier.name) : "", dateExpiration: "", fichier }))]);

  return (
    <>
      <p className="card-sub">CACES, habilitation électrique, AIPR… Joignez l&apos;attestation (PDF ou image) et sa date de fin de validité : sans elle, aucune alerte ne préviendra de son expiration.</p>
      {deja.length > 0 && (
        <div style={{ marginTop: "8px" }}>
          {deja.map((d) => (
            <LigneDocument
              key={d.id}
              doc={d}
              seuil={seuils.habilitation}
              modifier={null}
              retirer={
                droits.supprimer
                  ? () => {
                      if (window.confirm("Retirer ce document du dossier ? Le fichier joint sera supprimé.")) gerer.supprimerDocument.mutate(d);
                    }
                  : null
              }
            />
          ))}
        </div>
      )}
      {enAttente.length > 0 && (
        <div style={{ marginTop: "8px" }}>
          {enAttente.map((h, i) => (
            <div key={h.cle} className="chantier-file-row">
              <span style={{ flex: 1, minWidth: 0, display: "flex", gap: "8px", alignItems: "center" }}>
                <input
                  type="text"
                  aria-label={`Intitulé de l'habilitation ${i + 1}`}
                  value={h.nom}
                  placeholder="Ex : CACES R486, Habilitation électrique B1V…"
                  style={{ flex: 1, minWidth: 0 }}
                  onChange={(e) => maj(h.cle, "nom", e.target.value)}
                />
                <input
                  type="date"
                  aria-label={`Fin de validité de l'habilitation ${i + 1}`}
                  value={h.dateExpiration}
                  style={{ width: "auto" }}
                  title="Fin de validité"
                  onChange={(e) => maj(h.cle, "dateExpiration", e.target.value)}
                />
              </span>
              <span className="card-sub">{h.fichier ? `📎 ${h.fichier.name}` : "sans fichier"}</span>
              <span className="badge warn" title="Sera déposée à l'enregistrement de la fiche">
                à déposer
              </span>
              <button type="button" className="btn small danger" aria-label={`Retirer l'habilitation ${i + 1}`} onClick={() => onEnAttente(enAttente.filter((x) => x.cle !== h.cle))}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {!deja.length && !enAttente.length && <div className="empty">Aucune habilitation renseignée.</div>}
      {droits.modifier && (
        <div className="achat-salarie-zone" style={{ marginTop: "10px" }}>
          <ChoixFichier libelle="Joindre des habilitations" multiple primaire sansNom onFichiers={(f) => ajouter(f)} />
          <button type="button" className="btn small" onClick={() => ajouter([null])}>
            + Sans fichier
          </button>
          {!salarieId && <span className="card-sub">Elles seront déposées à l&apos;enregistrement de la fiche.</span>}
        </div>
      )}
    </>
  );
}
