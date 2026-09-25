import { createBrowserRouter, type RouteObject } from "react-router";
import { PageConnexion } from "@/modules/auth-roles/components/PageConnexion";
import { PageMonCompte } from "@/modules/auth-roles/components/PageMonCompte";
import { PageNouveauMotDePasse } from "@/modules/auth-roles/components/PageNouveauMotDePasse";
import { PageReglages } from "@/modules/reglages/components/PageReglages";
import { Can } from "@/modules/auth-roles/components/Can";
import { RouteConnectee, RouteModule } from "@/modules/auth-roles/components/RouteProtegee";
import { PageClients } from "@/modules/clients/components/PageClients";
import { PageFicheClient } from "@/modules/clients/components/PageFicheClient";
import { PageFormulaireClient } from "@/modules/clients/components/PageFormulaireClient";
import { PageChantiers } from "@/modules/chantiers/components/PageChantiers";
import { PageFicheChantier } from "@/modules/chantiers/components/PageFicheChantier";
import { PageFormulaireChantier } from "@/modules/chantiers/components/PageFormulaireChantier";
import { lienDevisComplementaire } from "@/modules/chantiers/domain/liens";
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
import { PageDossierClient } from "@/modules/facturation/components/PageDossierClient";
import { PageFilesBons } from "@/modules/facturation/components/PageFilesBons";
import { PageReglements } from "@/modules/facturation/components/PageReglements";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";
import { PageBonCommande } from "@/modules/commandes/components/PageBonCommande";
import { PageBonsCommande } from "@/modules/commandes/components/PageBonsCommande";
import { PagePieces } from "@/modules/commandes/components/PagePieces";
import { PageCreerSav } from "@/modules/commandes/components/PageCreerSav";
import { PageApercuBon } from "@/modules/commandes/components/PageApercuBon";
import { PagePrefacture } from "@/modules/commandes/components/PagePrefacture";
import { PageAFacturer, PageValidation } from "@/modules/commandes/components/PagesFacturationBons";
import { PageArticles } from "@/modules/articles/components/PageArticles";
import { PageFormulaireArticle } from "@/modules/articles/components/PageFormulaireArticle";
import { PageImportArticles } from "@/modules/articles/components/PageImportArticles";
import { PageImportClients } from "@/modules/import-export/components/PageImportClients";
import { PageImportExport } from "@/modules/import-export/components/PageImportExport";
import { PageImportFactures } from "@/modules/import-export/components/PageImportFactures";
import { ReferenceArticleLigne } from "@/modules/articles/components/ReferenceArticleLigne";
import { LayoutEspaceClient } from "@/modules/espace-client/components/LayoutEspaceClient";
import { PageDocumentClient } from "@/modules/espace-client/components/PageDocumentClient";
import { PageEspaceClient } from "@/modules/espace-client/components/PageEspaceClient";
import { PageBonsClient } from "@/modules/espace-client/components/PageBonsClient";
import { PageLectureBon } from "@/modules/ocr/components/PageLectureBon";
import { PagePlanning } from "@/modules/planning/components/PagePlanning";
import { PageApercuRapport } from "@/modules/interventions/components/PageApercuRapport";
import { PageRapport } from "@/modules/interventions/components/PageRapport";
import { PageRapports } from "@/modules/interventions/components/PageRapports";
import { PageStatistiques } from "@/modules/statistiques/components/PageStatistiques";
import { PageFicheMateriel } from "@/modules/materiel/components/PageFicheMateriel";
import { PageFormulaireMateriel } from "@/modules/materiel/components/PageFormulaireMateriel";
import { PageMateriel } from "@/modules/materiel/components/PageMateriel";
import { PageFicheVehicule } from "@/modules/vehicules/components/PageFicheVehicule";
import { PageFormulaireVehicule } from "@/modules/vehicules/components/PageFormulaireVehicule";
import { PageVehicules } from "@/modules/vehicules/components/PageVehicules";
import { PageFicheSalarie } from "@/modules/rh/components/PageFicheSalarie";
import { PageRegistre } from "@/modules/rh/components/PageRegistre";
import { PageRh } from "@/modules/rh/components/PageRh";
import { Accueil } from "./Accueil";
import { Layout } from "./Layout";
import { PageIntrouvable } from "./PageIntrouvable";

