import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { cn } from "@/lib/utils";
import { useReglements, useSoldes } from "../hooks/useFactures";
import { OngletsFacturation } from "./OngletsFacturation";
import { VueParClient } from "./VueParClient";
import { VueParFacture } from "./VueParFacture";
import { VueTousReglements } from "./VueTousReglements";

export type VueReglements = "clients" | "factures" | "tous";

const VUES: { vue: VueReglements; chemin: string; libelle: string }[] = [
  { vue: "clients", chemin: "/factures/reglements", libelle: "Par client" },
  { vue: "factures", chemin: "/factures/reglements/par-facture", libelle: "Par facture" },
  { vue: "tous", chemin: "/factures/reglements/tous", libelle: "Tous les règlements" },
];

/**
 * Règlements (FAC-30 à FAC-32, app.js l. 10593) : trois lectures des mêmes
 * soldes — par client (dossiers), par facture (qu'est-ce qui traîne ?), et
 * les encaissements eux-mêmes. Les soldes sont ceux de la base.
 */
export function PageReglements({ vue }: { vue: VueReglements }) {
  const soldes = useSoldes();
  const reglements = useReglements();
  let contenu: ReactNode;
  if (soldes.isPending || reglements.isPending) contenu = <Chargement />;
  else if (soldes.isError || reglements.isError) contenu = <Erreur erreur={soldes.error ?? reglements.error} reessayer={() => { void soldes.refetch(); void reglements.refetch(); }} />;
  else if (vue === "clients") contenu = <VueParClient soldes={soldes.data} />;
  else if (vue === "factures") contenu = <VueParFacture soldes={soldes.data} />;
  else contenu = <VueTousReglements soldes={soldes.data} reglements={reglements.data} />;

  return (
    <>
      <EnTetePage titre="Règlements" />
      <OngletsFacturation />
      <nav aria-label="Vue des règlements" className="mb-3 flex flex-wrap gap-1">
        {VUES.map((v) => (
          <NavLink key={v.vue} to={v.chemin} end className={({ isActive }) => cn("rounded-md border px-3 py-1 text-sm", isActive ? "border-primary text-primary" : "border-border text-muted-foreground")}>
            {v.libelle}
          </NavLink>
        ))}
      </nav>
      {contenu}
    </>
  );
}
