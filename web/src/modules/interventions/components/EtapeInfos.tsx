import { cloneElement, useId, useState, type ReactElement } from "react";
import { useClients, useInterlocuteurs } from "@/modules/clients/hooks/useClients";
import { useConducteurs } from "@/modules/societes/hooks/useConducteurs";
import { avecLeBon, type BonSource } from "../domain/assistant";
import { METIERS_RAPPORT, type LogementStatut, type MetierRapport, type SaisieRapport } from "../domain/rapport";
import { useBonsLiables } from "../hooks/useRapports";

interface Props {
  saisie: SaisieRapport;
  onChange: (s: SaisieRapport) => void;
}

/** `logementOptions` de l'ancien écran. */
const LOGEMENTS: [string, string][] = [
  ["", "Non précisé"],
  ["occupé", "Logement occupé"],
  ["vacant", "Logement vacant"],
  ["commune", "Partie commune"],
];

const HEURES_PAR_JOUR = 24;
const MINUTES_PAR_HEURE = 60;
const deux = (n: number) => String(n).padStart(2, "0");
/** `heureOptions` : toutes les minutes du jour, comme l'ancien sélecteur. */
const HEURES = Array.from({ length: HEURES_PAR_JOUR * MINUTES_PAR_HEURE }, (_, i) => `${deux(Math.floor(i / MINUTES_PAR_HEURE))}:${deux(i % MINUTES_PAR_HEURE)}`);

/**
 * Un `.field` de l'ancien : le libellé, puis la saisie. Le libellé désigne sa
 * saisie (`htmlFor`) — l'ancien ne le faisait pas, un lecteur d'écran n'y
 * entendait qu'une suite de champs sans nom.
 */
function Champ({ libelle, children, className = "field", style }: { libelle: string; children: ReactElement<{ id?: string }>; className?: string; style?: React.CSSProperties }) {
  const genere = useId();
  const id = children.props.id ?? genere;
  return (
    <div className={className} style={style}>
      <label htmlFor={id}>{libelle}</label>
      {cloneElement(children, { id })}
    </div>
  );
}

/** `interlocuteurOptions` : ceux du client, et celui déjà écrit s'il n'y est plus (« — hors répertoire »). */
function Interlocuteurs({ clientId, courant, onChange }: { clientId: string; courant: string; onChange: (v: string) => void }) {
  const interlocuteurs = useInterlocuteurs(clientId);
  const liste = interlocuteurs.data ?? [];
  return <OptionsInterlocuteurs liste={liste} courant={courant} onChange={onChange} />;
}

function OptionsInterlocuteurs({ liste, courant, onChange }: { liste: readonly { id: string; nom: string; fonction?: string | null }[]; courant: string; onChange: (v: string) => void }) {
  const connu = liste.some((i) => i.nom === courant);
  return (
    <select id="f_interlocuteurInter" value={courant} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Aucun —</option>
      {courant && !connu && <option value={courant}>{courant} — hors répertoire</option>}
      {liste.map((i) => (
        <option key={i.id} value={i.nom}>
          {i.nom}
          {i.fonction ? ` (${i.fonction})` : ""}
        </option>
      ))}
    </select>
  );
}

/**
 * Étape 1 — Infos (`stepInfosHTML`) : client, interlocuteur, bon lié (un seul
 * rapport par bon), le logement quand il diffère du client, date, conducteur,
 * heure, type d'intervention. Le terrain, qui ne lit pas le répertoire des
 * clients, part du bon ou écrit le nom.
 */
