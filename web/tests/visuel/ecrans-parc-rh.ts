import type { Page } from "@playwright/test";
import type { Ecran, Seuils, Taille } from "./ecrans";

/**
 * Les écrans du périmètre « parc, RH, statistiques, réglages, espace client »
 * au-delà des listes du menu : fiches, formulaires, sous-onglets. À part pour
 * que `ecrans.ts`, partagé, ne bouge que d'une ligne.
 *
 * Les données viennent de `jeux/parc-rh.sql` (identifiants fixes `e5…`) :
 * à appliquer avant la passe.
 */

type Geste = (page: Page) => Promise<void>;
export interface Aides {
  onglet: (id: string, etat?: Record<string, unknown>) => Geste;
  cliquer: (...selecteurs: string[]) => Geste;
  partout: (pixels: number, texte: number) => Partial<Record<Taille, Seuils>>;
}

export const JEU = {
  vehicule: "e5000000-0000-0000-0000-000000000011",
  vehiculeVendu: "e5000000-0000-0000-0000-000000000012",
  materiel: "e5000000-0000-0000-0000-000000000021",
  salarie: "e5000000-0000-0000-0000-000000000001",
} as const;

/** Une fonction de l'ancien écran, appelée comme le ferait son `onclick`. */
function appeler(nom: string, ...args: unknown[]): Geste {
  return async (page) => {
    await page.evaluate(
      ([n, a]) => {
        const f = (window as unknown as Record<string, (...x: unknown[]) => unknown>)[n as string];
        if (typeof f !== "function") throw new Error(`Fonction absente de l'ancien écran : ${String(n)}`);
        return f(...(a as unknown[]));
      },
      [nom, args] as const
    );
  };
}

/** Deux gestes à la suite, sur la même page. */
function puis(...gestes: Geste[]): Geste {
  return async (page) => {
    for (const g of gestes) await g(page);
  };
}

/**
 * Les rubriques des Réglages, une par une. Chacune compte l'écart décidé du
 * rail : le groupe « Accès » (7 lignes, D-ECR-PAR-08).
 */
const RUBRIQUES_REGLAGES = ["identite", "legaux", "documents", "numerotation", "listes", "intervenants", "rh", "vehicules", "conduite", "notifications", "moncompte"] as const;
const ECART_RAIL_ACCES = 7;
/** Sur téléphone, le rail est une liste déroulante : les deux options de l'accès. */
const ECART_RAIL_ACCES_TELEPHONE = 2;

/** Les rubriques qui gardent un écart décidé de plus que le rail. */
const SEUILS_REGLAGES: Partial<Record<(typeof RUBRIQUES_REGLAGES)[number], Partial<Record<Taille, Seuils>>>> = {
  // La date d'émission de l'ancienne ligne d'ajout n'a pas de colonne (D-SOC-14) : la ligne se recompose.
  legaux: { bureau: { pixels: 0.01, texte: ECART_RAIL_ACCES }, mobile: { pixels: 0.07, texte: ECART_RAIL_ACCES_TELEPHONE } },
  // « Délai compté » et « Mode de règlement par défaut », exposés en plus (D-SOC-11) : 9 lignes avec leurs options.
  documents: { bureau: { pixels: 0.04, texte: ECART_RAIL_ACCES + 9 }, mobile: { pixels: 0.001, texte: ECART_RAIL_ACCES_TELEPHONE + 9 } },
  // Un conducteur se retire au lieu de se supprimer (D-ECR-PAR-12) : « Retirer » pour « Supprimer ».
  intervenants: { bureau: { pixels: 0.002, texte: ECART_RAIL_ACCES + 2 }, mobile: { pixels: 0.002, texte: ECART_RAIL_ACCES_TELEPHONE + 2 } },
};

function ecransReglages({ onglet }: Aides): Ecran[] {
  return RUBRIQUES_REGLAGES.map((r) => ({
    id: `reglages-${r}`,
    titre: `Réglages › ${r}`,
    compte: "admin" as const,
    ancien: { chemin: "/", gestes: onglet("parametres", { reglagesTab: r }) },
    nouveau: { chemin: `/reglages/${r}` },
    seuils: SEUILS_REGLAGES[r] ?? { bureau: { pixels: 0.01, texte: ECART_RAIL_ACCES }, mobile: { pixels: 0.001, texte: ECART_RAIL_ACCES_TELEPHONE } },
  }));
}

