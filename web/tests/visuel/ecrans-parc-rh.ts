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

/** Deux gestes à la suite, sur la même page. */
function puis(...gestes: Geste[]): Geste {
  return async (page) => {
    for (const g of gestes) await g(page);
  };
}

export function ecransParcRh({ onglet, cliquer, partout }: Aides): Ecran[] {
  return [
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
  ];
}
