import type { ReactNode } from "react";
import { useInterlocuteurs } from "@/modules/clients/hooks/useClients";
import { communesDuCodePostal } from "@/modules/clients/api/communes";
import { useListeDevis } from "@/modules/devis/hooks/useDevis";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { useConducteurs, optionsConducteurs } from "@/modules/societes/hooks/useConducteurs";
import { facturationRenseignee, type ValeursBon } from "../domain/bon";
import { devisProposes } from "../domain/formulaire";
import { memeMetier } from "../domain/metiers";
import type { ModeBon } from "../domain/regles";
import { ChampAdresse, Champ, ChampListe, ChampZone } from "./ChampsBon";

export type Changer = (champ: keyof ValeursBon, v: string) => void;

interface Base {
  valeurs: ValeursBon;
  changer: Changer;
  erreurs: Record<string, string>;
  desactive: boolean;
}

/** Les trois modes de création (`setBCMode`), en sous-onglets : seulement pour un bon neuf. */
export function ModesBon({ mode, onChange }: { mode: ModeBon; onChange: (m: ModeBon) => void }) {
  const bouton = (m: ModeBon, libelle: string) => (
    <button type="button" className={`plus-subnav-btn ${mode === m ? "active" : ""}`} aria-pressed={mode === m} onClick={() => onChange(m)}>{libelle}</button>
  );
  return (
    <div className="plus-subnav" style={{ marginBottom: "16px" }} role="group" aria-label="Mode du bon de commande">
      {bouton("normal", "Nouveau bon de commande")}
      {bouton("sans_bc", "Sans bon de commande")}
      {bouton("attente_bc", "En attente de bon de commande")}
    </div>
  );
}

function Tete({ libelle, icone = true }: { libelle: string; icone?: boolean }) {
  return <div className="form-section-head">{icone && <span className="form-section-ico" />}{libelle}</div>;
}

/** Les interlocuteurs du client choisi, avec leur fonction (`interlocuteurOptions`). */
function ChoixInterlocuteur({ clientId, valeur, changer, desactive }: { clientId: string; valeur: string; changer: Changer; desactive: boolean }) {
  const liste = useInterlocuteurs(clientId);
  const connus = liste.data ?? [];
  // Un nom qui n'est plus au répertoire reste proposé plutôt que d'être effacé en silence.
  const hors = valeur && !connus.some((i) => i.nom === valeur) ? [{ valeur, libelle: `${valeur} — hors répertoire` }] : [];
  const options = [{ valeur: "", libelle: "— Aucun —" }, ...hors, ...connus.map((i) => ({ valeur: i.nom, libelle: `${i.nom}${i.fonction ? ` (${i.fonction})` : ""}` }))];
  return <ChampListe id="bc_interlocuteur" libelle="Interlocuteur" valeur={valeur} desactive={desactive} onChange={(v) => changer("interlocuteur", v)} options={options} />;
}

/** Le devis dont le bon découle (`devisSelectOptions`) : ceux du client, pas encore liés à un autre bon. */
function ChoixDevis({ valeurs, changer, desactive, clientNom, devisLies }: Pick<Base, "valeurs" | "changer" | "desactive"> & { clientNom: string; devisLies: readonly (string | null)[] }) {
  const devis = useListeDevis();
  const options = devisProposes(devis.data ?? [], { clientNom, interlocuteur: valeurs.interlocuteur, courant: valeurs.devis_id, devisLies });
  return (
    <ChampListe
      id="bc_devisId"
      libelle="Devis lié (si applicable)"
      valeur={valeurs.devis_id}
      desactive={desactive}
      onChange={(v) => changer("devis_id", v)}
      options={[{ valeur: "", libelle: "— Aucun —" }, ...options.map((d) => ({ valeur: d.id, libelle: `${d.numero ?? ""}${d.client_nom ? ` — ${d.client_nom}` : ""}` }))]}
    />
  );
}

interface PropsClient extends Base {
  clients: readonly { id: string; nom: string }[];
  sav: boolean;
  devisLies: readonly (string | null)[];
}

