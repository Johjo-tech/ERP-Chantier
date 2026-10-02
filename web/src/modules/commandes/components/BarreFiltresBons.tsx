import type { KeyboardEventHandler, ReactNode } from "react";
import type { FiltresBons } from "../domain/filtres";

interface Props {
  filtres: FiltresBons;
  onChange: (f: FiltresBons) => void;
  conducteurs: readonly { id: string; nom: string }[];
  valeurs: { metiers: readonly string[]; clients: readonly string[]; interlocuteurs: readonly string[] };
  /** Recherche différée (TRV-06) : la saisie s'affiche tout de suite, le filtre suit après une pause. */
  saisie?: { valeur: string; onChange: (v: string) => void; onKeyDown: KeyboardEventHandler<HTMLInputElement> };
}

function Liste({ libelle, largeur, valeur, onChange, children }: { libelle: string; largeur: string; valeur: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <select aria-label={libelle} style={{ width: "auto", minWidth: largeur }} value={valeur} onChange={(e) => onChange(e.target.value)}>
      {children}
    </select>
  );
}

const options = (valeurs: readonly string[]) => valeurs.map((v) => <option key={v} value={v}>{v}</option>);

/**
 * Les huit filtres de l'ancienne liste (BC-01), dans son ordre et avec ses
 * libellés : recherche, conducteur, type, mode de création, logement, métier,
 * client, interlocuteur. Changer de client remet l'interlocuteur à « tous ».
 */
export function BarreFiltresBons({ filtres, onChange, conducteurs, valeurs, saisie }: Props) {
  const changer = <K extends keyof FiltresBons>(cle: K, v: FiltresBons[K]) => onChange({ ...filtres, [cle]: v });
  return (
    <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
      <input
        type="text"
        id="bonCommandeSearchInput"
        aria-label="Rechercher un bon de commande"
        style={{ flex: 1, minWidth: "220px" }}
        value={saisie ? saisie.valeur : filtres.recherche}
        placeholder="Rechercher : n° BC ou interne, client, locataire, adresse, n° de facture…"
        title="Cherche aussi par nature des travaux, référence chantier, métier, montant du bon et montant de la facture liée."
        onChange={(e) => (saisie ? saisie.onChange(e.target.value) : changer("recherche", e.target.value))}
        onKeyDown={saisie?.onKeyDown}
      />
      <Liste libelle="Conducteur" largeur="180px" valeur={filtres.conducteurId} onChange={(v) => changer("conducteurId", v)}>
        <option value="">Tous les conducteurs</option>
        {conducteurs.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
      </Liste>
      <Liste libelle="Type" largeur="170px" valeur={filtres.type} onChange={(v) => changer("type", v as FiltresBons["type"])}>
        <option value="">Type</option>
        <option value="bc">Bons de commande</option>
        <option value="sav">SAV</option>
      </Liste>
      <Liste libelle="Mode de création" largeur="220px" valeur={filtres.mode} onChange={(v) => changer("mode", v as FiltresBons["mode"])}>
        <option value="">Tous les modes de création</option>
        <option value="normal">Bon de commande (n° normal)</option>
        <option value="sans_bc">Sans bon de commande</option>
        <option value="attente_bc">En attente de bon de commande</option>
      </Liste>
      <Liste libelle="Logement" largeur="170px" valeur={filtres.logement} onChange={(v) => changer("logement", v as FiltresBons["logement"])}>
        <option value="">Tous les logements</option>
        <option value="occupé">🏠 Occupé</option>
        <option value="vacant">🔑 Vacant</option>
        <option value="commune">🚪 Partie commune</option>
      </Liste>
      <Liste libelle="Métier" largeur="170px" valeur={filtres.metier} onChange={(v) => changer("metier", v)}>
        <option value="">Tous les métiers</option>
        {options(valeurs.metiers)}
      </Liste>
      <Liste libelle="Client" largeur="170px" valeur={filtres.client} onChange={(v) => onChange({ ...filtres, client: v, interlocuteur: "" })}>
        <option value="">Tous les clients</option>
        {options(valeurs.clients)}
      </Liste>
      <Liste libelle="Interlocuteur" largeur="190px" valeur={filtres.interlocuteur} onChange={(v) => changer("interlocuteur", v)}>
        <option value="">Tous les interlocuteurs</option>
        {options(valeurs.interlocuteurs)}
      </Liste>
    </div>
  );
}
