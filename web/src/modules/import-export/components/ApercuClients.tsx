import type { ReactNode } from "react";
import { CADRES_FACTURATION } from "@/modules/clients/domain/client";
import type { ApercuImportClients } from "../domain/apercu-clients";
import type { RapportImportClients } from "../domain/clients";

const MAX = { rejets: 8, signalements: 6, noms: 6 } as const;

interface Props {
  nom: string;
  rapport: RapportImportClients;
  apercu: ApercuImportClients;
  onImporter: () => void;
  onRapport: () => void;
  retour: ReactNode;
}

const LISTE = { margin: 0, paddingLeft: "18px" } as const;
const TITRE = { fontWeight: 700, marginBottom: "6px" } as const;

function Chiffre({ valeur, libelle, couleur }: { valeur: number; libelle: string; couleur?: string | undefined }) {
  return (
    <div>
      <div className="hero-stat-value" style={couleur ? { color: couleur } : undefined}>
        {valeur}
      </div>
      <div className="card-sub">{libelle}</div>
    </div>
  );
}

/** Une liste tronquée dans un bandeau : l'aperçu montre assez pour juger, le rapport dit tout. */
function Bandeau({ titre, lignes, max, alerte, reste }: { titre: string; lignes: readonly string[]; max: number; alerte?: boolean; reste: (n: number) => string }) {
  if (!lignes.length) return null;
  return (
    <div className={alerte ? "wf-banner alerte" : "wf-banner"} style={{ marginTop: "10px" }}>
      <div style={TITRE}>{titre}</div>
      <ul style={LISTE}>
        {lignes.slice(0, max).map((l, i) => (
          <li key={`${i}-${l}`}>{l}</li>
        ))}
      </ul>
      {lignes.length > max && (
        <div className="card-sub" style={{ marginTop: "6px" }}>
          {reste(lignes.length - max)}
        </div>
      )}
    </div>
  );
}

/**
 * Ce que l'import va faire, avant le clic (IMP-13), au HTML de l'ancien
 * (`importClientsHTML`, étape « apercu »). L'annuaire n'est pas interrogé
 * (D-EFA-06) : pas de ligne « Annuaire : … » ni de corrections — la phrase qui
 * les remplace dit pourquoi.
 */
export function ApercuClients({ nom, rapport, apercu, onImporter, onRapport, retour }: Props) {
  const total = apercu.aCreer + apercu.aMettreAJour;
  const cadres = CADRES_FACTURATION.filter((c) => apercu.cadres[c.code]);
  return (
    <section aria-label={`Aperçu de ${nom}`} className="form-panel">
      <h3>{nom}</h3>
      <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", margin: "14px 0" }}>
        <Chiffre valeur={apercu.aCreer} libelle="à créer" />
        <Chiffre valeur={apercu.aMettreAJour} libelle="à mettre à jour" />
        <Chiffre valeur={rapport.rejets.length} libelle="rejetés" couleur={rapport.rejets.length ? "var(--danger)" : "inherit"} />
        <Chiffre valeur={apercu.ambigus.length} libelle="ambigus" couleur={apercu.ambigus.length ? "#C24E00" : "inherit"} />
        <Chiffre valeur={rapport.signalements.length} libelle="signalés" />
      </div>
      <div className="card-sub" style={{ margin: "10px 0" }}>
        {/* À la place du « Annuaire : 0 interrogé… » de l'ancien, une ligne de même gabarit (D-EFA-06, D-EFA-07). */}
        Annuaire : non interrogé.
      </div>
      {cadres.length > 0 && (
        <div className="wf-banner" style={{ marginTop: "10px" }}>
          <div style={TITRE}>Types de clients déduits</div>
          <ul style={LISTE}>
            {cadres.map((c) => {
              const seau = apercu.cadres[c.code];
              return (
                <li key={c.code}>
                  <b>{seau?.compte}</b> {c.libelle} — {seau?.noms.slice(0, MAX.noms).join(", ")}
                  {(seau?.noms.length ?? 0) > MAX.noms ? "…" : ""}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <Bandeau
        titre="Laissés de côté — plusieurs clients portent déjà ce nom"
        lignes={apercu.ambigus.map((a) => `${a.nom} — déjà : ${a.homonymes.join(", ")}`)}
        max={apercu.ambigus.length}
        alerte
        reste={() => ""}
      />
      <Bandeau titre="Lignes écartées" lignes={rapport.rejets.map((r) => `Ligne ${r.ligne} — ${r.motif}`)} max={MAX.rejets} alerte reste={(n) => `…et ${n} autres, dans le rapport.`} />
      <Bandeau
        titre="Décidé à la place du fichier"
        lignes={rapport.signalements.map((s) => `Ligne ${s.ligne}${s.code ? ` (${s.code})` : ""} — ${s.motif}`)}
        max={MAX.signalements}
        reste={(n) => `…et ${n} autres.`}
      />
      <div style={{ display: "flex", gap: "10px", marginTop: "16px", flexWrap: "wrap" }}>
        <button type="button" className="btn primary" disabled={!total} onClick={onImporter}>
          Importer {total} client{total > 1 ? "s" : ""}
        </button>
        <button type="button" className="btn" onClick={onRapport}>
          📄 Rapport
        </button>
        {retour}
      </div>
    </section>
  );
}
