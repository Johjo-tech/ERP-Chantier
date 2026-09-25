import type { FormEvent } from "react";
import { Link } from "react-router";
import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { todayISO } from "@/lib/dates";
import { messageErreur } from "@/lib/erreurs";
import { useFormulaire } from "@/lib/useFormulaire";
import { useClients } from "@/modules/clients/hooks/useClients";
import { useReglages } from "@/modules/societes/hooks/useReglages";
import { designationVente, schemaSaisieVente, tauxProposes, tvaVenteParDefaut } from "../domain/vente";
import { libelleVehicule, type Vehicule } from "../domain/vehicule";
import { useVendreVehicule } from "../hooks/useVehicules";

/**
 * Vendre le véhicule (VEH-04) : acheteur choisi dans le répertoire, date,
 * prix HT, taux. La facture est émise aussitôt (numéro posé par la base) —
 * d'où le rappel, avant de confirmer, que ce geste ne se défait pas.
 */
export function FormulaireVente({ vehicule, onFermer }: { vehicule: Vehicule; onFermer: () => void }) {
  const clients = useClients();
  const reglages = useReglages();
  const vendre = useVendreVehicule(vehicule.id);
  const parDefaut = tvaVenteParDefaut(vehicule);
  const taux = tauxProposes(reglages.data?.tauxTva ?? [], parDefaut);
  const { valeurs, erreurs, changer, valider } = useFormulaire({ client_id: "", date: todayISO(), prix: "", tva: String(parDefaut) });

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const s = valider(schemaSaisieVente);
    if (s) vendre.mutate(s);
  }

  if (vendre.isSuccess) {
    const r = vendre.data;
    return (
      <Alert variant={r.numero ? "succes" : "erreur"}>
        {r.numero ? `Véhicule vendu, facture ${r.numero} émise. ` : "Véhicule marqué vendu, mais la facture n'a pas pu être émise : elle attend en brouillon. "}
        <Link to={`/factures/${r.factureId}`} className="font-medium underline">
          Ouvrir la facture
        </Link>
      </Alert>
    );
  }

  return (
    <form onSubmit={soumettre} noValidate aria-label="Vendre ce véhicule" className="flex flex-col gap-3 rounded-md border border-border p-3">
      <p className="text-sm">
        Vente de <strong>{libelleVehicule(vehicule)}</strong>. Ligne de facture : « {designationVente(vehicule)} ».
      </p>
      {vendre.isError && <Alert variant="erreur">{messageErreur(vendre.error)}</Alert>}
      {clients.isError && <Alert variant="erreur">{messageErreur(clients.error)}</Alert>}
      <div className="grid gap-3 sm:grid-cols-4">
        <ChampChoix
          libelle="Acheteur"
          requis
          valeur={valeurs.client_id}
          onChange={(v) => changer("client_id", v)}
          erreur={erreurs.client_id}
          aide={<Link to="/clients/nouveau" className="underline">Créer la fiche de l'acheteur</Link>}
          options={[{ valeur: "", libelle: clients.isPending ? "Chargement…" : "— Choisir un client —" }, ...(clients.data ?? []).map((c) => ({ valeur: c.id, libelle: c.nom }))]}
        />
        <ChampTexte libelle="Date de vente" type="date" valeur={valeurs.date} onChange={(v) => changer("date", v)} erreur={erreurs.date} />
        <ChampTexte libelle="Prix de vente HT (€)" requis inputMode="decimal" valeur={valeurs.prix} onChange={(v) => changer("prix", v)} erreur={erreurs.prix} />
        <ChampChoix libelle="TVA" valeur={valeurs.tva} onChange={(v) => changer("tva", v)} erreur={erreurs.tva} options={taux.map((t) => ({ valeur: String(t), libelle: `${String(t).replace(".", ",")} %` }))} />
      </div>
      <p className="text-xs text-muted-foreground">La facture sera émise et numérotée aussitôt : elle ne pourra plus être supprimée, seulement annulée par un avoir.</p>
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" disabled={vendre.isPending}>
          {vendre.isPending ? "Vente en cours…" : "Vendre et émettre la facture"}
        </Button>
        <Button type="button" variant="ghost" onClick={onFermer}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
