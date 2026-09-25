import type { ReactNode } from "react";
import { useParams } from "react-router";
import { Onglets } from "@/components/ui/onglets";
import { RouteModule } from "@/modules/auth-roles/components/RouteProtegee";
import type { ModuleId } from "@/modules/auth-roles/domain/permissions";
import { PageClients } from "@/modules/clients/components/PageClients";
import { PageBonsCommande } from "@/modules/commandes/components/PageBonsCommande";
import { PagePlanning } from "@/modules/planning/components/PagePlanning";
import { PageReglages } from "@/modules/reglages/components/PageReglages";

/**
 * « Plus », dernier bouton de la barre du bas sur téléphone (`renderPlus`,
 * app.js l. 1351) : quatre sous-onglets pour ce que la barre ne peut pas
 * porter — Clients, Bons de commande, Planning, Réglages —, Clients d'abord.
 */
const ONGLETS: readonly { cle: string; libelle: string; module: ModuleId; page: ReactNode }[] = [
  { cle: "clients", libelle: "Clients", module: "clients", page: <PageClients /> },
  { cle: "commandes", libelle: "Bons de commande", module: "bons_commande", page: <PageBonsCommande /> },
  { cle: "planning", libelle: "Planning", module: "planning", page: <PagePlanning /> },
  { cle: "reglages", libelle: "Réglages", module: "reglages", page: <PageReglages /> },
];

export function PagePlus() {
  const { onglet } = useParams();
  const courant = ONGLETS.find((o) => o.cle === onglet) ?? ONGLETS[0];
  if (!courant) return null;
  return (
    <>
      <Onglets
        libelle="Plus"
        centre={false}
        onglets={ONGLETS.map((o) => ({ chemin: o.cle === "clients" ? "/plus" : `/plus/${o.cle}`, libelle: o.libelle, actif: o === courant }))}
      />
      <RouteModule module={courant.module}>{courant.page}</RouteModule>
    </>
  );
}
