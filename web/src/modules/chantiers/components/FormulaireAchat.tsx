import { type FormEvent } from "react";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { arrondiCentimes, montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { afficherToast } from "@/lib/toast";
import { useFormulaire } from "@/lib/useFormulaire";
import { erreursParChamp } from "@/lib/validation";
import { CATEGORIE_SALARIE, montantSalarie, schemaSaisieAchat, type CategorieAchat } from "../domain/achats";
import { useAjouterAchat, useSalaries } from "../hooks/useFiche";

const vide = (categorie: string) => ({ categorie, designation: "", montant: "", date_achat: todayISO(), salarie_id: "", heures: "", fournisseur: "" });

/**
 * La carte d'ajout d'un achat de l'ancien (`achat-add-card`). En main-d'œuvre,
 * choisir le salarié et les heures remplit le montant (heures × coût horaire
 * chargé, au centime) et la désignation si elle est vide (CHA-22). Sans coût
 * horaire lisible (CHA-55), le montant se saisit à la main.
 */
export function FormulaireAchat({ chantierId, categories }: { chantierId: string; categories: readonly CategorieAchat[] }) {
  useModeDiscret();
  const ajouter = useAjouterAchat(chantierId);
  const salaries = useSalaries();
  const { valeurs, changer, reinitialiser } = useFormulaire(vide(categories[0]?.code ?? ""));
  const categorie = valeurs.categorie || categories[0]?.code || "";
  const mainOeuvre = categorie === CATEGORIE_SALARIE;
  const salarie = salaries.data?.find((s) => s.id === valeurs.salarie_id);
  const calcul = salarie ? montantSalarie(valeurs.heures, salarie.cout_horaire_charge) : null;

  function recalculer(salarieId: string, heures: string) {
    const s = salaries.data?.find((x) => x.id === salarieId);
    const m = s ? montantSalarie(heures, s.cout_horaire_charge) : null;
    if (m) changer("montant", arrondiCentimes(m).toFixed(2));
    if (s && !valeurs.designation) changer("designation", [s.prenom, s.nom].filter(Boolean).join(" "));
  }

  function soumettre(e: FormEvent) {
    e.preventDefault();
    if (!valeurs.designation.trim()) return afficherToast("Indiquez une désignation pour cet achat.");
    const essai = schemaSaisieAchat.safeParse({ ...valeurs, categorie });
    // Comme l'ancien, un refus se dit en bulle : la ligne d'ajout n'a pas de place pour un message sous chaque champ.
    if (!essai.success) return afficherToast(Object.values(erreursParChamp(essai.error))[0] ?? "Achat invalide.");
    ajouter.mutate(
      essai.data,
      {
        onSuccess: () => {
          reinitialiser(vide(categorie));
          afficherToast("Achat enregistré.", "success");
        },
        onError: (err) => afficherToast(messageErreur(err)),
      }
    );
  }

  return (
    <form className="achat-add-card" onSubmit={soumettre} noValidate aria-label="Ajouter un achat">
      <div className="achat-add-row">
        <select aria-label="Catégorie" value={categorie} onChange={(e) => changer("categorie", e.target.value)}>
          {categories.map((c) => (
            <option key={c.code} value={c.code}>
              {c.icone} {c.libelle}
            </option>
          ))}
        </select>
        <input type="text" aria-label="Désignation" placeholder="Désignation…" style={{ flex: 1 }} value={valeurs.designation} onChange={(e) => changer("designation", e.target.value)} />
        <input type="number" step="0.01" aria-label="Montant HT" placeholder="Montant HT" value={valeurs.montant} onChange={(e) => changer("montant", e.target.value)} />
        <input type="date" aria-label="Date" value={valeurs.date_achat} onChange={(e) => changer("date_achat", e.target.value)} />
        <button type="submit" className="btn primary" disabled={ajouter.isPending}>
          + Ajouter
        </button>
      </div>
      <div className="achat-salarie-zone" style={{ display: mainOeuvre ? "flex" : "none" }}>
        <select
          aria-label="Salarié"
          value={valeurs.salarie_id}
          onChange={(e) => {
            changer("salarie_id", e.target.value);
            recalculer(e.target.value, valeurs.heures);
          }}
        >
          <option value="">— Sans conducteur / non renseigné —</option>
          {(salaries.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.prenom ?? ""} {s.nom ?? ""}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.25"
          aria-label="Heures"
          placeholder="Heures"
          value={valeurs.heures}
          onChange={(e) => {
            changer("heures", e.target.value);
            recalculer(valeurs.salarie_id, e.target.value);
          }}
        />
        <span className="card-sub" aria-live="polite">
          {salarie && salarie.cout_horaire_charge ? `${formatEurosEcran(montant(salarie.cout_horaire_charge))}/h × ${valeurs.heures || 0}h = ${formatEurosEcran(calcul ?? montant(0))}` : ""}
        </span>
      </div>
    </form>
  );
}
