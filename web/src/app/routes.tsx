import { createBrowserRouter, type RouteObject } from "react-router";
import { PageConnexion } from "@/modules/auth-roles/components/PageConnexion";
import { Can } from "@/modules/auth-roles/components/Can";
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
import { BoutonFacturerDevis } from "@/modules/facturation/components/BoutonFacturerDevis";
import { PageApercuFacture } from "@/modules/facturation/components/PageApercuFacture";
import { PageFacture } from "@/modules/facturation/components/PageFacture";
import { PageFactures } from "@/modules/facturation/components/PageFactures";
import { PageSituation } from "@/modules/facturation/components/PageSituation";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";
import { PageBonCommande } from "@/modules/commandes/components/PageBonCommande";
import { PageBonsCommande } from "@/modules/commandes/components/PageBonsCommande";
import { PagePieces } from "@/modules/commandes/components/PagePieces";
import { PageArticles } from "@/modules/articles/components/PageArticles";
import { PageFormulaireArticle } from "@/modules/articles/components/PageFormulaireArticle";
import { PageImportArticles } from "@/modules/articles/components/PageImportArticles";
import { ReferenceArticleLigne } from "@/modules/articles/components/ReferenceArticleLigne";
import { LayoutEspaceClient } from "@/modules/espace-client/components/LayoutEspaceClient";
import { PageDocumentClient } from "@/modules/espace-client/components/PageDocumentClient";
import { PageEspaceClient } from "@/modules/espace-client/components/PageEspaceClient";
import { PageLectureBon } from "@/modules/ocr/components/PageLectureBon";
import { PagePlanning } from "@/modules/planning/components/PagePlanning";
import { PageApercuRapport } from "@/modules/interventions/components/PageApercuRapport";
import { PageRapport } from "@/modules/interventions/components/PageRapport";
import { PageRapports } from "@/modules/interventions/components/PageRapports";
import { Accueil } from "./Accueil";
import { Layout } from "./Layout";
import { PageIntrouvable } from "./PageIntrouvable";

export const routes: RouteObject[] = [
  { path: "/connexion", element: <PageConnexion /> },
  {
    path: "/espace-client",
    element: (
      <RouteConnectee>
        <LayoutEspaceClient />
      </RouteConnectee>
    ),
    children: [
      { index: true, element: <PageEspaceClient /> },
      { path: "devis/:id", element: <PageDocumentClient nature="devis" /> },
      { path: "factures/:id", element: <PageDocumentClient nature="facture" /> },
    ],
  },
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
      { path: "chantiers/:id", element: <RouteModule module="chantiers">
            <PageFicheChantier
              complements={(c) => <DevisLies chantierId={c.id} />}
              actionsDpgf={(c) => (
                <Can module="factures" action="creer">
                  <Button asChild size="sm" variant="secondary"><Link to={`/chantiers/${c.id}/situation`}>Facturer l'avancement</Link></Button>
                </Can>
              )}
            />
          </RouteModule> },
      { path: "chantiers/:id/modifier", element: <RouteModule module="chantiers" action="modifier"><PageFormulaireChantier /></RouteModule> },
      { path: "devis", element: <RouteModule module="devis"><PageDevis /></RouteModule> },
      { path: "devis/nouveau", element: <RouteModule module="devis" action="creer"><PageEditionDevis ChampReference={ReferenceArticleLigne} /></RouteModule> },
      { path: "devis/:id", element: <RouteModule module="devis"><PageEditionDevis ChampReference={ReferenceArticleLigne} actions={(d) => (<><BoutonFacturerDevis devisId={d.id} /><ActionsDevis devis={d} /></>)} /></RouteModule> },
      { path: "devis/:id/apercu", element: <RouteModule module="devis"><PageApercuDevis /></RouteModule> },
      { path: "chantiers/:id/situation", element: <RouteModule module="factures" action="creer"><PageSituation /></RouteModule> },
      { path: "factures", element: <RouteModule module="factures"><PageFactures /></RouteModule> },
      { path: "factures/nouvelle", element: <RouteModule module="factures" action="creer"><PageFacture ChampReference={ReferenceArticleLigne} /></RouteModule> },
      { path: "factures/:id", element: <RouteModule module="factures"><PageFacture ChampReference={ReferenceArticleLigne} /></RouteModule> },
      { path: "factures/:id/apercu", element: <RouteModule module="factures"><PageApercuFacture /></RouteModule> },
      { path: "commandes", element: <RouteModule module="bons_commande"><PageBonsCommande /></RouteModule> },
      { path: "commandes/nouveau", element: <RouteModule module="bons_commande" action="creer"><PageBonCommande ChampReference={ReferenceArticleLigne} /></RouteModule> },
      { path: "commandes/:id", element: <RouteModule module="bons_commande"><PageBonCommande ChampReference={ReferenceArticleLigne} /></RouteModule> },
      { path: "pieces", element: <RouteModule module="bons_commande"><PagePieces /></RouteModule> },
      { path: "articles", element: <RouteModule module="articles"><PageArticles /></RouteModule> },
      // Toute écriture au catalogue suit le droit « modifier », comme l'ancien écran (ART-06).
      { path: "articles/nouveau", element: <RouteModule module="articles" action="modifier"><PageFormulaireArticle /></RouteModule> },
      { path: "articles/:id/modifier", element: <RouteModule module="articles" action="modifier"><PageFormulaireArticle /></RouteModule> },
      { path: "articles/import", element: <RouteModule module="articles" action="modifier"><PageImportArticles /></RouteModule> },
      { path: "commandes/lecture", element: <RouteModule module="bons_commande" action="creer"><PageLectureBon /></RouteModule> },
      { path: "planning", element: <RouteModule module="planning"><PagePlanning /></RouteModule> },
      { path: "planning/ma-journee", element: <RouteModule module="planning"><PagePlanning vue="ma_journee" /></RouteModule> },
      { path: "rapports", element: <RouteModule module="rapports"><PageRapports /></RouteModule> },
      { path: "rapports/nouveau", element: <RouteModule module="rapports" action="creer"><PageRapport /></RouteModule> },
      { path: "rapports/:id", element: <RouteModule module="rapports" action="modifier"><PageRapport /></RouteModule> },
      { path: "rapports/:id/apercu", element: <RouteModule module="rapports"><PageApercuRapport /></RouteModule> },
      { path: "*", element: <PageIntrouvable /> },
    ],
  },
];

export const routeur = createBrowserRouter(routes);
