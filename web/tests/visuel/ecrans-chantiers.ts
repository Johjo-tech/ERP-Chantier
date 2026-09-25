import type { Page } from "@playwright/test";
import { cliquer, onglet, partout, type Ecran } from "./ecrans";

/**
 * Chantiers, clients et catalogue : chaque écran et ses états, des deux côtés.
 *
 * Même sélecteur des deux côtés dès que le HTML repris porte les mêmes classes
 * (`cliquer`) ; l'ancien s'atteint par son onglet et ses gestes, le nouveau par
 * sa route. Les seuils sont des cliquets (README).
 */

type Geste = (page: Page) => Promise<void>;

/** Enchaîne des gestes : l'onglet de l'ancien, puis un clic. */
function puis(...gestes: Geste[]): Geste {
  return async (page) => {
    for (const g of gestes) await g(page);
  };
}

/** Saisit un texte dans le champ désigné — le même sélecteur des deux côtés. */
function saisir(selecteur: string, texte: string): Geste {
  return async (page) => {
    await page.fill(selecteur, texte, { timeout: 5_000 });
    // La recherche du catalogue attend que la main s'arrête (250 ms), des deux côtés.
    await page.waitForTimeout(600);
    // L'ancien redessinait la zone et perdait le focus ; le nouveau le garde (D-ECR-CHA-05) : on compare sans.
    await page.locator(selecteur).first().blur();
  };
}

export function ecransChantiersClientsCatalogue(): Ecran[] {
  return [
    // ── Catalogue ───────────────────────────────────────────────────────────
    {
      id: "catalogue",
      titre: "Catalogue › liste",
      compte: "admin",
      ancien: { chemin: "/", gestes: onglet("catalogue") },
      nouveau: { chemin: "/articles" },
      seuils: partout(0.001, 0),
    },
    {
      id: "catalogue-recherche-vide",
      titre: "Catalogue › recherche sans résultat",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("catalogue"), saisir("#catalogueZone input[type=text]", "zzzz")) },
      nouveau: { chemin: "/articles", gestes: saisir("#catalogueZone input[type=text]", "zzzz") },
      seuils: partout(0.001, 0),
    },
    {
      id: "catalogue-nouvel-article",
      titre: "Catalogue › nouvel article",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("catalogue"), cliquer(".page-head .btn.primary")) },
      nouveau: { chemin: "/articles", gestes: cliquer(".page-head .btn.primary") },
      seuils: partout(0.001, 0),
    },
    {
      id: "catalogue-modifier-article",
      titre: "Catalogue › modifier un article",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("catalogue"), cliquer("#catalogueZone td .btn.small")) },
      nouveau: { chemin: "/articles", gestes: cliquer("#catalogueZone td .btn.small") },
      seuils: partout(0.001, 0),
    },
    {
      id: "catalogue-import",
      titre: "Catalogue › importer un fichier",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("catalogue"), cliquer(".page-head .btn:not(.primary)")) },
      nouveau: { chemin: "/articles", gestes: cliquer(".page-head .btn:not(.primary)") },
      seuils: partout(0.001, 0),
    },
    {
      id: "catalogue-lecture",
      titre: "Catalogue › liste (lecture seule)",
      compte: "lecture",
      ancien: { chemin: "/", gestes: onglet("catalogue") },
      nouveau: { chemin: "/articles" },
      seuils: partout(0.001, 0),
    },
    // ── Clients ─────────────────────────────────────────────────────────────
    {
      id: "clients",
      titre: "Clients › liste",
      compte: "admin",
      ancien: { chemin: "/", gestes: onglet("clients") },
      nouveau: { chemin: "/clients" },
      seuils: partout(0.001, 0),
    },
    {
      id: "clients-recherche",
      titre: "Clients › recherche (« 1 sur 3 »)",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("clients"), saisir("#recherche-client", "opac")) },
      nouveau: { chemin: "/clients", gestes: saisir("#recherche-client", "opac") },
      seuils: partout(0.001, 0),
    },
    {
      id: "clients-recherche-vide",
      titre: "Clients › recherche sans résultat",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("clients"), saisir("#recherche-client", "zzzz")) },
      nouveau: { chemin: "/clients", gestes: saisir("#recherche-client", "zzzz") },
      seuils: partout(0.001, 0),
    },
    {
      id: "clients-nouveau",
      titre: "Clients › nouveau client",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("clients"), cliquer(".page-head .btn.primary")) },
      nouveau: { chemin: "/clients", gestes: cliquer(".page-head .btn.primary") },
      seuils: partout(0.001, 0),
    },
    {
      id: "clients-modifier",
      titre: "Clients › modifier un client",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("clients"), cliquer("#liste-client .btn.small.primary")) },
      nouveau: { chemin: "/clients", gestes: cliquer("#liste-client .btn.small.primary") },
      seuils: partout(0.001, 0),
    },
    {
      id: "clients-interlocuteur",
      titre: "Clients › nouvel interlocuteur (dans la carte)",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("clients"), cliquer("#liste-client .card .btn.small:not(.primary):not(.danger)")) },
      nouveau: { chemin: "/clients", gestes: cliquer("#liste-client .card .btn.small:not(.primary):not(.danger)") },
      seuils: partout(0.001, 0),
    },
    {
      id: "clients-import",
      titre: "Clients › importer un fichier",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("clients"), cliquer(".page-head .btn:not(.primary)")) },
      nouveau: { chemin: "/clients", gestes: cliquer(".page-head .btn:not(.primary)") },
      // La phrase d'aide ne promet plus l'annuaire, que l'import n'interroge pas (D-EFA-06) : 1 ligne remplacée.
      seuils: { bureau: { pixels: 0.005, texte: 2 }, mobile: { pixels: 0.052, texte: 2 } },
    },
    {
      id: "clients-lecture",
      titre: "Clients › liste (lecture seule)",
      compte: "lecture",
      ancien: { chemin: "/", gestes: onglet("clients") },
      nouveau: { chemin: "/clients" },
      // L'ancien montrait à la lecture des boutons que la base refuse ; ils sont masqués (D-ECR-CHA-06) : 10 lignes.
      seuils: { bureau: { pixels: 0.195, texte: 10 }, mobile: { pixels: 0.466, texte: 10 } },
    },
    {
      id: "plus-nouveau-client",
      titre: "Plus › Clients › nouveau client (téléphone)",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("plus", { plusTab: "clients" }), cliquer(".page-head .btn.primary")) },
      nouveau: { chemin: "/plus", gestes: cliquer(".page-head .btn.primary") },
      seuils: { mobile: { pixels: 0.001, texte: 0 } },
    },
    // ── Chantiers ───────────────────────────────────────────────────────────
    {
      id: "chantiers",
      titre: "Chantiers › liste",
      compte: "admin",
      ancien: { chemin: "/", gestes: onglet("chantiers") },
      nouveau: { chemin: "/chantiers" },
      seuils: { bureau: { pixels: 0.16, texte: 33 } },
      aFaire: "Écran de module : en cours de reprise.",
    },
  ];
}
