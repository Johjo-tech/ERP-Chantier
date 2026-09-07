/**
 * Traduction entre les objets de l'app historique (camelCase, lignes imbriquées)
 * et les colonnes du schéma relationnel. Ces tests ne touchent pas la base.
 */

import { describe, it, expect } from "vitest";
import { colonnesDe, valeursEnum } from "@/api/columns";
import {
  ligneVersDb,
  ligneVersLegacy,
  toCamel,
  toSnake,
} from "@/integrations/html-adapter";

describe("Noms de colonnes", () => {
  it("convertit le camelCase en snake_case", () => {
    expect(toSnake("codePostal")).toBe("code_postal");
    expect(toSnake("dateFinTravaux")).toBe("date_fin_travaux");
    expect(toSnake("adresse")).toBe("adresse");
  });

  it("traite les sigles que la conversion mécanique casserait", () => {
    // « numeroBC » donnerait `numero_b_c` sans table d'exceptions
    expect(toSnake("numeroBC")).toBe("numero_bc");
    expect(toSnake("sansBC")).toBe("sans_bc");
    expect(toSnake("enAttenteBC")).toBe("en_attente_bc");
  });

  it("revient au camelCase d'origine", () => {
    for (const cle of [
      "codePostal",
      "dateFinTravaux",
      "numeroBC",
      "sansBC",
      "enAttenteBC",
      "adresse",
    ]) {
      expect(toCamel(toSnake(cle))).toBe(cle);
    }
  });
});

describe("Lignes de document", () => {
  const legacy = {
    type: "ligne",
    designation: "Remplacement serrure",
    qte: 2,
    prixUnitaire: 120.5,
    tva: 10,
    unite: "u",
  };

  it("renomme les champs et pose la position", () => {
    expect(ligneVersDb(legacy, 3)).toEqual({
      type: "ligne",
      designation: "Remplacement serrure",
      commentaire: undefined,
      quantite: 2,
      unite: "u",
      prix_unitaire: 120.5,
      tva: 10,
      position: 3,
    });
  });

  it("fait l'aller-retour sans perte", () => {
    const { position, ...row } = ligneVersDb(legacy, 0);
    expect(ligneVersLegacy(row)).toEqual({ ...legacy, commentaire: undefined });
  });

  it("retombe sur le type « ligne » quand il manque", () => {
    expect(ligneVersDb({ designation: "Divers" }, 0).type).toBe("ligne");
  });
});

describe("Robustesse de la traduction vers la base", () => {
  it("connaît les colonnes réelles de chaque table", () => {
    const devis = colonnesDe("devis");
    expect(devis?.has("client_nom")).toBe(true);
    expect(devis?.has("legacy_id")).toBe(true);
    // Champ de l'app sans colonne : il doit être écarté, pas transmis
    expect(devis?.has("sous_traitant_emetteur")).toBe(false);
    expect(colonnesDe("table_inexistante")).toBeNull();
  });

  it("expose les valeurs admises des colonnes énumérées", () => {
    expect(valeursEnum("devis", "logement_statut")).toEqual([
      "occupé",
      "vacant",
      "commune",
    ]);
    // `interventions.metier` est bien plus restreint que les métiers de l'app
    expect(valeursEnum("interventions", "metier")).toEqual([
      "plomberie",
      "electricite",
      "etancheite",
    ]);
    expect(valeursEnum("devis", "adresse")).toBeNull();
  });
});
