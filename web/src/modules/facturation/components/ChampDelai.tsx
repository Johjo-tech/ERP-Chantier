import { useState } from "react";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { DELAIS_PREREGLES, delaiPreregle, type DelaiPaiement } from "@/modules/clients/domain/delais";

const LIBRE = "libre";

/**
 * Les conditions de paiement de LA facture (FAC-04, app.js l. 3001-3110) :
 * un délai préréglé, ou libre (jours + net / fin de mois). Le délai du client
 * n'est qu'une proposition ; celui de la facture est figé dans
 * `conditions_reglement` (BT-20) à l'enregistrement.
 */
export function ChampDelai({ delai, onChange, desactive }: { delai: DelaiPaiement; onChange: (d: DelaiPaiement) => void; desactive: boolean }) {
  const preregle = delaiPreregle(delai);
  // « Autre délai » reste choisi même quand les jours saisis retombent sur un préréglage.
  const [libre, setLibre] = useState(!preregle);
  const cle = libre || !preregle ? LIBRE : preregle.cle;
  return (
    <div className="grid gap-3 sm:col-span-3 sm:grid-cols-3">
      <ChampChoix
        libelle="Conditions de paiement"
        valeur={cle}
        desactive={desactive}
        onChange={(v) => {
          const choisi = DELAIS_PREREGLES.find((d) => d.cle === v);
          setLibre(!choisi);
          if (choisi) onChange({ jours: choisi.jours, mode: choisi.mode });
        }}
        options={[...DELAIS_PREREGLES.map((d) => ({ valeur: d.cle, libelle: d.libelle })), { valeur: LIBRE, libelle: "Autre délai…" }]}
      />
      {cle === LIBRE && (
        <>
          <ChampTexte
            libelle="Délai (jours)"
            inputMode="numeric"
            valeur={String(delai.jours)}
            desactive={desactive}
            onChange={(v) => {
              const n = Number.parseInt(v, 10);
              onChange({ ...delai, jours: Number.isFinite(n) && n >= 0 ? n : 0 });
            }}
          />
          <ChampChoix
            libelle="Décompte"
            valeur={delai.mode}
            desactive={desactive}
            onChange={(v) => onChange({ ...delai, mode: v === "fin_de_mois" ? "fin_de_mois" : "net" })}
            options={[{ valeur: "net", libelle: "Net" }, { valeur: "fin_de_mois", libelle: "Fin de mois" }]}
          />
        </>
      )}
    </div>
  );
}
