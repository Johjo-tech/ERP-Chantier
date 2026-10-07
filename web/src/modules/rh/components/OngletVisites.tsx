import { useState } from "react";
import { Erreur } from "@/components/etats/Etats";
import { formatDateFr, todayISO } from "@/lib/dates";
import { nomComplet } from "../domain/salarie";
import { avisAptitude, etatVisite, trierVisites, typeVisite, type EtatVisite } from "../domain/visites";
import { useSalariesRh, useSeuilsRh, useVisitesRh } from "../hooks/useRh";
import { EcheanceVisite } from "./BadgeVisite";
import { PastilleRh } from "./communs";
import { SectionVisites } from "./SectionVisites";

const PASTILLE = { inconnue: "manquant", depassee: "expire", bientot: "bientot", aJour: "ok" } as const;
const TITRE = { inconnue: "Aucune visite enregistrée", depassee: "Échéance dépassée", bientot: "Échéance proche", aJour: "Suivi à jour" } as const;
/** Les couleurs de l'avis rendu (`renderRHVisites`) : inapte en rouge, réserves en orangé, apte en vert. */
const COULEUR_AVIS = { ok: "#15803d", warn: "#a56200", danger: "#a30f22" } as const;

/**
 * Le registre des visites médicales de la société (RH-07), au HTML de
 * `renderRHVisites` (rh-visites.js l. 578). L'échéance de la dernière visite
 * pilote l'alerte ; le seuil est celui du médical (Réglages › RH, 45 j par
 * défaut), pas celui des documents.
 */
export function OngletVisites() {
  const salaries = useSalariesRh();
  const visites = useVisitesRh();
  const seuils = useSeuilsRh();
  const [filtre, setFiltre] = useState<EtatVisite | "">("");
  const [ouvert, setOuvert] = useState<string | null>(null);

  const erreur = salaries.error ?? visites.error;
  if (erreur) return <Erreur erreur={erreur} reessayer={() => void Promise.all([salaries.refetch(), visites.refetch()])} />;
  if (!salaries.isSuccess || !visites.isSuccess) {
    return (
      <div className="empty" data-chargement="oui" role="status">
        Chargement du registre des visites…
      </div>
    );
  }

  const aujourdHui = todayISO();
  const lignes = salaries.data.map((s) => ({
    s,
    visites: trierVisites(visites.data.filter((v) => v.salarieId === s.id)),
    etat: etatVisite(s.visiteMedicaleProchaine, aujourdHui, seuils.visiteMedicale).etat,
  }));
  const compte = (e: EtatVisite) => lignes.filter((l) => l.etat === e).length;
  const liste = filtre ? lignes.filter((l) => l.etat === filtre) : lignes;
  const choisi = lignes.find((l) => l.s.id === ouvert) ?? null;
  const filtres: { f: EtatVisite | ""; libelle: string }[] = [
    { f: "", libelle: `Tous (${lignes.length})` },
    { f: "depassee", libelle: `Échéance dépassée (${compte("depassee")})` },
    { f: "bientot", libelle: `À prévoir (${compte("bientot")})` },
    { f: "inconnue", libelle: `Jamais vus (${compte("inconnue")})` },
    { f: "aJour", libelle: `À jour (${compte("aJour")})` },
  ];

  return (
    <>
      <div className="page-head">
        <h1>Visites médicales</h1>
      </div>
      <div className="card-sub" style={{ marginBottom: "14px" }}>
        Suivi en santé au travail : embauche, périodique, reprise. L&apos;échéance de la dernière visite pilote l&apos;alerte, et remplace les deux dates autrefois saisies sur la fiche.
      </div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "18px", flexWrap: "wrap" }} role="group" aria-label="Filtrer par état du suivi">
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
                <th>
                  <span className="sr-only">État</span>
                </th>
                <th>Dernière visite</th>
                <th>Type</th>
                <th>Avis</th>
                <th>Prochaine</th>
                <th>Historique</th>
                <th>
                  <span className="sr-only">Ouvrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {liste.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty">
                    Aucun salarié ne correspond à ce filtre.
                  </td>
                </tr>
              ) : (
                liste.map(({ s, visites: vs, etat }) => {
                  const derniere = vs[0] ?? null;
                  const avis = derniere ? avisAptitude(derniere.avis) : null;
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
                      <td style={{ textAlign: "center" }}>
                        <PastilleRh etat={PASTILLE[etat]} titre={TITRE[etat]} />
                      </td>
                      <td>{derniere ? formatDateFr(derniere.dateVisite) : "—"}</td>
                      <td>{derniere ? typeVisite(derniere.type).libelle : "—"}</td>
                      <td style={avis ? { color: COULEUR_AVIS[avis.gravite], fontWeight: 700 } : undefined}>{avis ? avis.libelle : "—"}</td>
                      <td>
                        <EcheanceVisite prochaine={s.visiteMedicaleProchaine} seuil={seuils.visiteMedicale} />
                      </td>
                      <td>{vs.length || "—"}</td>
                      <td>
                        <button type="button" className="btn small" onClick={() => setOuvert(ouvert === s.id ? null : s.id)}>
                          {ouvert === s.id ? "Fermer" : "Ouvrir"}
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
      {choisi && (
        <div className="card" style={{ marginTop: "20px" }}>
          <div className="card-row">
            <div className="card-title">{nomComplet(choisi.s)} — suivi médical</div>
            <button type="button" className="btn small ghost" onClick={() => setOuvert(null)}>
              Fermer
            </button>
          </div>
          <div style={{ marginTop: "10px" }}>
            <SectionVisites salarieId={choisi.s.id} visites={choisi.visites} prochaine={choisi.s.visiteMedicaleProchaine} />
          </div>
        </div>
      )}
    </>
  );
}
