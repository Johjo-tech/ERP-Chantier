import { type FormEvent } from "react";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { arrondiCentimes, formatEuros, montant } from "@/lib/money";
import { useFormulaire } from "@/lib/useFormulaire";
import { CATEGORIE_SALARIE, montantSalarie, schemaSaisieAchat, type CategorieAchat } from "../domain/achats";
import { useAjouterAchat, useSalaries } from "../hooks/useFiche";

const vide = (categorie: string) => ({ categorie, designation: "", montant: "", date_achat: todayISO(), salarie_id: "", heures: "", fournisseur: "" });

/**
 * Ajout d'un achat. En main-d'œuvre, choisir le salarié et les heures remplit
 * le montant (heures × coût horaire chargé, au centime) et la désignation si
 * elle est vide — comme l'ancien écran (CHA-22). Sans coût horaire lisible
 * (conducteur : champ masqué par la vue, CHA-55), l'écran le dit et le montant
 * se saisit à la main.
 */
export function FormulaireAchat({ chantierId, categories }: { chantierId: string; categories: readonly CategorieAchat[] }) {
  const ajouter = useAjouterAchat(chantierId);
  const salaries = useSalaries();
  const { valeurs, erreurs, changer, valider, reinitialiser } = useFormulaire(vide(categories[0]?.code ?? ""));
  const mainOeuvre = valeurs.categorie === CATEGORIE_SALARIE;
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
    const a = valider(schemaSaisieAchat);
    if (a) ajouter.mutate(a, { onSuccess: () => reinitialiser(vide(valeurs.categorie)) });
  }

  return (
    <form onSubmit={soumettre} noValidate aria-label="Ajouter un achat" className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="grid gap-2 sm:grid-cols-5">
        <ChampChoix libelle="Catégorie" valeur={valeurs.categorie} onChange={(v) => changer("categorie", v)} erreur={erreurs.categorie} options={categories.map((c) => ({ valeur: c.code, libelle: `${c.icone} ${c.libelle}` }))} />
        <div className="sm:col-span-2">
          <ChampTexte libelle="Désignation" valeur={valeurs.designation} onChange={(v) => changer("designation", v)} erreur={erreurs.designation} />
        </div>
        <ChampTexte libelle="Montant HT" inputMode="decimal" valeur={valeurs.montant} onChange={(v) => changer("montant", v)} erreur={erreurs.montant} />
        <ChampTexte libelle="Date" type="date" valeur={valeurs.date_achat} onChange={(v) => changer("date_achat", v)} erreur={erreurs.date_achat} />
      </div>
      {mainOeuvre && (
        <div className="grid gap-2 sm:grid-cols-4">
          <ChampChoix
            libelle="Salarié"
            valeur={valeurs.salarie_id}
            onChange={(v) => {
              changer("salarie_id", v);
              recalculer(v, valeurs.heures);
            }}
            options={[{ valeur: "", libelle: "— Non renseigné —" }, ...(salaries.data ?? []).map((s) => ({ valeur: s.id, libelle: [s.prenom, s.nom].filter(Boolean).join(" ") }))]}
          />
          <ChampTexte
            libelle="Heures"
            inputMode="decimal"
            valeur={valeurs.heures}
            erreur={erreurs.heures}
            onChange={(v) => {
              changer("heures", v);
              recalculer(valeurs.salarie_id, v);
            }}
          />
          <p className="self-end text-xs text-muted-foreground sm:col-span-2" aria-live="polite">
            {salarie && salarie.cout_horaire_charge
              ? `${formatEuros(montant(salarie.cout_horaire_charge))}/h × ${valeurs.heures || 0} h = ${formatEuros(calcul ?? montant(0))}`
              : salarie
                ? "Coût horaire non disponible pour votre rôle : saisissez le montant."
                : ""}
          </p>
        </div>
      )}
      <ChampTexte libelle="Fournisseur (facultatif)" valeur={valeurs.fournisseur} onChange={(v) => changer("fournisseur", v)} />
      {ajouter.isError && <Alert variant="erreur">{messageErreur(ajouter.error)}</Alert>}
      <Button type="submit" size="sm" className="self-start" disabled={ajouter.isPending}>{ajouter.isPending ? "Ajout…" : "+ Ajouter"}</Button>
    </form>
  );
}
