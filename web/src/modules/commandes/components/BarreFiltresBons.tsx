import type { KeyboardEventHandler } from "react";
import { Input, Select } from "@/components/ui/input";
import { STATUTS_LOGEMENT } from "@/modules/documents/domain/logement";
import type { FiltresBons } from "../domain/filtres";
import { LIBELLES_MODE, type ModeBon } from "../domain/regles";

interface Props {
  filtres: FiltresBons;
  onChange: (f: FiltresBons) => void;
  conducteurs: readonly { id: string; nom: string }[];
  valeurs: { metiers: readonly string[]; clients: readonly string[]; interlocuteurs: readonly string[] };
  /** Recherche différée (TRV-06) : la saisie s'affiche tout de suite, le filtre suit après une pause. */
  saisie?: { valeur: string; onChange: (v: string) => void; onKeyDown: KeyboardEventHandler<HTMLInputElement> };
}

const MODES = Object.keys(LIBELLES_MODE) as ModeBon[];

function Liste({ id, libelle, valeur, tous, options, onChange }: { id: string; libelle: string; valeur: string; tous: string; options: readonly { valeur: string; libelle: string }[]; onChange: (v: string) => void }) {
  return (
    <>
      <label htmlFor={id} className="sr-only">{libelle}</label>
      <Select id={id} className="max-w-56" value={valeur} onChange={(e) => onChange(e.target.value)}>
        <option value="">{tous}</option>
        {options.map((o) => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
      </Select>
    </>
  );
}

const enOptions = (valeurs: readonly string[]) => valeurs.map((v) => ({ valeur: v, libelle: v }));

/** Les huit filtres de l'ancienne liste (BC-01) : recherche, conducteur, type, mode, logement, métier, client, interlocuteur. */
export function BarreFiltresBons({ filtres, onChange, conducteurs, valeurs, saisie }: Props) {
  const changer = <K extends keyof FiltresBons>(cle: K, v: FiltresBons[K]) => onChange({ ...filtres, [cle]: v });
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      <label htmlFor="recherche-bons" className="sr-only">Rechercher un bon de commande</label>
      <Input id="recherche-bons" type="search" className="max-w-sm" placeholder="N°, client, locataire, lieu, nature, métier…" value={saisie ? saisie.valeur : filtres.recherche} onChange={(e) => (saisie ? saisie.onChange(e.target.value) : changer("recherche", e.target.value))} onKeyDown={saisie?.onKeyDown} />
      <Liste id="filtre-type-bon" libelle="Type de bon" valeur={filtres.type} tous="BC et SAV" options={[{ valeur: "bc", libelle: "BC" }, { valeur: "sav", libelle: "SAV" }]} onChange={(v) => changer("type", v as FiltresBons["type"])} />
      <Liste id="filtre-mode-bon" libelle="Mode du bon" valeur={filtres.mode} tous="Tous les modes" options={MODES.map((m) => ({ valeur: m, libelle: m === "normal" ? "Avec n° de BC" : LIBELLES_MODE[m] }))} onChange={(v) => changer("mode", v as FiltresBons["mode"])} />
      <Liste id="filtre-conducteur-bon" libelle="Conducteur" valeur={filtres.conducteurId} tous="Tous les conducteurs" options={conducteurs.map((c) => ({ valeur: c.id, libelle: c.nom }))} onChange={(v) => changer("conducteurId", v)} />
      <Liste id="filtre-logement-bon" libelle="Logement" valeur={filtres.logement} tous="Tous les logements" options={STATUTS_LOGEMENT.map((s) => ({ valeur: s.code, libelle: s.libelle }))} onChange={(v) => changer("logement", v as FiltresBons["logement"])} />
      <Liste id="filtre-metier-bon" libelle="Métier" valeur={filtres.metier} tous="Tous les métiers" options={enOptions(valeurs.metiers)} onChange={(v) => changer("metier", v)} />
      <Liste id="filtre-client-bon" libelle="Client" valeur={filtres.client} tous="Tous les clients" options={enOptions(valeurs.clients)} onChange={(v) => changer("client", v)} />
      <Liste id="filtre-interlocuteur-bon" libelle="Interlocuteur" valeur={filtres.interlocuteur} tous="Tous les interlocuteurs" options={enOptions(valeurs.interlocuteurs)} onChange={(v) => changer("interlocuteur", v)} />
    </div>
  );
}
