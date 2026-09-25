import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useClients, useInterlocuteurs } from "@/modules/clients/hooks/useClients";
import { useConducteurs } from "@/modules/societes/hooks/useConducteurs";
import { avecLeBon, type BonSource } from "../domain/assistant";
import { METIERS_RAPPORT, type LogementStatut, type MetierRapport, type SaisieRapport } from "../domain/rapport";
import { useBonsLiables } from "../hooks/useRapports";

interface Props {
  saisie: SaisieRapport;
  onChange: (s: SaisieRapport) => void;
  erreurs: Record<string, string>;
}

const LOGEMENTS: { valeur: LogementStatut; libelle: string }[] = [
  { valeur: "occupé", libelle: "Logement occupé" },
  { valeur: "vacant", libelle: "Logement vacant" },
  { valeur: "commune", libelle: "Partie commune" },
];

function Champ({ libelle, children, erreur }: { libelle: string; children: React.ReactNode; erreur?: string | undefined }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {libelle}
      {children}
      {erreur && <span className="text-xs text-destructive">{erreur}</span>}
    </label>
  );
}

/** Interlocuteurs du client choisi, ou saisie libre quand le client n'est pas au répertoire. */
function ChoixInterlocuteur({ saisie, onChange }: Omit<Props, "erreurs">) {
  if (!saisie.client_id) return <Input value={saisie.interlocuteur} onChange={(e) => onChange({ ...saisie, interlocuteur: e.target.value })} />;
  return <InterlocuteursDuClient clientId={saisie.client_id} saisie={saisie} onChange={onChange} />;
}

function InterlocuteursDuClient({ clientId, saisie, onChange }: Omit<Props, "erreurs"> & { clientId: string }) {
  const interlocuteurs = useInterlocuteurs(clientId);
  const liste = interlocuteurs.data ?? [];
  if (!liste.length) return <Input value={saisie.interlocuteur} onChange={(e) => onChange({ ...saisie, interlocuteur: e.target.value })} />;
  return (
    <Select value={saisie.interlocuteur} onChange={(e) => onChange({ ...saisie, interlocuteur: e.target.value })}>
      <option value="">— Aucun —</option>
      {liste.map((i) => <option key={i.id} value={i.nom}>{i.nom}</option>)}
    </Select>
  );
}

/**
 * Étape 1 — Infos : client, interlocuteur, bon lié (un seul rapport par bon),
 * lieu et logement, date, heure, conducteur, type d'intervention. Le terrain
 * ne lit pas le répertoire des clients : il part du bon, ou saisit le nom.
 */
