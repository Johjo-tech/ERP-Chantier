import { useState } from "react";
import { useSearchParams } from "react-router";
import { Erreur } from "@/components/etats/Etats";
import { todayISO } from "@/lib/dates";
import { conformiteRh, filtrerDossiers, resumeDossier, type FiltreDossiers } from "../domain/conformite";
import { pastilleDocument, TYPES_DOCUMENT_RH } from "../domain/documents";
import { etatVisite } from "../domain/visites";
import { nomComplet } from "../domain/salarie";
import { useDocumentsRh, useSalariesRh, useSeuilsRh, useVisitesRh } from "../hooks/useRh";
import { PastilleRh } from "./communs";
import { SectionDossier } from "./SectionDossier";

const OBLIGATOIRES = TYPES_DOCUMENT_RH.filter((t) => t.obligatoire);
const PASTILLE_VISITE = { inconnue: "manquant", depassee: "expire", bientot: "bientot", aJour: "ok" } as const;
const TITRE_VISITE = { inconnue: "Aucune visite enregistrée", depassee: "Échéance dépassée", bientot: "Échéance proche", aJour: "Suivi à jour" } as const;

/**
 * Les dossiers documentaires (RH-04, RH-09), au HTML de `renderRHDocuments`
 * (app.js l. 15990) : une ligne par salarié, une colonne par pièce
 * obligatoire, la colonne 🩺 venant du registre des visites. Il attend les
 * DEUX sources : afficher « manquant » avant la lecture mentirait.
 */
export function OngletDocuments({ salarieOuvert }: { salarieOuvert: string | null }) {
  const salaries = useSalariesRh();
  const documents = useDocumentsRh();
  const visites = useVisitesRh();
  const seuils = useSeuilsRh();
  const [filtre, setFiltre] = useState<FiltreDossiers>("");
  const [, setParams] = useSearchParams();

  const erreur = salaries.error ?? documents.error ?? visites.error;
  if (erreur) return <Erreur erreur={erreur} reessayer={() => void Promise.all([salaries.refetch(), documents.refetch(), visites.refetch()])} />;
  if (!salaries.isSuccess || !documents.isSuccess || !visites.isSuccess) {
    return (
      <div className="empty" data-chargement="oui" role="status">
        Chargement des dossiers documentaires…
      </div>
    );
  }

  const aujourdHui = todayISO();
  const lignes = salaries.data.map((s) => {
    const docs = documents.data.filter((d) => d.salarieId === s.id);
    return { s, docs, bilan: conformiteRh(docs, s.visiteMedicaleProchaine, aujourdHui, seuils) };
  });
  const liste = filtrerDossiers(lignes, filtre);
  const ouvert = lignes.find((l) => l.s.id === salarieOuvert) ?? null;
  const basculer = (id: string) => setParams(id === salarieOuvert ? { vue: "documents" } : { vue: "documents", salarie: id });
  const filtres: { f: FiltreDossiers; libelle: string }[] = [
    { f: "", libelle: `Tous (${lignes.length})` },
    { f: "incomplets", libelle: `Dossiers incomplets (${lignes.filter((l) => !l.bilan.complet).length})` },
    { f: "expires", libelle: `Documents expirés (${lignes.reduce((n, l) => n + l.bilan.expires.length, 0)})` },
    { f: "bientot", libelle: `Expirent bientôt (${lignes.reduce((n, l) => n + l.bilan.bientot.length, 0)})` },
  ];

  return (
    <>
      <div className="page-head">
        <h1>Dossiers documentaires</h1>
      </div>
      <div className="card-sub" style={{ marginBottom: "14px" }}>
        Contrat, DPAE, carte BTP, identité, RIB : les pièces que l&apos;inspection du travail peut demander. Les fichiers sont rangés dans un espace privé, cloisonné par société. La colonne 🩺 vient du registre des visites médicales.
      </div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "18px", flexWrap: "wrap" }} role="group" aria-label="Filtrer les dossiers">
        {filtres.map((x) => (
          <button key={x.f} type="button" className={`btn small ${filtre === x.f ? "primary" : ""}`} aria-pressed={filtre === x.f} onClick={() => setFiltre(x.f)}>
            {x.libelle}
          </button>
        ))}
      </div>
      {lignes.length === 0 ? (
        <div className="empty">Aucun salarié pour cette société.</div>
      ) : (
        <div className="vehicule-liste-wrap">
          <table className="stats-table">
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Salarié</th>
                {OBLIGATOIRES.map((t) => (
                  <th key={t.code} className="doc-rh-colonne" title={t.libelle}>
                    <span>{t.icone}</span>
                    {t.libelle}
                  </th>
                ))}
                <th className="doc-rh-colonne" title="Visite médicale — vient du registre, pas du dossier">
                  <span>🩺</span>Visite médicale
                </th>
                <th>Autres</th>
                <th>Dossier</th>
                <th>
                  <span className="sr-only">Ouvrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {liste.length === 0 ? (
                <tr>
                  <td colSpan={OBLIGATOIRES.length + 5} className="empty">
                    Aucun salarié ne correspond à ce filtre.
                  </td>
                </tr>
              ) : (
                liste.map(({ s, docs, bilan }) => {
                  const resume = resumeDossier(bilan);
                  const visite = etatVisite(s.visiteMedicaleProchaine, aujourdHui, seuils.visiteMedicale).etat;
                  return (
                    <tr key={s.id}>
                      <td style={{ textAlign: "left" }}>
                        <strong>{nomComplet(s)}</strong>
                        {s.poste && (
                          <>
                            {" "}
                            <span className="card-sub">· {s.poste}</span>
                          </>
                        )}
                      </td>
                      {OBLIGATOIRES.map((t) => (
                        <td key={t.code} style={{ textAlign: "center" }}>
                          <PastilleRh etat={pastilleDocument(docs, t.code, aujourdHui, seuils.documentLegal)} />
                        </td>
                      ))}
                      <td style={{ textAlign: "center" }}>
                        <PastilleRh etat={PASTILLE_VISITE[visite]} titre={TITRE_VISITE[visite]} />
                      </td>
                      <td>{docs.filter((d) => !OBLIGATOIRES.some((t) => t.code === d.type)).length || "—"}</td>
                      <td>{resume ? <span className="badge danger">{resume}</span> : <span className="badge">Complet</span>}</td>
                      <td>
                        <button type="button" className="btn small" onClick={() => basculer(s.id)}>
                          {salarieOuvert === s.id ? "Fermer" : "Ouvrir"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      <div className="card-sub" style={{ marginTop: "8px" }}>
        Légende : ✓ au dossier · ~ expire bientôt · ! expiré · ? sans date de fin · ✕ manquant. La colonne 🩺 se corrige depuis l&apos;onglet Visites médicales.
      </div>
      {ouvert && (
        <div className="card" style={{ marginTop: "20px" }}>
          <div className="card-row">
            <div className="card-title">{nomComplet(ouvert.s)} — dossier documentaire</div>
            <button type="button" className="btn small ghost" onClick={() => basculer(ouvert.s.id)}>
              Fermer
            </button>
          </div>
          <div style={{ marginTop: "10px" }}>
            <SectionDossier salarieId={ouvert.s.id} documents={ouvert.docs} />
          </div>
        </div>
      )}
    </>
  );
}
