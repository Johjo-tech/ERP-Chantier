/**
 * Traduction entre les objets de l'app historique (camelCase, lignes imbriquées)
 * et les colonnes du schéma relationnel. Ces tests ne touchent pas la base.
 */

import { describe, it, expect } from "vitest";
import { colonnesDe, valeursEnum } from "@/api/columns";
import {
  CHAMPS_SOCIETE,
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
      article_reference: null,
      position: 3,
    });
  });

  /* La colonne existait sur les trois tables de lignes et l'écran cherchait
     déjà un code — mais le pont ne la transmettait pas : aucune des 922 lignes
     de production n'en portait. Choisir un article restait sans effet. */
  it("transmet la référence de l'article choisi au catalogue", () => {
    const avecArticle = { ...legacy, articleReference: "PLB-001" };
    expect(ligneVersDb(avecArticle, 0).article_reference).toBe("PLB-001");
    expect(ligneVersLegacy(ligneVersDb(avecArticle, 0)).articleReference).toBe("PLB-001");
  });

  /* Une ligne libre n'invente pas de référence : `null`, pas la chaîne vide —
     l'unicité du code ne doit pas se heurter à des lignes « sans article ». */
  it("laisse la référence nulle quand la ligne n'en porte pas", () => {
    expect(ligneVersDb({ designation: "Divers" }, 0).article_reference).toBeNull();
  });

  it("fait l'aller-retour sans perte", () => {
    const { position, ...row } = ligneVersDb(legacy, 0);
    expect(ligneVersLegacy(row)).toEqual({ ...legacy, commentaire: undefined });
  });

  it("retombe sur le type « ligne » quand il manque", () => {
    expect(ligneVersDb({ designation: "Divers" }, 0).type).toBe("ligne");
  });

  /* Un chapitre lu par OCR arrive sans quantité ni prix. Laisser ces champs
     indéfinis les faisait écrire `NULL` — supabase-js déclare `columns=` sur
     l'union des clés, donc le défaut à 0 de la colonne ne s'applique pas — et
     les trois colonnes sont `NOT NULL` : l'insertion de *toutes* les lignes du
     bon était rejetée, en-tête déjà créé et lignes précédentes déjà effacées. */
  it("écrit zéro, jamais nul, quand la ligne n'a ni quantité ni prix", () => {
    const chapitre = ligneVersDb({ type: "chapitre", designation: "Plomberie" }, 0);
    expect(chapitre.quantite).toBe(0);
    expect(chapitre.prix_unitaire).toBe(0);
    expect(chapitre.tva).toBe(0);
  });

  /* L'app historique écrit `""` pour « non renseigné ». */
  it("ramène une chaîne vide à zéro", () => {
    const vide = ligneVersDb(
      { designation: "Divers", qte: "" as unknown as number, tva: "" as unknown as number },
      0
    );
    expect(vide.quantite).toBe(0);
    expect(vide.tva).toBe(0);
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

  /* Le générateur découpait `database.types.ts` sur la première occurrence de
     « Tables: { » — celle de `graphql_public`, qui est vide. Il écrivait donc
     une carte sans aucune table, et `colonnesDe()` aurait écarté chaque champ
     de chaque insertion sans un mot. Il s'arrête maintenant, mais la carte
     étant un fichier commité, ce cas doit se voir ici aussi. */
  it("porte toutes les tables, jamais une carte vide", () => {
    for (const table of ["devis", "factures", "bons_commande", "articles", "clients"]) {
      expect(colonnesDe(table)?.size ?? 0).toBeGreaterThan(5);
    }
  });

  /* La carte avait dérivé du schéma : ces colonnes-là existaient en base et
     manquaient ici. L'écran les écrivait, `versDb` les jetait, et personne ne
     voyait rien — ni erreur, ni donnée. */
  it("suit le schéma quand il s'enrichit", () => {
    const bons = colonnesDe("bons_commande");
    expect(bons?.has("facturation_adresse")).toBe(true);
    /* Le document du client : le chemin et le nom ont une colonne, le fichier
       lui-même n'en a pas — il part au stockage. */
    for (const colonne of ["piece_jointe_chemin", "piece_jointe_nom", "piece_jointe_mime"]) {
      expect(bons?.has(colonne)).toBe(true);
    }
    expect(bons?.has("piece_jointe_fichier")).toBe(false);
    /* Le total d'une ligne se stocke désormais sur les trois documents, pas
       seulement sur la facture (migration 20260916120000). Les lignes filles ne passent pas par
       `colonnesDe()` : envoyer `montant_ht` à une table qui ne l'aurait pas
       ferait rejeter l'enregistrement entier, silencieusement du point de vue
       de l'écran. Ce test est ce qui tient le drapeau `avecMontantHt`. */
    for (const table of ["devis_lignes", "bon_commande_lignes", "facture_lignes"]) {
      expect(colonnesDe(table)?.has("montant_ht"), `${table}.montant_ht`).toBe(true);
    }
    const articles = colonnesDe("articles");
    for (const colonne of ["actif", "famille", "prix_achat", "type_article", "gere_en_stock"]) {
      expect(articles?.has(colonne)).toBe(true);
    }
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

describe("Réglages de la société", () => {
  /**
   * `CHAMPS_SOCIETE` est une liste blanche : un champ qui n'y figure pas part
   * dans le jsonb `infos_entreprise` au lieu de sa colonne, sans avertissement.
   * Une faute de frappe dans un nom de colonne produit donc une donnée
   * silencieusement perdue — c'est ce que ce test rend impossible.
   */
  it("chaque champ vise une colonne réelle de societes", () => {
    const colonnes = colonnesDe("societes")!;
    expect(colonnes).toBeTruthy();

    for (const [champ, def] of Object.entries(CHAMPS_SOCIETE)) {
      expect(colonnes.has(def.colonne), `${champ} → ${def.colonne} n'existe pas`).toBe(
        true
      );
    }
  });

  it("porte les champs exigés par la facturation électronique", () => {
    const colonnes = Object.values(CHAMPS_SOCIETE).map((d) => d.colonne);
    for (const attendue of [
      "siren",
      "tva_intracom",
      "raison_sociale_legale",
      "adresse_electronique_valeur",
      "iban",
    ]) {
      expect(colonnes).toContain(attendue);
    }
  });
});