export function ecransParcRh(aides: Aides): Ecran[] {
  const { onglet, cliquer, partout } = aides;
  return [
    ...ecransReglages(aides),
    {
      id: "vehicule-fiche",
      titre: "Véhicules › fiche",
      compte: "admin",
      ancien: { chemin: "/", gestes: onglet("vehicules", { viewingVehicule: JEU.vehicule }) },
      nouveau: { chemin: `/vehicules/${JEU.vehicule}` },
      // « Supprimer » (D-VEH-07) et « Autre document… » (D-VEH-03) : deux ajouts décidés.
      seuils: partout(0.008, 2),
    },
    {
      id: "vehicule-fiche-vendu",
      titre: "Véhicules › fiche d'un véhicule vendu",
      compte: "admin",
      ancien: { chemin: "/", gestes: onglet("vehicules", { viewingVehicule: JEU.vehiculeVendu }) },
      nouveau: { chemin: `/vehicules/${JEU.vehiculeVendu}` },
      seuils: partout(0.008, 2),
    },
    {
      id: "vehicule-nouveau",
      titre: "Véhicules › nouveau véhicule",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("vehicules"), cliquer(".page-head .btn.primary")) },
      nouveau: { chemin: "/vehicules", gestes: cliquer(".page-head .btn.primary") },
      // La validité de la carte carburant est une date (D-VEH-05) : son libellé change.
      seuils: partout(0.006, 2),
    },
    {
      id: "materiel-fiche",
      titre: "Matériel › fiche",
      compte: "admin",
      ancien: { chemin: "/", gestes: onglet("materiel", { viewingMateriel: JEU.materiel }) },
      nouveau: { chemin: `/materiel/${JEU.materiel}` },
      seuils: partout(0.004, 0),
    },
    {
      id: "materiel-nouveau",
      titre: "Matériel › nouveau matériel",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("materiel"), cliquer(".page-head .btn.primary")) },
      nouveau: { chemin: "/materiel", gestes: cliquer(".page-head .btn.primary") },
      seuils: partout(0.001, 0),
    },
    {
      id: "rh-documents",
      titre: "RH › Documents",
      compte: "admin",
      ancien: { chemin: "/", gestes: onglet("rh", { rhView: "documents" }) },
      nouveau: { chemin: "/rh?vue=documents" },
      seuils: partout(0.001, 0),
    },
    {
      id: "rh-visites",
      titre: "RH › Visites médicales",
      compte: "admin",
      ancien: { chemin: "/", gestes: onglet("rh", { rhView: "visites" }) },
      nouveau: { chemin: "/rh?vue=visites" },
      seuils: partout(0.001, 0),
    },
    {
      id: "rh-equipes",
      titre: "RH › Équipes",
      compte: "admin",
      ancien: { chemin: "/", gestes: onglet("rh", { rhView: "equipes" }) },
      nouveau: { chemin: "/rh?vue=equipes" },
      seuils: partout(0.001, 0),
    },
    {
      id: "rh-registre",
      titre: "RH › Registre unique du personnel",
      compte: "admin",
      ancien: { chemin: "/", gestes: onglet("rh", { rhView: "salaries", viewingRegistre: true }) },
      nouveau: { chemin: "/rh/registre" },
      seuils: partout(0.002, 0),
    },
    {
      id: "rh-nouveau",
      titre: "RH › nouveau salarié",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("rh", { rhView: "salaries" }), cliquer(".page-head .btn.primary")) },
      nouveau: { chemin: "/rh", gestes: cliquer(".page-head .btn.primary") },
      seuils: partout(0.001, 0),
    },
    {
      id: "rh-fiche",
      titre: "RH › fiche d'un salarié",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("rh", { rhView: "salaries" }), appeler("editItem", "salarie", JEU.salarie)) },
      nouveau: { chemin: `/rh/salaries/${JEU.salarie}` },
      seuils: partout(0.001, 0),
    },
    {
      id: "rh-dossier-ouvert",
      titre: "RH › Documents, dossier d'un salarié ouvert",
      compte: "admin",
      ancien: { chemin: "/", gestes: onglet("rh", { rhView: "documents", rhDocSalarieId: JEU.salarie }) },
      nouveau: { chemin: `/rh?vue=documents&salarie=${JEU.salarie}` },
      seuils: partout(0.001, 0),
    },
    {
      id: "rh-visites-ouvert",
      titre: "RH › Visites médicales, registre d'un salarié ouvert",
      compte: "admin",
      ancien: { chemin: "/", gestes: onglet("rh", { rhView: "visites", rhVisiteSalarieId: JEU.salarie }) },
      nouveau: { chemin: "/rh?vue=visites", gestes: cliquer("tbody tr:nth-child(2) td:last-child .btn") },
      // Téléphone : le clic du geste fait défiler le tableau pour atteindre « Ouvrir »,
      // l'ancien l'ouvre sans clic (état posé) — même rendu, tableau décalé (D-ECR-PAR-07).
      seuils: { bureau: { pixels: 0.001, texte: 0 }, mobile: { pixels: 0.013, texte: 0 } },
    },
    {
      id: "rh-equipe-nouvelle",
      titre: "RH › Équipes, nouvelle équipe",
      compte: "admin",
      ancien: { chemin: "/", gestes: puis(onglet("rh", { rhView: "equipes" }), cliquer(".page-head .btn.primary")) },
      nouveau: { chemin: "/rh?vue=equipes", gestes: cliquer(".page-head .btn.primary") },
      seuils: partout(0.001, 0),
    },
  ];
}
