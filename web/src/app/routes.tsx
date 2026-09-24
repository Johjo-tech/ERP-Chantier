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
import { PageApercuDevis } from "@/modules/devis/components/PageApercuDevis";
import { ActionsDevis } from "@/modules/devis/components/ActionsDevis";
import { DevisLies } from "@/modules/devis/components/DevisLies";
import { PageArticles } from "@/modules/articles/components/PageArticles";
import { PageFormulaireArticle } from "@/modules/articles/components/PageFormulaireArticle";
import { PageImportArticles } from "@/modules/articles/components/PageImportArticles";
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
      { path: "clients/:id", element: <RouteModule module="clients"><PageFicheClient complements={(c) => <DevisLies clientId={c.id} />} /></RouteModule> },
      { path: "clients/:id/modifier", element: <RouteModule module="clients" action="modifier"><PageFormulaireClient /></RouteModule> },
      { path: "chantiers", element: <RouteModule module="chantiers"><PageChantiers /></RouteModule> },
      { path: "chantiers/nouveau", element: <RouteModule module="chantiers" action="creer"><PageFormulaireChantier /></RouteModule> },
      { path: "chantiers/:id", element: <RouteModule module="chantiers"><PageFicheChantier complements={(c) => <DevisLies chantierId={c.id} />} /></RouteModule> },
      { path: "chantiers/:id/modifier", element: <RouteModule module="chantiers" action="modifier"><PageFormulaireChantier /></RouteModule> },
      { path: "devis", element: <RouteModule module="devis"><PageDevis /></RouteModule> },
      { path: "devis/nouveau", element: <RouteModule module="devis" action="creer"><PageEditionDevis /></RouteModule> },
      { path: "devis/:id", element: <RouteModule module="devis"><PageEditionDevis actions={(d) => <ActionsDevis devis={d} />} /></RouteModule> },
      { path: "devis/:id/apercu", element: <RouteModule module="devis"><PageApercuDevis /></RouteModule> },
      { path: "articles", element: <RouteModule module="articles"><PageArticles /></RouteModule> },
      // Toute écriture au catalogue suit le droit « modifier », comme l'ancien écran (ART-06).
      { path: "articles/nouveau", element: <RouteModule module="articles" action="modifier"><PageFormulaireArticle /></RouteModule> },
      { path: "articles/:id/modifier", element: <RouteModule module="articles" action="modifier"><PageFormulaireArticle /></RouteModule> },
      { path: "articles/import", element: <RouteModule module="articles" action="modifier"><PageImportArticles /></RouteModule> },
      { path: "*", element: <PageIntrouvable /> },
    ],
  },
];

export const routeur = createBrowserRouter(routes);