/** « Client & contact » : client, interlocuteur, devis lié, et l'adresse de facturation repliée. */
export function SectionClient({ valeurs, changer, erreurs, desactive, clients, sav, devisLies }: PropsClient) {
  const voitDevis = usePermission("devis");
  const tries = [...clients].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  const client = clients.find((c) => c.id === valeurs.client_id);
  return (
    <div className="form-section">
      <Tete libelle="Client & contact" />
      <div className="field-grid">
        <ChampListe
          id="bc_client"
          libelle="Client"
          valeur={valeurs.client_id}
          erreur={erreurs.client_id}
          desactive={desactive}
          onChange={(v) => { changer("client_id", v); changer("interlocuteur", ""); changer("devis_id", ""); }}
          options={[{ valeur: "", libelle: "— Sélectionner un client —" }, ...tries.map((c) => ({ valeur: c.id, libelle: c.nom }))]}
        />
        {valeurs.client_id ? (
          <ChoixInterlocuteur clientId={valeurs.client_id} valeur={valeurs.interlocuteur} changer={changer} desactive={desactive} />
        ) : (
          <ChampListe id="bc_interlocuteur" libelle="Interlocuteur" valeur="" desactive={desactive} onChange={() => undefined} options={[{ valeur: "", libelle: "— Aucun —" }]} />
        )}
        {!sav && voitDevis && <ChoixDevis valeurs={valeurs} changer={changer} desactive={desactive} clientNom={client?.nom ?? ""} devisLies={devisLies} />}
      </div>
      {/* Replié par défaut, déplié dès qu'une valeur existe : c'est la lecture du bon client qui la remplit le plus souvent. */}
      <details style={{ marginTop: "8px" }} open={facturationRenseignee(valeurs) || undefined}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>🧾 Adresse de facturation différente</summary>
        <div className="card-sub" style={{ margin: "8px 0" }}>À remplir seulement si le bon en désigne une — service comptable, centre de gestion. Vide, c&apos;est le siège du client qui sert.</div>
        <div className="field-grid">
          <div className="address-trio">
            <Champ id="bc_facturationAdresse" libelle="Adresse de facturation" valeur={valeurs.facturation_adresse} placeholder="Où envoyer la facture" desactive={desactive} onChange={(v) => changer("facturation_adresse", v)} />
            <Champ
              id="bc_facturationCodePostal"
              libelle="Code postal"
              valeur={valeurs.facturation_code_postal}
              maxLength={5}
              inputMode="numeric"
              desactive={desactive}
              onChange={(v) => changer("facturation_code_postal", v)}
              onInput={(cp) => void communesDuCodePostal(cp).then((c) => c[0] && changer("facturation_ville", c[0]))}
            />
            <Champ id="bc_facturationVille" libelle="Ville" valeur={valeurs.facturation_ville} desactive={desactive} onChange={(v) => changer("facturation_ville", v)} />
          </div>
        </div>
      </details>
    </div>
  );
}

/** L'aide sous le numéro, selon le mode : il reste saisissable en attente ou sans BC (BC-74). */
const AIDES: Partial<Record<ModeBon, string>> = {
  attente_bc: "Dès qu'il arrive, saisissez-le ici : le bon devient un bon de commande standard, et le numéro part sur la facture.",
  sans_bc: "Ce client travaille sans bon de commande. Si l'un arrive malgré tout, saisissez-le ici.",
};
const SUFFIXES: Record<ModeBon, string> = { normal: "", attente_bc: " — en attente", sans_bc: " — sans BC" };

interface PropsNumero extends Base {
  mode: ModeBon;
  sav: boolean;
  /** La pièce jointe (bon) ou le problème et les photos (SAV) : le bas de la section. */
  bas: ReactNode;
}