export function EtapeInfos({ saisie, onChange }: Props) {
  const clients = useClients();
  const conducteurs = useConducteurs();
  const bons = useBonsLiables();
  const [locataire, setLocataire] = useState(!!(saisie.logement_statut || saisie.adresse_locataire || saisie.occupant));
  const repertoire = [...(clients.data ?? [])].sort((a, b) => a.nom.localeCompare(b.nom));
  const clientConnu = repertoire.some((c) => c.id === saisie.client_id);
  const bonsDuClient = (bons.data ?? []).filter((b) => !saisie.client_nom || b.client_nom === saisie.client_nom || b.id === saisie.bon_commande_id);
  const maj = (champs: Partial<SaisieRapport>) => onChange({ ...saisie, ...champs });
  const s = saisie.logement_statut;
  const choisissables = (conducteurs.data ?? []).filter((c) => c.actif || c.id === saisie.conducteur_id).sort((a, b) => a.nom.localeCompare(b.nom));

  return (
    <div className="field-grid">
      <Champ libelle="Client">
        {repertoire.length ? (
          <select
            id="f_client"
            value={saisie.client_id ?? ""}
            onChange={(e) => {
              const c = repertoire.find((x) => x.id === e.target.value);
              maj({ client_id: c?.id ?? null, client_nom: c?.nom ?? "", interlocuteur: "" });
            }}
          >
            <option value="">— Sélectionner un client —</option>
            {saisie.client_nom && !clientConnu && <option value="">{saisie.client_nom} — hors répertoire</option>}
            {repertoire.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        ) : (
          <input type="text" id="f_client" value={saisie.client_nom} onChange={(e) => maj({ client_nom: e.target.value })} />
        )}
      </Champ>
      <Champ libelle="Interlocuteur">
        {saisie.client_id ? <Interlocuteurs clientId={saisie.client_id} courant={saisie.interlocuteur} onChange={(v) => maj({ interlocuteur: v })} /> : <OptionsInterlocuteurs liste={[]} courant={saisie.interlocuteur} onChange={(v) => maj({ interlocuteur: v })} />}
      </Champ>
      <Champ libelle="Bon de commande lié (si applicable)">
        <select id="f_bonCommandeIdInter" value={saisie.bon_commande_id ?? ""} onChange={(e) => onChange(avecLeBon(saisie, ((bons.data ?? []).find((b) => b.id === e.target.value) as BonSource | undefined) ?? null))}>
          <option value="">— Aucun —</option>
          {bonsDuClient.map((b) => (
            <option key={b.id} value={b.id}>
              {b.numero_bc ?? ""}
              {b.client_nom ? ` — ${b.client_nom}` : ""}
            </option>
          ))}
        </select>
      </Champ>
      <div className="field full" style={{ marginBottom: "2px" }}>
        <button type="button" className="btn small ghost" aria-expanded={locataire} onClick={() => setLocataire(!locataire)}>
          + Le locataire est différent du client
        </button>
      </div>
      <div id="locataireBoxInter" style={{ display: locataire ? "contents" : "none" }}>
        <Champ libelle="Type">
          <select id="f_logementStatutInter" value={s ?? ""} onChange={(e) => maj({ logement_statut: (e.target.value || null) as LogementStatut | null })}>
            {LOGEMENTS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </Champ>
        <Champ libelle="Précision (partie commune)" className="field full" style={{ display: s === "commune" ? undefined : "none" }}>
          <input type="text" value={saisie.precision_commune} placeholder="Cave, hall d'entrée, local poubelles, parking, toiture…" onChange={(e) => maj({ precision_commune: e.target.value })} />
        </Champ>
        <Champ libelle="Ancien locataire" className="field full" style={{ display: s === "vacant" ? undefined : "none" }}>
          <input type="text" value={saisie.ancien_locataire} placeholder="Ex : M. Dupont" onChange={(e) => maj({ ancien_locataire: e.target.value })} />
        </Champ>
        <Champ libelle="Locataire" style={{ display: s === "occupé" ? undefined : "none" }}>
          <input type="text" id="f_occupant" value={saisie.occupant} onChange={(e) => maj({ occupant: e.target.value })} />
        </Champ>
        <div className="address-trio">
          <Champ libelle="Lieu d'intervention" style={{ position: "relative" }}>
            <input type="text" id="f_adresseLocataire" autoComplete="off" value={saisie.adresse_locataire} placeholder="Laisser vide si identique à l'adresse client" onChange={(e) => maj({ adresse_locataire: e.target.value })} />
          </Champ>
          <Champ libelle="Code postal">
            <input type="text" id="f_codePostal" autoComplete="off" maxLength={5} inputMode="numeric" value={saisie.code_postal} onChange={(e) => maj({ code_postal: e.target.value })} />
          </Champ>
          <Champ libelle="Ville">
            <input type="text" id="f_ville" autoComplete="off" value={saisie.ville} onChange={(e) => maj({ ville: e.target.value })} />
          </Champ>
        </div>
        <Champ libelle="Étage" style={{ display: s === "occupé" || s === "vacant" ? undefined : "none" }}>
          <input type="text" value={saisie.etage} placeholder="RDC, 1er, 2e…" onChange={(e) => maj({ etage: e.target.value })} />
        </Champ>
        <Champ libelle="N° de logement" style={{ display: s === "occupé" || s === "vacant" ? undefined : "none" }}>
          <input type="text" value={saisie.numero_logement} placeholder="Ex : 12, Appt 3B" onChange={(e) => maj({ numero_logement: e.target.value })} />
        </Champ>
      </div>
      <Champ libelle="Date">
        <input type="date" value={saisie.date} onChange={(e) => maj({ date: e.target.value })} />
      </Champ>
      <Champ libelle="Conducteur de travaux">
        <select value={saisie.conducteur_id ?? ""} onChange={(e) => maj({ conducteur_id: e.target.value || null })}>
          <option value="">— Non attribué —</option>
          {choisissables.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
              {c.actif ? "" : " (retiré)"}
            </option>
          ))}
        </select>
      </Champ>
      <Champ libelle="Heure">
        <select value={saisie.heure} onChange={(e) => maj({ heure: e.target.value })}>
          {HEURES.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
      </Champ>
      <Champ libelle="Type d'intervention">
        <select value={saisie.metier ?? ""} onChange={(e) => maj({ metier: (e.target.value || null) as MetierRapport | null })}>
          <option value="">— Choisir —</option>
          {METIERS_RAPPORT.map((m) => (
            <option key={m.valeur} value={m.valeur}>{m.libelle}</option>
          ))}
        </select>
      </Champ>
    </div>
  );
}
