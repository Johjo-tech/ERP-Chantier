import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { z } from "zod";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { BarreRecherche } from "@/components/ui/barre-recherche";
import { correspond } from "@/lib/recherche";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import type { ClientListe } from "../api/clients";
import { useClients } from "../hooks/useClients";
import { CarteClient } from "./CarteClient";
import { FormulaireClientEnPlace } from "./FormulaireClient";
import type { InterlocuteurEdite } from "./FormulaireInterlocuteur";

/** Ce que la recherche lit d'un client : sa fiche ET ses interlocuteurs, qui s'affichent dans sa carte. */
function cherchable(c: ClientListe): (string | null)[] {
  return [
    c.nom, c.telephone, c.email, c.adresse, c.code_postal, c.ville, c.siret, c.siren, c.tva_intracom, c.contact_nom, c.notes,
    ...c.interlocuteurs.flatMap((i) => [i.nom, i.fonction, i.telephone, i.email]),
  ];
}

interface Props {
  /**
   * Le formulaire ouvert à l'arrivée : `null` pour un nouveau client, un
   * identifiant pour le modifier (routes `/clients/nouveau` et
   * `/clients/:id/modifier`). L'ancien l'ouvrait AU-DESSUS de la liste, sans
   * quitter l'écran — y compris sous « Plus » sur téléphone.
   */
  formulaire?: string | null;
}

/** L'écran Clients de l'ancien (`renderClients`) : en-tête, recherche, formulaire en place, cartes. */
export function PageClients({ formulaire }: Props) {
  const clients = useClients();
  const navigate = useNavigate();
  const peutCreer = usePermission("clients", "creer");
  // Un import CRÉE et MET À JOUR : il faut les deux droits (CLI-08).
  const peutModifier = usePermission("clients", "modifier");
  const peutImporter = peutCreer && peutModifier;
  // `/clients/:id` arrive ici avec le nom du client à chercher : sa carte, seule (D-ECR-CHA-13). Validé : l'état vient de l'historique.
  const arrivee = z.object({ recherche: z.string() }).safeParse(useLocation().state);
  const [recherche, setRecherche] = useState(arrivee.success ? arrivee.data.recherche : "");
  const [edition, setEdition] = useState<{ id: string | null } | null>(formulaire === undefined ? null : { id: formulaire });
  const [interlocuteur, setInterlocuteur] = useState<{ clientId: string; edite: InterlocuteurEdite | null } | null>(null);

  const toutes = clients.data ?? [];
  const filtres = useMemo(() => (clients.data ?? []).filter((c) => correspond(recherche, ...cherchable(c))), [clients.data, recherche]);

  function ouvrir(id: string | null) {
    setInterlocuteur(null);
    setEdition({ id });
  }
  function fermer() {
    setEdition(null);
    // Arrivé par l'adresse d'un formulaire : on revient à celle de la liste, sans empiler l'historique.
    if (formulaire !== undefined) void navigate("/clients", { replace: true });
  }

  return (
    <>
      <div className="page-head">
        <h1>Clients</h1>
        <div style={{ display: "flex", gap: "8px" }}>
          {!edition && peutImporter && (
            <Link className="btn" to="/clients/import">
              📥 Importer un fichier
            </Link>
          )}
          {!edition && peutCreer && (
            <button type="button" className="btn primary" onClick={() => ouvrir(null)}>
              + Nouveau client
            </button>
          )}
        </div>
      </div>
      <BarreRecherche
        id="recherche-client"
        libelle="Rechercher un client"
        placeholder="Rechercher : nom, interlocuteur, ville, SIRET, e-mail…"
        valeur={recherche}
        onChange={setRecherche}
        affiches={filtres.length}
        total={toutes.length}
      />
      <div id="formZoneClient">{edition && <FormulaireClientEnPlace key={edition.id ?? "nouveau"} id={edition.id} onFermer={fermer} />}</div>
      <div id="liste-client">
        {clients.isPending && <Chargement />}
        {clients.isError && <Erreur erreur={clients.error} reessayer={() => void clients.refetch()} />}
        {clients.isSuccess && filtres.length === 0 && (
          <div className="empty">{recherche.trim() ? "Aucun client ne correspond à la recherche." : "Aucun client enregistré pour cette société."}</div>
        )}
        {filtres.map((c) => (
          <CarteClient
            key={c.id}
            client={c}
            interlocuteur={interlocuteur?.clientId === c.id ? interlocuteur.edite : undefined}
            onModifier={() => ouvrir(c.id)}
            onInterlocuteur={(i) => {
              setEdition(null);
              setInterlocuteur(i === undefined ? null : { clientId: c.id, edite: i });
            }}
          />
        ))}
      </div>
    </>
  );
}
