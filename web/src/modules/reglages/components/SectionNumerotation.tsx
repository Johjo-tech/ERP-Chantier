import { useState } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { afficherToast } from "@/lib/toast";
import { usePermission, useSocieteActive } from "@/modules/auth-roles/hooks/useSession";
import {
  apercuNumero,
  baisses,
  lignesNumerotation,
  schemaSaisieCompteur,
  type LigneNumerotation,
  type SaisieCompteur,
  type TypeSerie,
} from "../domain/numerotation";
import { anneeCourante, useCompteurs, useReglerCompteurs } from "../hooks/useReglagesEcran";
import { PiedEnregistrement } from "./champs";

/** Préfixe et point de départ de chaque série pour l'année (PAR-03). La base attribue, l'écran règle. */
export function SectionNumerotation() {
  const annee = anneeCourante();
  const compteurs = useCompteurs(annee);
  const regler = useReglerCompteurs(annee);
  if (compteurs.isPending) return <Chargement />;
  if (compteurs.isError) return <Erreur erreur={compteurs.error} reessayer={() => void compteurs.refetch()} />;
  const lignes = lignesNumerotation(compteurs.data, annee);
  return <TableauNumerotation key={JSON.stringify(lignes)} lignes={lignes} annee={annee} regler={regler} />;
}

type Saisies = Record<TypeSerie, { prefixe: string; valeur: string }>;

/**
 * `renderNumerotationSection` + `tableauNumerotation` (app.js l. 12867) : la
 * table `.table` des séries, préfixe et dernier numéro saisissables, aperçu du
 * prochain. Baisser un compteur se confirme en une fois pour toutes les séries
 * concernées (D-SOC-10).
 */
function TableauNumerotation({ lignes, annee, regler }: { lignes: LigneNumerotation[]; annee: number; regler: ReturnType<typeof useReglerCompteurs> }) {
  const societe = useSocieteActive();
  const modifiable = usePermission("reglages", "modifier");
  const [saisies, setSaisies] = useState<Saisies>(
    () => Object.fromEntries(lignes.map((l) => [l.type, { prefixe: l.prefixe, valeur: String(l.valeur) }])) as Saisies
  );

  function lire(): Record<TypeSerie, SaisieCompteur> | null {
    const sortie: Partial<Record<TypeSerie, SaisieCompteur>> = {};
    for (const l of lignes) {
      const r = schemaSaisieCompteur.safeParse(saisies[l.type]);
      if (!r.success) {
        afficherToast(`${l.libelle} : ${r.error.issues[0]?.message ?? "saisie invalide."}`);
        return null;
      }
      sortie[l.type] = r.data;
    }
    return sortie as Record<TypeSerie, SaisieCompteur>;
  }

  function enregistrer() {
    const series = lire();
    if (!series) return;
    // Baisser un compteur réattribuerait des numéros déjà émis : on le fait confirmer.
    const b = baisses(lignes, series);
    if (b.length && !window.confirm(`${b.map((x) => `${x.libelle} : passer de ${x.de} à ${x.a}`).join(" ; ")} réattribuera des numéros déjà utilisés. Continuer ?`)) return;
    regler.mutate(series);
  }

  const changer = (type: TypeSerie, champ: "prefixe" | "valeur", v: string) => setSaisies((s) => ({ ...s, [type]: { ...s[type], [champ]: v } }));

  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: "10px" }}>
        🔢 Numérotation
      </div>
      <div className="card-sub" style={{ marginBottom: "12px" }}>
        Préfixe et point de départ de chaque série, pour {societe.nom} en {annee}. Les numéros sont attribués par la base de façon atomique — deux personnes ne peuvent pas obtenir le même.
      </div>
      <div id="zoneNumerotation">
        <table className="table">
          <thead>
            <tr>
              <th>Document</th>
              <th style={{ width: "110px" }}>Préfixe</th>
              <th style={{ width: "140px" }}>Dernier n° attribué</th>
              <th>Prochain</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => {
              const s = saisies[l.type];
              return (
                <tr key={l.type}>
                  <td>{l.libelle}</td>
                  <td>
                    <input type="text" id={`num_p_${l.type}`} aria-label={`Préfixe — ${l.libelle}`} maxLength={8} style={{ width: "90px" }} value={s.prefixe} disabled={!modifiable} onChange={(e) => changer(l.type, "prefixe", e.target.value)} />
                  </td>
                  <td>
                    <input type="number" min="0" id={`num_v_${l.type}`} aria-label={`Dernier numéro — ${l.libelle}`} style={{ width: "110px" }} value={s.valeur} disabled={!modifiable} onChange={(e) => changer(l.type, "valeur", e.target.value)} />
                  </td>
                  <td>
                    <code id={`num_a_${l.type}`}>{apercuNumero(s.prefixe, Number.parseInt(s.valeur, 10) || 0, annee)}</code>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {modifiable && (
          <PiedEnregistrement
            modifiable
            type="button"
            onClick={enregistrer}
            style={{ marginTop: "14px" }}
            enCours={regler.isPending}
            erreur={regler.error}
            succes={regler.isSuccess ? "Numérotation enregistrée." : null}
            libelle="Enregistrer la numérotation"
          />
        )}
      </div>
      <small style={{ display: "block", marginTop: "12px", color: "var(--text-dim)", fontSize: "11px" }}>
        Les bons de commande n&apos;ont pas de série : leur numéro figure sur le document du client. Les compteurs repartent de zéro chaque année civile.
      </small>
    </div>
  );
}
