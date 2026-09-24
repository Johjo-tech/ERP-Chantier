import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { correspond } from "@/lib/recherche";
import { Can } from "@/modules/auth-roles/components/Can";
import { libelleCadre } from "../domain/client";
import { useClients } from "../hooks/useClients";

export function PageClients() {
  const clients = useClients();
  const [recherche, setRecherche] = useState("");

  const filtres = useMemo(
    () =>
      (clients.data ?? []).filter((c) =>
        // Comme l'ancien écran : la recherche porte aussi sur les interlocuteurs.
        correspond(recherche, c.nom, c.ville, c.code_postal, c.email, c.telephone, c.siret, ...c.interlocuteurs.map((i) => i.nom))
      ),
    [clients.data, recherche]
  );

  return (
    <>
      <EnTetePage
        titre="Clients"
        sousTitre={clients.data ? `${clients.data.length} client(s)` : undefined}
        actions={
          <Can module="clients" action="creer">
            <Button asChild>
              <Link to="/clients/nouveau">Nouveau client</Link>
            </Button>
          </Can>
        }
      />
      <div className="mb-3 max-w-sm">
        <label htmlFor="recherche-clients" className="sr-only">
          Rechercher un client
        </label>
        <Input
          id="recherche-clients"
          type="search"
          placeholder="Rechercher (nom, ville, interlocuteur…)"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      </div>
      {clients.isPending && <Chargement />}
      {clients.isError && <Erreur erreur={clients.error} reessayer={() => void clients.refetch()} />}
      {clients.isSuccess && filtres.length === 0 && (
        <Vide message={recherche ? "Aucun client ne correspond à la recherche." : "Aucun client pour l'instant."} />
      )}
      {filtres.length > 0 && (
        <Table>
          <THead>
            <Tr>
              <Th>Nom</Th>
              <Th>Type</Th>
              <Th>Ville</Th>
              <Th>Contact</Th>
            </Tr>
          </THead>
          <TBody>
            {filtres.map((c) => (
              <Tr key={c.id}>
                <Td>
                  <Link to={`/clients/${c.id}`} className="font-medium text-primary hover:underline">
                    {c.nom}
                  </Link>
                </Td>
                <Td>{libelleCadre(c.cadre_facturation)}</Td>
                <Td>{[c.code_postal, c.ville].filter(Boolean).join(" ") || "—"}</Td>
                <Td>{c.telephone || c.email || "—"}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
