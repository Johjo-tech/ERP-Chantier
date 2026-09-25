import type { Page } from "@playwright/test";
import type { Ecran, Seuils, Taille } from "./ecrans";

/**
 * Les écrans de Facturation et de Devis (vague « écrans identiques »,
 * décisions D-ECR-FAC-xx) : chaque liste, ses sous-onglets et leurs états,
 * aux deux tailles. Dans leur propre fichier pour que la table commune ne
 * change que d'une ligne.
 *
 * Les seuils sont des CLIQUETS (README) : l'écart constaté arrondi au-dessus.
 * Ce qui reste d'écart est DÉCIDÉ et cité au commentaire de l'entrée.
 */
type Geste = (page: Page) => Promise<void>;

/** L'onglet de l'ancienne application, avec l'état qu'il lit — même geste que `onglet` d'ecrans.ts. */
function onglet(id: string, etat: Record<string, unknown> = {}): Geste {
  return async (page) => {
    await page.evaluate(
      ([o, e]) => {
        const w = window as unknown as { state: Record<string, unknown>; setTab: (t: string) => void; renderTab: () => void };
        Object.assign(w.state, e);
        if (w.state.tab === o) w.renderTab();
        else w.setTab(o);
      },
      [id, etat] as const
    );
  };
}

function cliquer(...selecteurs: string[]): Geste {
  return async (page) => {
    for (const s of selecteurs) await page.click(s, { timeout: 5_000 });
  };
}

function enchainer(...gestes: Geste[]): Geste {
  return async (page) => {
    for (const g of gestes) await g(page);
  };
}

/** Choisir une option par son libellé, dans la liste déroulante qui la porte — la même des deux côtés. */
function choisir(libelle: string): Geste {
  return async (page) => {
    await page.locator(`select:has(option:text-is("${libelle}"))`).first().selectOption({ label: libelle }, { timeout: 5_000 });
    await page.waitForTimeout(600);
  };
}

function taper(selecteur: string, texte: string): Geste {
  return async (page) => {
    await page.fill(selecteur, texte, { timeout: 5_000 });
    await page.waitForTimeout(800);
  };
}

const seuils = (bureau: Seuils, mobile: Seuils): Partial<Record<Taille, Seuils>> => ({ bureau, mobile });

/**
 * L'écart DÉCIDÉ sur les listes de factures (D-ECR-FAC-02, suite de D-FAC-01) :
 * le reste d'une facture qui porte des acomptes se lit dans la base, acomptes
 * déduits (« reste 50,00 € » là où l'ancien disait « reste 450,00 € »).
 */
const ACOMPTES = 2;

/**
 * « ✕ Effacer » paraît dès qu'un filtre est posé (D-ECR-FAC-07) ; l'ancien ne
 * redessinait que la liste, et le bouton n'apparaissait qu'au rendu suivant.
 */
const EFFACER = 1;

/**
 * Les deux moitiés d'une imputation d'avoir naissent dans la même transaction,
 * au même instant : l'ancien les rendait dans l'ordre physique de la table,
 * la nouvelle par identifiant (D-ECR-FAC-06). Deux cartes permutées.
 */
const MEME_INSTANT = 0.005;

export function ecransFacturation(): Ecran[] {
  const factures = (id: string, titre: string, etat: Record<string, unknown>, route: string, s: Partial<Record<Taille, Seuils>>, gestes?: Geste): Ecran => ({
    id,
    titre,
    compte: "admin",
    ancien: { chemin: "/", gestes: gestes ? enchainer(onglet("factures", etat), gestes) : onglet("factures", etat) },
    nouveau: gestes ? { chemin: route, gestes } : { chemin: route },
    seuils: s,
  });
  return [
    factures("factures", "Factures › liste", { facturesView: "liste" }, "/factures", seuils({ pixels: 0.002, texte: ACOMPTES }, { pixels: 0.002, texte: ACOMPTES })),
    factures("factures-avoirs", "Factures › Avoirs", { facturesView: "avoirs" }, "/factures/avoirs", seuils({ pixels: 0.002, texte: 0 }, { pixels: 0.002, texte: 0 })),
    factures("factures-validation", "Factures › Validation", { facturesView: "validation" }, "/facturation/validation", seuils({ pixels: 0.001, texte: 0 }, { pixels: 0.001, texte: 0 })),
    factures("factures-a-facturer", "Factures › À facturer", { facturesView: "afacturer" }, "/facturation/a-facturer", seuils({ pixels: 0.001, texte: 0 }, { pixels: 0.001, texte: 0 })),
    factures("factures-reglements", "Factures › Règlements › Par client", { facturesView: "reglements", reglementsVue: "clients", reglementsClient: null }, "/factures/reglements", seuils({ pixels: 0.002, texte: ACOMPTES }, { pixels: 0.002, texte: ACOMPTES })),
    factures("factures-reglements-par-facture", "Factures › Règlements › Par facture", { facturesView: "reglements", reglementsVue: "factures", reglementsClient: null }, "/factures/reglements/par-facture", seuils({ pixels: 0.002, texte: 2 * ACOMPTES }, { pixels: 0.002, texte: 2 * ACOMPTES })),
    factures("factures-reglements-tous", "Factures › Règlements › Tous les règlements", { facturesView: "reglements", reglementsVue: "tous", reglementsClient: null }, "/factures/reglements/tous", seuils({ pixels: MEME_INSTANT, texte: 0 }, { pixels: 0.002, texte: 0 })),
    factures("factures-reglements-dossier", "Factures › Règlements › dossier d'un client", { facturesView: "reglements", reglementsClient: "OPAC du Rhône" }, "/factures/reglements/dossier?client=OPAC%20du%20Rh%C3%B4ne", seuils({ pixels: 0.002, texte: 0 }, { pixels: 0.002, texte: 0 })),
    factures("factures-impayees", "Factures › liste filtrée (🔴 Impayées)", { facturesView: "liste" }, "/factures", seuils({ pixels: 0.002, texte: EFFACER }, { pixels: 0.002, texte: EFFACER }), choisir("🔴 Impayées")),
    {
      id: "devis",
      titre: "Devis",
      compte: "admin",
      ancien: { chemin: "/", gestes: onglet("devis") },
      nouveau: { chemin: "/devis" },
      seuils: seuils({ pixels: 0.001, texte: 0 }, { pixels: 0.001, texte: 0 }),
    },
    {
      id: "devis-envoyes",
      titre: "Devis › filtrés (Envoyé)",
      compte: "admin",
      ancien: { chemin: "/", gestes: onglet("devis", { devisStatutFilter: "envoyé" }) },
      nouveau: { chemin: "/devis?statut=envoy%C3%A9" },
      seuils: seuils({ pixels: 0.001, texte: 0 }, { pixels: 0.001, texte: 0 }),
    },
  ];
}

export { choisir, cliquer, taper };
