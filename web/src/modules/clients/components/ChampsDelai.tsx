import { useState } from "react";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { DELAIS_PREREGLES, delaiHorsPlafond, delaiPreregle, MODES_REGLEMENT, type ModeDelaiPaiement } from "../domain/delais";

interface Props {
  jours: string;
  mode: string;
  modePaiement: string;
  erreurJours?: string | undefined;
  erreurMode?: string | undefined;
  onChange: (champ: "delai_paiement_jours" | "delai_paiement_mode" | "mode_paiement", v: string) => void;
}

const AUTRE = "autre";
const SOCIETE = "";

/** Délai de paiement : un préréglage, « défaut de la société », ou un délai libre. */
export function ChampsDelai({ jours, mode, modePaiement, erreurJours, erreurMode, onChange }: Props) {
  const modeSur: ModeDelaiPaiement = mode === "fin_de_mois" ? "fin_de_mois" : "net";
  const delai = jours === "" ? null : { jours: Number(jours), mode: modeSur };
  // Le choix de la liste est un état À PART, dérivé des valeurs seulement à
  // l'ouverture : sinon choisir « Autre » puis taper 30 ramènerait la liste sur
  // « Net 30 jours » et ferait disparaître le champ pendant la frappe.
  const [cle, setCle] = useState(() => (delai === null ? SOCIETE : (delaiPreregle(delai)?.cle ?? AUTRE)));
  const avertissement = delai && Number.isFinite(delai.jours) ? delaiHorsPlafond(delai) : null;

  function choisir(c: string) {
    setCle(c);
    if (c === SOCIETE) return onChange("delai_paiement_jours", "");
    if (c === AUTRE) return;
    const p = DELAIS_PREREGLES.find((d) => d.cle === c);
    if (p) {
      onChange("delai_paiement_jours", String(p.jours));
      onChange("delai_paiement_mode", p.mode);
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ChampChoix
        libelle="Délai de paiement"
        valeur={cle}
        onChange={choisir}
        options={[
          { valeur: SOCIETE, libelle: "Celui de la société" },
          ...DELAIS_PREREGLES.map((d) => ({ valeur: d.cle, libelle: d.libelle })),
          { valeur: AUTRE, libelle: "Autre délai…" },
        ]}
      />
      <ChampChoix
        libelle="Mode de paiement"
        valeur={modePaiement}
        onChange={(v) => onChange("mode_paiement", v)}
        erreur={erreurMode}
        options={[
          { valeur: "", libelle: "Virement (défaut)" },
          ...MODES_REGLEMENT.map((m) => ({ valeur: m.code, libelle: m.libelle })),
          ...(["traite", "autre"].includes(modePaiement) ? [{ valeur: modePaiement, libelle: modePaiement === "traite" ? "Traite" : "Autre" }] : []),
        ]}
      />
      {cle === AUTRE && (
        <>
          <ChampTexte
            libelle="Nombre de jours"
            inputMode="numeric"
            valeur={jours}
            onChange={(v) => onChange("delai_paiement_jours", v)}
            erreur={erreurJours}
          />
          <ChampChoix
            libelle="Décompte"
            valeur={modeSur}
            onChange={(v) => onChange("delai_paiement_mode", v)}
            options={[
              { valeur: "net", libelle: "Net (à date de facture)" },
              { valeur: "fin_de_mois", libelle: "Fin de mois" },
            ]}
          />
        </>
      )}
      {avertissement && <Alert className="sm:col-span-2">{avertissement} Enregistrable, mais à justifier.</Alert>}
    </div>
  );
}
