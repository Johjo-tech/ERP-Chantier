import { ChampChoix, ChampTexte } from "@/components/formulaire/Champ";
import { useChantiers } from "@/modules/chantiers/hooks/useChantiers";
import { useClients, useInterlocuteurs } from "@/modules/clients/hooks/useClients";
import { optionsConducteurs, useConducteurs } from "@/modules/societes/hooks/useConducteurs";
import type { ReactNode } from "react";

type ChampEntete = "client_id" | "interlocuteur" | "date" | "chantier_id" | "conducteur_id";

interface Props {
  /** Date et chantier sont facultatifs : un bon de commande n'a pas de colonne chantier, et sa date est celle de réception. */
  valeurs: Record<"client_id" | "interlocuteur" | "conducteur_id", string> & Partial<Record<"date" | "chantier_id", string>>;
  erreurs: Record<string, string>;
  changer: (champ: ChampEntete, v: string) => void;
  conducteurCourant: string | null;
  lectureSeule: boolean;
  /** Champs propres au document (statut d'un devis, échéance d'une facture…). */
  enPlus?: ReactNode;
}

function Interlocuteurs({ clientId, valeur, changer, lectureSeule }: { clientId: string; valeur: string; changer: (v: string) => void; lectureSeule: boolean }) {
  const liste = useInterlocuteurs(clientId);
  const noms = (liste.data ?? []).map((i) => i.nom);
  // L'interlocuteur est un texte : un nom ancien absent de l'annuaire reste affiché.
  const options = valeur && !noms.includes(valeur) ? [...noms, valeur] : noms;
  return (
    <ChampChoix libelle="Interlocuteur" valeur={valeur} onChange={changer} desactive={lectureSeule} options={[{ valeur: "", libelle: "—" }, ...options.map((n) => ({ valeur: n, libelle: n }))]} />
  );
}

/** Client, interlocuteur, date, chantier, conducteur : l'en-tête commun aux documents. */
export function ChampsEnteteDocument({ valeurs, erreurs, changer, conducteurCourant, lectureSeule, enPlus }: Props) {
  const clients = useClients();
  const chantiers = useChantiers();
  const conducteurs = useConducteurs();
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <ChampChoix
        libelle="Client"
        requis
        valeur={valeurs.client_id}
        erreur={erreurs.client_id}
        desactive={lectureSeule}
        onChange={(v) => {
          changer("client_id", v);
          changer("interlocuteur", "");
        }}
        options={[{ valeur: "", libelle: clients.isPending ? "Chargement…" : "— Choisir —" }, ...(clients.data ?? []).map((c) => ({ valeur: c.id, libelle: c.nom }))]}
      />
      {valeurs.client_id ? (
        <Interlocuteurs clientId={valeurs.client_id} valeur={valeurs.interlocuteur} changer={(v) => changer("interlocuteur", v)} lectureSeule={lectureSeule} />
      ) : (
        <div />
      )}
      {valeurs.date !== undefined && (
        <ChampTexte libelle="Date" type="date" valeur={valeurs.date} erreur={erreurs.date} onChange={(v) => changer("date", v)} desactive={lectureSeule} />
      )}
      {valeurs.chantier_id !== undefined && (
        <ChampChoix
          libelle="Chantier"
          valeur={valeurs.chantier_id}
          desactive={lectureSeule}
          onChange={(v) => changer("chantier_id", v)}
          options={[{ valeur: "", libelle: "— Aucun —" }, ...(chantiers.data ?? []).map((c) => ({ valeur: c.id, libelle: c.nom }))]}
        />
      )}
      <ChampChoix
        libelle="Conducteur de travaux"
        valeur={valeurs.conducteur_id}
        desactive={lectureSeule}
        onChange={(v) => changer("conducteur_id", v)}
        options={[{ valeur: "", libelle: "— Aucun —" }, ...optionsConducteurs(conducteurs.data ?? [], conducteurCourant)]}
      />
      {enPlus}
    </div>
  );
}