/** « Bon de commande » (ou « SAV ») : numéro du client, référence chantier, dates, puis le document reçu. */
export function SectionNumero({ valeurs, changer, erreurs, desactive, mode, sav, bas }: PropsNumero) {
  const aide = AIDES[mode];
  return (
    <div className="form-section">
      <Tete libelle={sav ? "SAV" : "Bon de commande"} icone={false} />
      <div className="field-grid">
        {!sav && (
          <div className="bc-numref-duo">
            <ChampZone
              id="bc_numeroBC"
              libelle={`N° du bon de commande${SUFFIXES[mode]}`}
              valeur={valeurs.numero_bc}
              placeholder="Numéro indiqué sur le BC du client — passez à la ligne pour en ajouter un autre"
              style={{ minHeight: "38px" }}
              desactive={desactive}
              onChange={(v) => changer("numero_bc", v)}
              enfants={aide && <div className="card-sub" style={{ marginTop: "4px" }}>{aide}</div>}
            />
            <Champ id="bc_referenceChantier" libelle="Référence chantier (optionnel)" valeur={valeurs.reference_chantier} placeholder="N° ou nom du chantier" desactive={desactive} onChange={(v) => changer("reference_chantier", v)} />
          </div>
        )}
        {!sav && <Champ id="bc_dateReception" type="date" libelle="Date de réception du BC" valeur={valeurs.date_reception} erreur={erreurs.date_reception} desactive={desactive} onChange={(v) => changer("date_reception", v)} />}
        <Champ id="bc_dateFinTravaux" type="date" libelle="Date de fin de travaux" valeur={valeurs.date_fin_travaux} erreur={erreurs.date_fin_travaux} desactive={desactive} onChange={(v) => changer("date_fin_travaux", v)} />
        {bas}
      </div>
    </div>
  );
}

/** « Lieu & locataire » (`toggleOccupantField`) : seuls les champs utiles au type choisi se montrent. */
export function SectionLieuBon({ valeurs, changer, erreurs, desactive }: Base) {
  const s = valeurs.logement_statut;
  const cache = (visible: boolean) => ({ display: visible ? "" : "none" });
  return (
    <div className="form-section">
      <Tete libelle="Lieu & locataire" />
      <div className="field-grid">
        <div className="address-trio">
          <ChampAdresse
            valeur={valeurs.adresse_locataire}
            erreur={erreurs.adresse_locataire}
            desactive={desactive}
            onChange={(v) => changer("adresse_locataire", v)}
            onChoisir={(a) => { changer("adresse_locataire", a.adresse); changer("code_postal", a.codePostal); changer("ville", a.ville); }}
          />
          <Champ
            id="bc_codePostal"
            libelle="Code postal"
            valeur={valeurs.code_postal}
            maxLength={5}
            inputMode="numeric"
            desactive={desactive}
            onChange={(v) => changer("code_postal", v)}
            onInput={(cp) => void communesDuCodePostal(cp).then((c) => c[0] && changer("ville", c[0]))}
          />
          <Champ id="bc_ville" libelle="Ville" valeur={valeurs.ville} desactive={desactive} onChange={(v) => changer("ville", v)} />
        </div>
        <ChampListe
          id="bc_logementStatut"
          libelle="Type"
          valeur={s}
          desactive={desactive}
          onChange={(v) => changer("logement_statut", v)}
          options={[{ valeur: "", libelle: "Non précisé" }, { valeur: "occupé", libelle: "Logement occupé" }, { valeur: "vacant", libelle: "Logement vacant" }, { valeur: "commune", libelle: "Partie commune" }]}
        />
        <Champ id="bc_precisionCommune" className="full" style={cache(s === "commune")} libelle="Précision (partie commune)" valeur={valeurs.precision_commune} placeholder="Cave, hall d'entrée, local poubelles, parking, toiture…" desactive={desactive} onChange={(v) => changer("precision_commune", v)} />
        <Champ id="bc_ancienLocataire" className="full" style={cache(s === "vacant")} libelle="Ancien locataire" valeur={valeurs.ancien_locataire} placeholder="Ex : M. Dupont" desactive={desactive} onChange={(v) => changer("ancien_locataire", v)} />
        <Champ id="bc_occupant" style={cache(s === "occupé")} libelle="Locataire" valeur={valeurs.occupant} desactive={desactive} onChange={(v) => changer("occupant", v)} />
        <Champ id="bc_telephoneLocataire" type="tel" style={cache(s === "occupé")} libelle="Téléphone du locataire" valeur={valeurs.telephone_locataire} placeholder="Ex : 06 12 34 56 78" desactive={desactive} onChange={(v) => changer("telephone_locataire", v)} />
        <Champ id="bc_etage" style={cache(s === "occupé" || s === "vacant")} libelle="Étage" valeur={valeurs.etage} placeholder="RDC, 1er, 2e…" desactive={desactive} onChange={(v) => changer("etage", v)} />
        <Champ id="bc_numeroLogement" style={cache(s === "occupé" || s === "vacant")} libelle="N° de logement" valeur={valeurs.numero_logement} placeholder="Ex : 12, Appt 3B" desactive={desactive} onChange={(v) => changer("numero_logement", v)} />
      </div>
    </div>
  );
}

