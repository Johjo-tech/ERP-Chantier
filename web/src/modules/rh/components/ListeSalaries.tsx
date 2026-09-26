import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { formatDateFr, todayISO } from "@/lib/dates";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { useToastErreur } from "@/modules/materiel/components/communs";
import { absenceEnCours, type Absence } from "../domain/conges";
import { aVerifier, conformiteRh, motifIncomplet, type SeuilsRh } from "../domain/conformite";
import type { DocumentRh } from "../domain/documents";
import { filtrerSalaries, metiersDuFiltre, type Salarie } from "../domain/salarie";
import { useMetiersRh, useAbsencesRh, useDocumentsRh, useDroitsRh, useGererSalaries, useSalariesRh, useSeuilsRh, useVisitesRh } from "../hooks/useRh";
import { BadgeVisite } from "./BadgeVisite";

/** L'écart entre le nom et chaque pastille de la carte (`margin-left:6px` de l'ancien). */
const PASTILLE = { marginLeft: "6px" } as const;

/**
 * La rubrique « Salariés » (`renderRHSalaries`, app.js l. 15474) : en-tête « RH »
 * et ses deux boutons, recherche et filtre métier, la zone du formulaire, puis
 * les cartes. Formulaire ouvert, l'en-tête perd ses boutons et la recherche
 * disparaît — la liste reste dessous, comme dans l'ancien écran.
 */
