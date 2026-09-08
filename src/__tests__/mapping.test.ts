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

describe("Tri antéchronologique des documents", () => {
  /** Reprise de `trierParDate()` de l'application, à l'identique. */
  function trierParDate<T extends Record<string, unknown>>(liste: T[], champs: string[]): T[] {
    const cle = (d: T) => {
      for (const c of champs) if (d[c]) return String(d[c]);
      return "";
    };
    return [...liste].sort((a, b) => {
      const diff = cle(b).localeCompare(cle(a));
      if (diff !== 0) return diff;
      return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
    });
  }

  it("met le plus récent en premier", () => {
    const tri = trierParDate(
      [{ id: "a", date: "2026-01-10" }, { id: "b", date: "2026-03-02" }, { id: "c", date: "2026-02-01" }],
      ["date"]
    );
    expect(tri.map((d) => d.id)).toEqual(["b", "c", "a"]);
  });

  it("retombe sur le champ suivant quand le premier est vide", () => {
    // Un bon de commande n'a pas de `date` : c'est sa réception qui compte
    const tri = trierParDate(
      [
        { id: "ancien", dateReception: "2026-01-05" },
        { id: "recent", dateReception: "2026-06-20" },
      ],
      ["dateReception", "datePlanifiee", "date"]
    );
    expect(tri.map((d) => d.id)).toEqual(["recent", "ancien"]);
  });

  it("départage les ex æquo par date de création", () => {
    const tri = trierParDate(
      [
        { id: "premier", date: "2026-05-01", createdAt: "2026-05-01T08:00:00Z" },
        { id: "second", date: "2026-05-01", createdAt: "2026-05-01T17:00:00Z" },
      ],
      ["date"]
    );
    expect(tri.map((d) => d.id)).toEqual(["second", "premier"]);
  });

  it("relègue les documents sans date en fin de liste", () => {
    const tri = trierParDate(
      [{ id: "sansDate" }, { id: "date", date: "2026-01-01" }],
      ["date"]
    );
    expect(tri.map((d) => d.id)).toEqual(["date", "sansDate"]);
  });
});
