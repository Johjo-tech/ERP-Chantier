import type { FormEvent } from "react";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Modale, PiedModale } from "@/components/ui/modale";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import { useFormulaire } from "@/lib/useFormulaire";
import { useClients } from "@/modules/clients/hooks/useClients";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import { schemaSaisieVente, tauxProposes, tvaVenteParDefaut } from "../domain/vente";
import { libelleVehicule, type Vehicule } from "../domain/vehicule";
import { useVendreVehicule } from "../hooks/useVehicules";

/**
 * La fenêtre `#vendreVehiculeModal` de l'ancien écran (index.html l. 1889) :
 * acheteur, date, prix HT, « Confirmer la vente ». Écarts décidés (D-VEH-06) :
 * l'acheteur est une fiche du répertoire et le taux se choisit ; la phrase du
 * bas dit la vérité — la facture est émise aussitôt, l'ancienne la disait
 * « modifiable ensuite » alors qu'il l'émettait déjà.
 */
export function FormulaireVente({ vehicule, onFermer }: { vehicule: Vehicule; onFermer: () => void }) {
  const clients = useClients();
  const reglages = useReglages();
  const vendre = useVendreVehicule(vehicule.id);
  const parDefaut = tvaVenteParDefaut(vehicule);
  const taux = tauxProposes(reglages.data?.tauxTva ?? [], parDefaut);
  const { valeurs, changer } = useFormulaire({ client_id: "", date: todayISO(), prix: "", tva: String(parDefaut) });

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const r = schemaSaisieVente.safeParse(valeurs);
    if (!r.success) {
      afficherToast(r.error.issues[0]?.message ?? messageErreur(r.error));
      return;
    }
    vendre.mutate(r.data, {
      onSuccess: (res) => {
        onFermer();
        if (res.numero) afficherToast("Véhicule marqué comme vendu, facture créée.", "success");
        else afficherToast("Véhicule marqué vendu, mais la facture n'a pas pu être émise : elle attend en brouillon dans Factures.");
      },
      onError: (err) => afficherToast(messageErreur(err)),
    });
  }

  return (
    <Modale titre="Vendre ce véhicule" onFermer={onFermer} largeurMax="460px">
      <form onSubmit={soumettre} noValidate>
        <p className="card-sub">{libelleVehicule(vehicule)}</p>
        <ChampChoix
          libelle="Acheteur"
          valeur={valeurs.client_id}
          onChange={(v) => changer("client_id", v)}
          options={[{ valeur: "", libelle: clients.isPending ? "Chargement…" : "— Choisir un client —" }, ...(clients.data ?? []).map((c) => ({ valeur: c.id, libelle: c.nom }))]}
        />
        <div className="field-grid">
          <ChampTexte libelle="Date de vente" type="date" valeur={valeurs.date} onChange={(v) => changer("date", v)} />
          <ChampTexte libelle="Prix de vente (HT)" inputMode="decimal" placeholder="Ex : 8500" valeur={valeurs.prix} onChange={(v) => changer("prix", v)} />
          <ChampChoix libelle="TVA" valeur={valeurs.tva} onChange={(v) => changer("tva", v)} options={taux.map((t) => ({ valeur: String(t), libelle: `${String(t).replace(".", ",")} %` }))} />
        </div>
        <p className="card-sub">La facture sera émise et numérotée aussitôt : elle ne pourra plus être supprimée, seulement annulée par un avoir.</p>
        <PiedModale>
          <button type="submit" className="btn danger" disabled={vendre.isPending}>
            Confirmer la vente
          </button>
          <button type="button" className="btn ghost" onClick={onFermer}>
            Annuler
          </button>
        </PiedModale>
      </form>
    </Modale>
  );
}