export function EtapeInfos({ saisie, onChange, erreurs }: Props) {
  const clients = useClients();
  const conducteurs = useConducteurs();
  const bons = useBonsLiables();
  const [locataire, setLocataire] = useState(!!(saisie.logement_statut || saisie.adresse_locataire || saisie.occupant));
  const repertoire = clients.data ?? [];
  const bonsDuClient = (bons.data ?? []).filter((b) => !saisie.client_id || b.client_id === saisie.client_id || b.id === saisie.bon_commande_id);
  const maj = (champs: Partial<SaisieRapport>) => onChange({ ...saisie, ...champs });
  const s = saisie.logement_statut;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Champ libelle="Client *" erreur={erreurs.client_nom}>
        {repertoire.length ? (
          <Select value={saisie.client_id ?? ""} onChange={(e) => { const c = repertoire.find((x) => x.id === e.target.value); maj({ client_id: c?.id ?? null, client_nom: c?.nom ?? "", interlocuteur: "" }); }}>
            <option value="">— Sélectionner un client —</option>
            {saisie.client_nom && !saisie.client_id && <option value="">{saisie.client_nom} — hors répertoire</option>}
            {repertoire.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </Select>
        ) : (
          <Input value={saisie.client_nom} onChange={(e) => maj({ client_nom: e.target.value })} />
        )}
      </Champ>
      <Champ libelle="Interlocuteur"><ChoixInterlocuteur saisie={saisie} onChange={onChange} /></Champ>
      <Champ libelle="Bon de commande lié (si applicable)">
        <Select value={saisie.bon_commande_id ?? ""} onChange={(e) => onChange(avecLeBon(saisie, (bons.data ?? []).find((b) => b.id === e.target.value) as BonSource | undefined ?? null))}>
          <option value="">— Aucun —</option>
          {bonsDuClient.map((b) => <option key={b.id} value={b.id}>{b.numero_bc || b.numero_interne || "Bon sans numéro"} — {b.client_nom}</option>)}
        </Select>
      </Champ>
      <div className="sm:col-span-2">
        <Button type="button" variant="ghost" size="sm" aria-expanded={locataire} onClick={() => setLocataire(!locataire)}>+ Le locataire est différent du client</Button>
      </div>
      {locataire && (
        <>
          <Champ libelle="Type">
            <Select value={s ?? ""} onChange={(e) => maj({ logement_statut: (e.target.value || null) as LogementStatut | null })}>
              <option value="">— Choisir —</option>
              {LOGEMENTS.map((l) => <option key={l.valeur} value={l.valeur}>{l.libelle}</option>)}
            </Select>
          </Champ>
          {s === "commune" && <Champ libelle="Précision (partie commune)"><Input value={saisie.precision_commune} placeholder="Cave, hall d'entrée, local poubelles…" onChange={(e) => maj({ precision_commune: e.target.value })} /></Champ>}
          {s === "vacant" && <Champ libelle="Ancien locataire"><Input value={saisie.ancien_locataire} placeholder="Ex : M. Dupont" onChange={(e) => maj({ ancien_locataire: e.target.value })} /></Champ>}
          {s === "occupé" && <Champ libelle="Locataire"><Input value={saisie.occupant} onChange={(e) => maj({ occupant: e.target.value })} /></Champ>}
          <Champ libelle="Lieu d'intervention"><Input value={saisie.adresse_locataire} placeholder="Laisser vide si identique à l'adresse client" onChange={(e) => maj({ adresse_locataire: e.target.value })} /></Champ>
          <Champ libelle="Code postal" erreur={erreurs.code_postal}><Input value={saisie.code_postal} inputMode="numeric" maxLength={5} onChange={(e) => maj({ code_postal: e.target.value })} /></Champ>
          <Champ libelle="Ville"><Input value={saisie.ville} onChange={(e) => maj({ ville: e.target.value })} /></Champ>
          {(s === "occupé" || s === "vacant") && (
            <>
              <Champ libelle="Étage"><Input value={saisie.etage} placeholder="RDC, 1er, 2e…" onChange={(e) => maj({ etage: e.target.value })} /></Champ>
              <Champ libelle="N° de logement"><Input value={saisie.numero_logement} placeholder="Ex : 12, Appt 3B" onChange={(e) => maj({ numero_logement: e.target.value })} /></Champ>
            </>
          )}
        </>
      )}
      <Champ libelle="Date" erreur={erreurs.date}><Input type="date" value={saisie.date} onChange={(e) => maj({ date: e.target.value })} /></Champ>
      <Champ libelle="Heure"><Input type="time" value={saisie.heure} onChange={(e) => maj({ heure: e.target.value })} /></Champ>
      <Champ libelle="Conducteur de travaux">
        <Select value={saisie.conducteur_id ?? ""} onChange={(e) => maj({ conducteur_id: e.target.value || null })}>
          <option value="">— Aucun —</option>
          {(conducteurs.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </Select>
      </Champ>
      <Champ libelle="Type d'intervention">
        <Select value={saisie.metier ?? ""} onChange={(e) => maj({ metier: (e.target.value || null) as MetierRapport | null })}>
          <option value="">— Choisir —</option>
          {METIERS_RAPPORT.map((m) => <option key={m.valeur} value={m.valeur}>{m.libelle}</option>)}
        </Select>
      </Champ>
    </div>
  );
}
