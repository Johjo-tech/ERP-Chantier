import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDateFr } from "@/lib/dates";
import { Can } from "@/modules/auth-roles/components/Can";
import { filtrerMateriels } from "../domain/materiel";
import { nomEmprunteur, pretEnCours, retourPrevu } from "../domain/prets";
import { useMateriels, usePersonnes } from "../hooks/useMateriel";

/** L'inventaire du matériel (VEH-05) : recherche nom / catégorie, statut Disponible / En prêt. */
export function PageMateriel() {
  const materiels = useMateriels();
  const personnes = usePersonnes();
  const [recherche, setRecherche] = useState("");
  const liste = useMemo(() => filtrerMateriels(materiels.data ?? [], recherche), [materiels.data, recherche]);
  const annuaire = personnes.data ?? [];

  return (
    <>
      <EnTetePage
        titre="Matériel"
        sousTitre={materiels.data ? `${materiels.data.length} élément(s)` : undefined}
        actions={
          <Can module="materiel" action="creer">
            <Button asChild>
              <Link to="/materiel/nouveau">Nouveau matériel</Link>
            </Button>
          </Can>
        }
      />
      <div className="mb-3 max-w-sm">
        <label htmlFor="recherche-materiel" className="sr-only">
          Rechercher du matériel
        </label>
        <Input id="recherche-materiel" type="search" placeholder="Rechercher : nom, catégorie…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      </div>
      {materiels.isPending && <Chargement />}
      {materiels.isError && <Erreur erreur={materiels.error} reessayer={() => void materiels.refetch()} />}
      {materiels.isSuccess && liste.length === 0 && <Vide message={recherche ? "Aucun matériel ne correspond à la recherche." : "Aucun matériel pour l'instant."} />}
      {liste.length > 0 && (
        <Table>
          <THead>
            <Tr>
              <Th>Matériel</Th>
              <Th>Catégorie</Th>
              <Th>État</Th>
              <Th>Statut</Th>
              <Th>Emprunteur</Th>
              <Th>Depuis / jusqu'au</Th>
            </Tr>
          </THead>
          <TBody>
            {liste.map((m) => {
              const pret = pretEnCours(m.prets);
              const prevu = pret ? retourPrevu(pret) : null;
              return (
                <Tr key={m.id}>
                  <Td>
                    <Link to={`/materiel/${m.id}`} className="font-medium text-primary hover:underline">
                      {m.nom}
                    </Link>
                  </Td>
                  <Td>{m.categorie || "—"}</Td>
                  <Td>{m.etat_general || "—"}</Td>
                  <Td>{pret ? <Badge variant="alerte">En prêt</Badge> : <Badge variant="succes">Disponible</Badge>}</Td>
                  <Td>{pret ? nomEmprunteur(pret, annuaire) : "—"}</Td>
                  <Td className="text-xs text-muted-foreground">
                    {pret ? `Depuis le ${formatDateFr(pret.date_debut)}${prevu ? ` · retour prévu ${formatDateFr(prevu)}` : ""}` : "—"}
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
    </>
  );
}