export const routes: RouteObject[] = [
  { path: "/connexion", element: <PageConnexion /> },
  { path: "/nouveau-mot-de-passe", element: <PageNouveauMotDePasse /> },
  {
    path: "/espace-client",
    element: (
      <RouteConnectee>
        <LayoutEspaceClient />
      </RouteConnectee>
    ),
    children: [
      { index: true, element: <PageEspaceClient /> },
      { path: "bons", element: <PageBonsClient /> },
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
      { path: "clients/import", element: <RouteModule module="clients" action="creer"><PageImportClients /></RouteModule> },
      { path: "clients/nouveau", element: <RouteModule module="clients" action="creer"><PageFormulaireClient /></RouteModule> },
      { path: "clients/:id", element: <RouteModule module="clients"><PageFicheClient complements={(c) => <DevisLies clientId={c.id} />} /></RouteModule> },
      { path: "clients/:id/modifier", element: <RouteModule module="clients" action="modifier"><PageFormulaireClient /></RouteModule> },
      { path: "chantiers", element: <RouteModule module="chantiers"><PageChantiers /></RouteModule> },
      { path: "chantiers/nouveau", element: <RouteModule module="chantiers" action="creer"><PageFormulaireChantier /></RouteModule> },
      { path: "chantiers/:id", element: <RouteModule module="chantiers">
            <PageFicheChantier
              complements={(c) => <DevisLies chantierId={c.id} lienNouveau={lienDevisComplementaire(c)} />}
              actionsDpgf={(c) => (
                <Can module="factures" action="creer">
                  <Button asChild size="sm" variant="secondary"><Link to={`/chantiers/${c.id}/situation`}>Facturer l'avancement</Link></Button>
                </Can>
              )}
              actionsSelection={(c, lignes) => (
                <Can module="factures" action="creer">
                  {lignes.length ? (
                    <Button asChild size="sm"><Link to={`/chantiers/${c.id}/situation?lignes=${lignes.join(",")}`}>Facturer la sélection ({lignes.length})</Link></Button>
                  ) : (
                    <Button size="sm" disabled title="Cochez d'abord au moins une ligne à facturer">Facturer la sélection</Button>
                  )}
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
      { path: "factures/avoirs", element: <RouteModule module="factures"><PageFactures vue="avoirs" /></RouteModule> },
      { path: "factures/validation", element: <RouteModule module="bons_commande"><PageFilesBons file="validation" /></RouteModule> },
      { path: "factures/a-facturer", element: <RouteModule module="bons_commande"><PageFilesBons file="aFacturer" /></RouteModule> },
      { path: "factures/reglements", element: <RouteModule module="reglements"><PageReglements vue="clients" /></RouteModule> },
      { path: "factures/reglements/par-facture", element: <RouteModule module="reglements"><PageReglements vue="factures" /></RouteModule> },
      { path: "factures/reglements/tous", element: <RouteModule module="reglements"><PageReglements vue="tous" /></RouteModule> },
      { path: "factures/reglements/dossier", element: <RouteModule module="reglements"><PageDossierClient /></RouteModule> },
      { path: "factures/import", element: <RouteModule module="factures" action="creer"><PageImportFactures /></RouteModule> },
      { path: "factures/nouvelle", element: <RouteModule module="factures" action="creer"><PageFacture ChampReference={ReferenceArticleLigne} /></RouteModule> },
      { path: "factures/:id", element: <RouteModule module="factures"><PageFacture ChampReference={ReferenceArticleLigne} /></RouteModule> },
      { path: "factures/:id/apercu", element: <RouteModule module="factures"><PageApercuFacture /></RouteModule> },
      { path: "commandes", element: <RouteModule module="bons_commande"><PageBonsCommande /></RouteModule> },
      { path: "commandes/nouveau", element: <RouteModule module="bons_commande" action="creer"><PageBonCommande ChampReference={ReferenceArticleLigne} /></RouteModule> },
      { path: "commandes/:id", element: <RouteModule module="bons_commande"><PageBonCommande ChampReference={ReferenceArticleLigne} /></RouteModule> },
      { path: "commandes/:id/prefacture", element: <RouteModule module="bons_commande"><PagePrefacture /></RouteModule> },
      { path: "commandes/:id/sav", element: <RouteModule module="bons_commande" action="creer"><PageCreerSav /></RouteModule> },
      { path: "commandes/:id/apercu", element: <RouteModule module="bons_commande"><PageApercuBon /></RouteModule> },
      { path: "facturation/validation", element: <RouteModule module="bons_commande"><PageValidation /></RouteModule> },
      { path: "facturation/a-facturer", element: <RouteModule module="bons_commande"><PageAFacturer /></RouteModule> },
      { path: "pieces", element: <RouteModule module="bons_commande"><PagePieces /></RouteModule> },
      { path: "articles", element: <RouteModule module="articles"><PageArticles /></RouteModule> },
      // Toute écriture au catalogue suit le droit « modifier », comme l'ancien écran (ART-06).
      { path: "articles/nouveau", element: <RouteModule module="articles" action="modifier"><PageFormulaireArticle /></RouteModule> },
      { path: "articles/:id/modifier", element: <RouteModule module="articles" action="modifier"><PageFormulaireArticle /></RouteModule> },
      { path: "articles/import", element: <RouteModule module="articles" action="modifier"><PageImportArticles /></RouteModule> },
      { path: "commandes/lecture", element: <RouteModule module="bons_commande" action="creer"><PageLectureBon /></RouteModule> },
      { path: "import-export", element: <RouteModule module="reglages"><PageImportExport /></RouteModule> },
      { path: "reglages", element: <RouteModule module="reglages"><PageReglages /></RouteModule> },
      { path: "reglages/:rubrique", element: <RouteModule module="reglages"><PageReglages /></RouteModule> },
      // Mon compte : ouvert à tous les rôles, le nom appartient à la personne (AUTH-17).
      { path: "mon-compte", element: <PageMonCompte /> },
      { path: "planning", element: <RouteModule module="planning"><PagePlanning /></RouteModule> },
      { path: "planning/ma-journee", element: <RouteModule module="planning"><PagePlanning vue="ma_journee" /></RouteModule> },
      { path: "rapports", element: <RouteModule module="rapports"><PageRapports /></RouteModule> },
      { path: "rapports/nouveau", element: <RouteModule module="rapports" action="creer"><PageRapport /></RouteModule> },
      { path: "rapports/:id", element: <RouteModule module="rapports" action="modifier"><PageRapport /></RouteModule> },
      { path: "rapports/:id/apercu", element: <RouteModule module="rapports"><PageApercuRapport /></RouteModule> },
      { path: "statistiques", element: <RouteModule module="statistiques"><PageStatistiques /></RouteModule> },
      { path: "vehicules", element: <RouteModule module="vehicules"><PageVehicules /></RouteModule> },
      { path: "vehicules/nouveau", element: <RouteModule module="vehicules" action="creer"><PageFormulaireVehicule /></RouteModule> },
      { path: "vehicules/:id", element: <RouteModule module="vehicules"><PageFicheVehicule /></RouteModule> },
      { path: "vehicules/:id/modifier", element: <RouteModule module="vehicules" action="modifier"><PageFormulaireVehicule /></RouteModule> },
      { path: "materiel", element: <RouteModule module="materiel"><PageMateriel /></RouteModule> },
      { path: "materiel/nouveau", element: <RouteModule module="materiel" action="creer"><PageFormulaireMateriel /></RouteModule> },
      { path: "materiel/:id", element: <RouteModule module="materiel"><PageFicheMateriel /></RouteModule> },
      { path: "materiel/:id/modifier", element: <RouteModule module="materiel" action="modifier"><PageFormulaireMateriel /></RouteModule> },
      { path: "rh", element: <RouteModule module="rh"><PageRh /></RouteModule> },
      { path: "rh/registre", element: <RouteModule module="rh" action="modifier"><PageRegistre /></RouteModule> },
      { path: "rh/salaries/nouveau", element: <RouteModule module="rh" action="creer"><PageFicheSalarie /></RouteModule> },
      { path: "rh/salaries/:id", element: <RouteModule module="rh" action="modifier"><PageFicheSalarie /></RouteModule> },
      { path: "*", element: <PageIntrouvable /> },
    ],
  },
];

export const routeur = createBrowserRouter(routes);