interface PropsMetiers {
  disponibles: readonly string[];
  coches: readonly string[];
  origines: Readonly<Record<string, string>>;
  ajoutes: number;
  onChange: (metiers: string[]) => void;
  desactive: boolean;
}

/** Les cases des métiers (`bcMetiersZoneHTML`) : cochées à la main ou lues sur les chapitres du bon. */
function CasesMetiers({ disponibles, coches, origines, ajoutes, onChange, desactive }: PropsMetiers) {
  if (!disponibles.length) return <div className="empty">Aucun métier créé pour l&apos;instant (Réglages → Métiers).</div>;
  const estCoche = (m: string) => coches.some((c) => memeMetier(c, m));
  const basculer = (m: string) => onChange(estCoche(m) ? coches.filter((c) => !memeMetier(c, m)) : [...coches, m]);
  const origine = (m: string) => Object.entries(origines).find(([k]) => memeMetier(k, m))?.[1];
  return (
    <>
      <div className="metier-checkbox-list">
        {disponibles.map((m) => {
          const o = origine(m);
          return (
            <label key={m} className={`metier-checkbox-item${o ? " est-deduit" : ""}`} title={o ? `Lu sur le chapitre « ${o} »` : undefined}>
              <input type="checkbox" name="bc_metiers" value={m} checked={estCoche(m)} disabled={desactive} onChange={() => basculer(m)} />
              <span>{m}</span>
              {o && <small className="metier-origine">← {o}</small>}
            </label>
          );
        })}
      </div>
      {ajoutes > 0 && (
        <div className="metier-lu" role="status">
          ✓ {ajoutes} métier{ajoutes > 1 ? "s" : ""} lu{ajoutes > 1 ? "s" : ""} sur les chapitres du bon.{coches.length > 1 ? ` Ce bon se planifiera en ${coches.length} interventions, une par métier.` : ""}
        </div>
      )}
    </>
  );
}

/** « Organisation » : conducteur, nature des travaux, métiers, notes. */
export function SectionOrganisation({ valeurs, changer, desactive, metiers }: Omit<Base, "erreurs"> & { metiers: PropsMetiers }) {
  const conducteurs = useConducteurs();
  const options = optionsConducteurs(conducteurs.data ?? [], valeurs.conducteur_id || null);
  return (
    <div className="form-section">
      <Tete libelle="Organisation" />
      <div className="field-grid">
        <ChampListe id="bc_conducteur" libelle="Conducteur de travaux" valeur={valeurs.conducteur_id} desactive={desactive} onChange={(v) => changer("conducteur_id", v)} options={[{ valeur: "", libelle: "— Non attribué —" }, ...options]} />
        <Champ id="bc_natureTravaux" libelle="Nature des travaux" valeur={valeurs.nature_travaux} placeholder="Ex : Remise en état logement, Fuite d'eau…" desactive={desactive} onChange={(v) => changer("nature_travaux", v)} />
        <div className="field full">
          <label>Métier(s)</label>
          <div id="bc_metiersZone"><CasesMetiers {...metiers} /></div>
        </div>
        <Champ id="bc_notes" className="full" libelle="Notes" valeur={valeurs.notes} placeholder="Remarques…" desactive={desactive} onChange={(v) => changer("notes", v)} />
      </div>
    </div>
  );
}
