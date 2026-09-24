import { createBrowserRouter, type RouteObject } from "react-router";
import { PageConnexion } from "@/modules/auth-roles/components/PageConnexion";
import { RouteConnectee, RouteModule } from "@/modules/auth-roles/components/RouteProtegee";
import { PageClients } from "@/modules/clients/components/PageClients";
import { PageFicheClient } from "@/modules/clients/components/PageFicheClient";
import { PageFormulaireClient } from "@/modules/clients/components/PageFormulaireClient";
import { PageChantiers } from "@/modules/chantiers/components/PageChantiers";
import { PageFicheChantier } from "@/modules/chantiers/components/PageFicheChantier";
import { PageFormulaireChantier } from "@/modules/chantiers/components/PageFormulaireChantier";
import { PageDevis } from "@/modules/devis/components/PageDevis";
import { PageEditionDevis } from "@/modules/devis/components/PageEditionDevis";
import { Accueil } from "./Accueil";
import { Layout } from "./Layout";
import { PageIntrouvable } from "./PageIntrouvable";

export const routes: RouteObject[] = [
  { path: "/connexion", element: <PageConnexion /> },
  {
    path: "/",
    element: (
      <RouteConnectee>
        <Layout />
      </RouteConnectee>
    ),
    children: [
      { index: true, element: <Accueil /> },
      { path: "clients", element: <RouteModule module="clients"><PageClients /></RouteModule> },
      { path: "clients/nouveau", element: <RouteModule module="clients" action="creer"><PageFormulaireClient /></RouteModule> },
      { path: "clients/:id", element: <RouteModule module="clients"><PageFicheClient /></RouteModule> },
      { path: "clients/:id/modifier", element: <RouteModule module="clients" action="modifier"><PageFormulaireClient /></RouteModule> },
      { path: "chantiers", element: <RouteModule module="chantiers"><PageChantiers /></RouteModule> },
      { path: "chantiers/nouveau", element: <RouteModule module="chantiers" action="creer"><PageFormulaireChantier /></RouteModule> },
      { path: "chantiers/:id", element: <RouteModule module="chantiers"><PageFicheChantier /></RouteModule> },
      { path: "chantiers/:id/modifier", element: <RouteModule module="chantiers" action="modifier"><PageFormulaireChantier /></RouteModule> },
      { path: "devis", element: <RouteModule module="devis"><PageDevis /></RouteModule> },
      { path: "devis/nouveau", element: <RouteModule module="devis" action="creer"><PageEditionDevis /></RouteModule> },
      { path: "devis/:id", element: <RouteModule module="devis"><PageEditionDevis /></RouteModule> },
      { path: "*", element: <PageIntrouvable /> },
    ],
  },
];

export const routeur = createBrowserRouter(routes);
