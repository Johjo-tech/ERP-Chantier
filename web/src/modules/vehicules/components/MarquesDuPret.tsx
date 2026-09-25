import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Marque } from "../domain/schema-vehicule";
import { SchemaVehicule } from "./SchemaVehicule";

type Vue = "depart" | "retour" | null;

/** Revoir l'état relevé au départ et les nouvelles marques du retour d'un prêt passé. */
export function MarquesDuPret({ depart, retour }: { depart: Marque[]; retour: Marque[] }) {
  const [vue, setVue] = useState<Vue>(null);
  if (!depart.length && !retour.length) return null;
  const basculer = (v: Vue) => setVue((c) => (c === v ? null : v));
  return (
    <div className="mt-1 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {depart.length > 0 && (
          <Button size="sm" variant="ghost" aria-expanded={vue === "depart"} onClick={() => basculer("depart")}>
            État au départ ({depart.length})
          </Button>
        )}
        {retour.length > 0 && (
          <Button size="sm" variant="outline" className="text-destructive" aria-expanded={vue === "retour"} onClick={() => basculer("retour")}>
            ⚠ {retour.length} nouvelle(s) marque(s) au retour
          </Button>
        )}
      </div>
      {vue === "depart" && <SchemaVehicule titre="État constaté au départ" marques={depart} />}
      {vue === "retour" && <SchemaVehicule titre="Nouvelles marques constatées au retour" marques={retour} />}
    </div>
  );
}