export function ListeSalaries({ formulaire }: { formulaire?: ReactNode }) {
  useModeDiscret();
  const droits = useDroitsRh();
  const salaries = useSalariesRh();
  const metiers = useMetiersRh();
  const [recherche, setRecherche] = useState("");
  const [metier, setMetier] = useState("");
  const referentiel = metiers.data;

  return (
    <>
      <div className="page-head">
        <h1>RH</h1>
        {!formulaire && (
          <div style={{ display: "flex", gap: "8px" }}>
            {droits.sensible && (
              <Link className="btn" to="/rh/registre">
                📋 Registre unique du personnel
              </Link>
            )}
            {droits.creer && (
              <Link className="btn primary" to="/rh/salaries/nouveau">
                + Nouveau salarié
              </Link>
            )}
          </div>
        )}
      </div>
      {!formulaire && (
        <div style={{ display: "flex", gap: "10px", marginBottom: "18px", flexWrap: "wrap" }}>
          <input type="text" aria-label="Rechercher un salarié" style={{ flex: 1, minWidth: "220px" }} placeholder="Rechercher : nom, prénom, poste…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          <select aria-label="Filtrer par métier" style={{ width: "auto", minWidth: "180px" }} value={metier} onChange={(e) => setMetier(e.target.value)}>
            <option value="">Tous les métiers</option>
            {metiersDuFiltre(referentiel, salaries.data ?? []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}
      <div id="formZoneSalarie">{formulaire}</div>
      <div id="rhListZone">
        {salaries.isPending && <Chargement />}
        {salaries.isError && <Erreur erreur={salaries.error} reessayer={() => void salaries.refetch()} />}
        {salaries.isSuccess && <Cartes liste={filtrerSalaries(salaries.data, recherche, metier)} />}
      </div>
    </>
  );
}

function Cartes({ liste }: { liste: readonly Salarie[] }) {
  const droits = useDroitsRh();
  const documents = useDocumentsRh();
  const visites = useVisitesRh();
  const absences = useAbsencesRh();
  const seuils = useSeuilsRh();
  const gerer = useGererSalaries();
  useToastErreur(gerer.supprimer.error);
  if (!liste.length) return <div className="empty">Aucun salarié pour cette société.</div>;
  // Tant que les dossiers ne sont pas lus, pas de badge : « incomplet » sur un dossier non lu serait un mensonge.
  const dossiersLus = droits.sensible && documents.isSuccess && visites.isSuccess;
  return (
    <>
      {liste.map((s) => (
        <CarteSalarie
          key={s.id}
          s={s}
          documents={(documents.data ?? []).filter((d) => d.salarieId === s.id)}
          absences={(absences.data ?? []).filter((a) => a.salarieId === s.id)}
          dossiersLus={dossiersLus}
          seuils={seuils}
          supprimer={() => {
            if (window.confirm("Supprimer définitivement cet élément ?")) gerer.supprimer.mutate(s.id);
          }}
        />
      ))}
    </>
  );
}

interface PropsCarte {
  s: Salarie;
  documents: DocumentRh[];
  absences: Absence[];
  dossiersLus: boolean;
  seuils: SeuilsRh;
  supprimer: () => void;
}

/** Une carte de `renderSalarieListHTML` (app.js l. 15675) : pastilles, coordonnées, coûts, trois boutons. */
function CarteSalarie({ s, documents, absences, dossiersLus, seuils, supprimer }: PropsCarte) {
  useModeDiscret();
  const droits = useDroitsRh();
  const aujourdHui = todayISO();
  const verifier = aVerifier(s.carteBtpValidite, documents, aujourdHui, seuils);
  const absent = absenceEnCours(absences, aujourdHui);
  const bilan = dossiersLus ? conformiteRh(documents, s.visiteMedicaleProchaine, aujourdHui, seuils) : null;
  return (
    <div className="card">
      <div className="card-row">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card-title">
            {s.prenom ?? ""} {s.nom}{" "}
            {!s.actif && (
              <span className="badge gray" style={PASTILLE}>
                sorti
              </span>
            )}
            {verifier.length > 0 && (
              <span className="badge warn" style={PASTILLE} title={verifier.join(", ")}>
                ⚠ à vérifier
              </span>
            )}
            {droits.sensible && <BadgeVisite prochaine={s.visiteMedicaleProchaine} seuil={seuils.visiteMedicale} />}
            {absent && (
              <span className="badge" style={{ ...PASTILLE, background: "#fff0f0", color: "#a30f22" }}>
                🏖️ Absent ({absent.type}, retour {formatDateFr(absent.dateFin)})
              </span>
            )}
            {bilan && !bilan.complet && (
              <span className="badge danger" style={PASTILLE} title={motifIncomplet(bilan)}>
                📁 dossier incomplet
              </span>
            )}
            {!s.profileId && (
              <span className="badge warn" style={PASTILLE} title="Sans compte, ce salarié ne peut pas déclarer ses travaux lui-même">
                ⚠ sans compte
              </span>
            )}
          </div>
          <div className="card-sub">
            {s.poste ?? ""}
            {s.typeContrat && ` · ${s.typeContrat}`}
            {s.technicienId && " · 🔧 équipe liée"}
          </div>
          <div className="card-sub">
            {s.telephone && `📞 ${s.telephone}`}
            {s.email && ` · ✉ ${s.email}`}
          </div>
        </div>
        {droits.sensible && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div className="amount">{s.coutHoraireCharge != null ? `${formatEurosEcran(montant(s.coutHoraireCharge))}/h` : "—"}</div>
            <div className="card-sub">coût chargé</div>
            <div className="amount" style={{ marginTop: "6px" }}>
              {s.salaireMensuelNet != null ? formatEurosEcran(montant(s.salaireMensuelNet)) : "—"}
            </div>
            <div className="card-sub">salaire net/mois</div>
          </div>
        )}
      </div>
      <div style={{ marginTop: "10px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {droits.modifier && (
          <Link className="btn small" to={`/rh/salaries/${s.id}`}>
            Modifier
          </Link>
        )}
        {droits.sensible && (
          <Link className="btn small" to={`/rh?vue=documents&salarie=${s.id}`}>
            📁 Dossier
          </Link>
        )}
        {droits.supprimer && (
          <button type="button" className="btn small danger" onClick={supprimer}>
            Supprimer
          </button>
        )}
      </div>
    </div>
  );
}
