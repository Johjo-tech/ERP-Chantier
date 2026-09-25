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
import { nomPersonne } from "@/modules/materiel/domain/prets";
import { usePersonnes } from "@/modules/materiel/hooks/useMateriel";
import { useReglagesSociete } from "@/modules/societes/hooks/useSocieteReglages";
import { alertesVehicule, etiquetteEcheance, trierAlertes } from "../domain/echeances";
import { chercherVehicules, compterVehicules, filtrerVehicules, formatKm, libelleType, libelleVehicule, type FiltreVehicules } from "../domain/vehicule";
import { useEcheancesDocuments, useVehicules } from "../hooks/useVehicules";
import { BlocEcheances } from "./BlocEcheances";

const FILTRES: readonly { cle: FiltreVehicules; libelle: string }[] = [
  { cle: "actifs", libelle: "En service" },
  { cle: "vendus", libelle: "Vendus" },
  { cle: "tous", libelle: "Tous" },
];

/** Le parc (VEH-01) : En service / Vendus / Tous, recherche après filtre, échéances selon les seuils des réglages. */
export function PageVehicules() {
  const vehicules = useVehicules();
  const personnes = usePersonnes();
  const reglages = useReglagesSociete();
  const documents = useEcheancesDocuments();
  const [filtre, setFiltre] = useState<FiltreVehicules>("actifs");
  const [recherche, setRecherche] = useState("");
  const tous = useMemo(() => vehicules.data ?? [], [vehicules.data]);
  const seuils = reglages.data?.seuils;
  const conducteur = useMemo(() => {
    const annuaire = new Map((personnes.data ?? []).map((p) => [p.id, nomPersonne(p)]));
    return (v: { conducteur_salarie_id: string | null }) => (v.conducteur_salarie_id ? (annuaire.get(v.conducteur_salarie_id) ?? null) : null);
  }, [personnes.data]);
  const liste = useMemo(() => chercherVehicules(filtrerVehicules(tous, filtre), recherche, conducteur), [tous, filtre, recherche, conducteur]);
  const alertes = useMemo(() => (seuils ? trierAlertes(tous.flatMap((v) => alertesVehicule(v, seuils, documents.data ?? []))) : []), [tous, seuils, documents.data]);
  const compte = compterVehicules(tous);

  return (
    <>
      <EnTetePage
        titre="Véhicules"
        actions={
          <Can module="vehicules" action="creer">
            <Button asChild>
              <Link to="/vehicules/nouveau">Nouveau véhicule</Link>
            </Button>
          </Can>
        }
      />
      <BlocEcheances alertes={alertes} />
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer les véhicules">
        {FILTRES.map((f) => (
          <Button key={f.cle} size="sm" variant={filtre === f.cle ? "default" : "outline"} aria-pressed={filtre === f.cle} onClick={() => setFiltre(f.cle)}>
            {f.libelle} ({compte[f.cle]})
          </Button>
        ))}
        <label htmlFor="recherche-vehicules" className="sr-only">Rechercher un véhicule</label>
        <Input id="recherche-vehicules" type="search" className="max-w-sm" placeholder="Rechercher : immatriculation, marque, modèle, conducteur…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      </div>
      {vehicules.isPending && <Chargement />}
      {vehicules.isError && <Erreur erreur={vehicules.error} reessayer={() => void vehicules.refetch()} />}
      {vehicules.isSuccess && liste.length === 0 && <Vide message={recherche ? "Aucun véhicule ne correspond à la recherche." : "Aucun véhicule dans cette catégorie."} />}
      {liste.length > 0 && (
        <Table>
          <THead>
            <Tr>
              <Th>Véhicule</Th>
              <Th>Immatriculation</Th>
              <Th>Type</Th>
              <Th>Motorisation</Th>
              <Th>Pneus</Th>
              <Th>Kilométrage</Th>
              <Th>Contrôle technique</Th>
              <Th>Conducteur</Th>
              <Th>Statut</Th>
            </Tr>
          </THead>
          <TBody>
            {liste.map((v) => {
              const ct = seuils ? etiquetteEcheance(v.date_controle_technique, seuils.vehiculeControle, v.vendu) : null;
              return (
                <Tr key={v.id}>
                  <Td>
                    <Link to={`/vehicules/${v.id}`} className="font-medium text-primary hover:underline">
                      {libelleVehicule(v)}
                    </Link>
                  </Td>
                  <Td className="tabular-nums">{v.immatriculation || "—"}</Td>
                  <Td>{libelleType(v.type_vehicule) || "—"}</Td>
                  <Td>{v.motorisation || "—"}</Td>
                  <Td>{v.taille_pneus || "—"}</Td>
                  <Td className="tabular-nums">{formatKm(v.kilometrage)}</Td>
                  <Td>
                    {v.date_controle_technique ? formatDateFr(v.date_controle_technique) : "—"}{" "}
                    {ct && <Badge variant={ct.niveau === "danger" ? "danger" : "alerte"}>{ct.texte}</Badge>}
                  </Td>
                  <Td>{conducteur(v) ?? "—"}</Td>
                  <Td>{v.vendu ? <Badge variant="neutre">Vendu</Badge> : <Badge variant="succes">En service</Badge>}</Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
    </>
  );
}
