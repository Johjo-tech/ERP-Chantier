import { Link, useSearchParams } from "react-router";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Button } from "@/components/ui/button";
import { useDroitsRh, useEquipes } from "../hooks/useRh";
import { ListeSalaries } from "./ListeSalaries";
import { OngletDocuments } from "./OngletDocuments";
import { OngletEquipes } from "./OngletEquipes";
import { OngletSousTraitants } from "./OngletSousTraitants";
import { OngletVisites } from "./OngletVisites";

type Vue = "salaries" | "documents" | "visites" | "equipes" | "sous-traitants";

/**
 * L'onglet RH (RH-01 à RH-11, PAR-06) : salariés, dossiers, visites, équipes,
 * sous-traitants. Dossiers et visites n'existent que pour qui tient les
 * dossiers (`rh / modifier`) : leurs tables le refusent aux autres, et un
 * onglet de pastilles rouges bâti sur un refus mentirait.
 */
export function PageRh() {
  const [params, setParams] = useSearchParams();
  const droits = useDroitsRh();
  const equipes = useEquipes();
  const onglets: { vue: Vue; libelle: string; visible: boolean }[] = [
    { vue: "salaries", libelle: "Salariés", visible: true },
    { vue: "documents", libelle: "Documents", visible: droits.sensible },
    { vue: "visites", libelle: "Visites médicales", visible: droits.sensible },
    { vue: "equipes", libelle: `Équipes${equipes.data?.length ? ` (${equipes.data.length})` : ""}`, visible: true },
    { vue: "sous-traitants", libelle: "Sous-traitants", visible: true },
  ];
  const demandee = params.get("vue") as Vue | null;
  const vue: Vue = onglets.some((o) => o.visible && o.vue === demandee) && demandee ? demandee : "salaries";

  return (
    <div>
      <EnTetePage
        titre="RH"
        actions={
          <>
            {droits.sensible && (
              <Button asChild variant="outline">
                <Link to="/rh/registre">📋 Registre unique du personnel</Link>
              </Button>
            )}
            {droits.creer && (
              <Button asChild>
                <Link to="/rh/salaries/nouveau">+ Nouveau salarié</Link>
              </Button>
            )}
          </>
        }
      />
      <nav aria-label="Rubriques RH" className="mb-4 flex flex-wrap gap-2">
        {onglets
          .filter((o) => o.visible)
          .map((o) => (
            <Button key={o.vue} size="sm" variant={o.vue === vue ? "default" : "outline"} aria-current={o.vue === vue ? "page" : undefined} onClick={() => setParams({ vue: o.vue })}>
              {o.libelle}
            </Button>
          ))}
      </nav>
      {vue === "salaries" && <ListeSalaries />}
      {vue === "documents" && <OngletDocuments salarieOuvert={params.get("salarie")} />}
      {vue === "visites" && <OngletVisites />}
      {vue === "equipes" && <OngletEquipes />}
      {vue === "sous-traitants" && <OngletSousTraitants />}
    </div>
  );
}
