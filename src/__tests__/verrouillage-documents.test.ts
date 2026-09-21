/**
 * Ce qu'une pièce déjà partie ne laisse plus toucher.
 *
 * Deux défauts d'écran motivent ces règles :
 *
 *  - sur une facture émise, le bouton « Enregistrer la facture » restait
 *    ACTIF. Le clic partait, `facture_emise_entete_figee` répondait 23001, et
 *    l'écran n'en disait rien. Même chose pour « Supprimer » ;
 *  - un bon de commande déjà facturé se modifiait librement : le client tenait
 *    une facture décrivant des travaux, et le bon disait autre chose.
 *
 * Le critère du bon n'est PAS son statut de circuit : `bc_generer_facture`
 * fait naître un brouillon, et tant qu'il n'a pas de numéro rien n'est parti.
 */

import { describe, it, expect } from "vitest";
import {
  bonEstFacture,
  verrouBonCommande,
  verrouFacture,
} from "@/api/regles-verrouillage";

describe("Le verrou d'une facture", () => {
  it("laisse un brouillon libre", () => {
    expect(verrouFacture({ numero: "", typeDocument: "facture" })).toBeNull();
  });

  it("traite l'absence de numéro et la chaîne d'espaces de la même façon", () => {
    expect(verrouFacture({ numero: null })).toBeNull();
    expect(verrouFacture({ numero: "   " })).toBeNull();
  });

  it("fige une facture numérotée, définitivement", () => {
    const v = verrouFacture({ numero: "FAC-2026-000042", typeDocument: "facture" });

    expect(v?.code).toBe("emise");
    expect(v?.reversible).toBe(false);
    expect(v?.libelle).toContain("FAC-2026-000042");
    expect(v?.libelle).toContain("avoir");
  });

  it("fige aussi un avoir, sans lui proposer de se rectifier lui-même", () => {
    const v = verrouFacture({ numero: "AV-2026-000003", typeDocument: "avoir" });

    expect(v?.code).toBe("emise");
    expect(v?.libelle).toContain("L'avoir");
    expect(v?.libelle).not.toContain("passe par un avoir");
  });

  it("pose un verrou levable sur un brouillon déjà téléchargé", () => {
    const v = verrouFacture({ numero: "", verrouillee: true });

    expect(v?.code).toBe("telechargee");
    expect(v?.reversible).toBe(true);
  });

  it("fait primer l'émission sur le cadenas d'écran", () => {
    /* Promettre « déverrouiller pour modifier » sur une facture numérotée
       serait promettre ce que la base refuse. */
    const v = verrouFacture({ numero: "FAC-2026-000042", verrouillee: true });

    expect(v?.code).toBe("emise");
    expect(v?.reversible).toBe(false);
  });
});

describe("Le verrou d'un bon de commande", () => {
  it("laisse libre un bon qu'aucune facture ne suit", () => {
    expect(verrouBonCommande([])).toBeNull();
    expect(bonEstFacture([])).toBe(false);
  });

  it("laisse libre un bon dont la facture est encore au brouillon", () => {
    /* `bc_generer_facture` fait naître un brouillon : rien n'est parti chez le
       client, et corriger le bon est encore légitime. */
    expect(verrouBonCommande([{ numero: "" }, { numero: null }])).toBeNull();
  });

  it("fige un bon dès qu'une facture émise le désigne", () => {
    const v = verrouBonCommande([{ numero: "" }, { numero: "FAC-2026-000042" }]);

    expect(v?.code).toBe("bon_facture");
    expect(v?.reversible).toBe(false);
    expect(v?.libelle).toContain("FAC-2026-000042");
  });

  it("nomme toutes les factures qui le figent", () => {
    const v = verrouBonCommande([
      { numero: "FAC-2026-000042" },
      { numero: "FAC-2026-000043" },
    ]);

    expect(v?.libelle).toContain("FAC-2026-000042");
    expect(v?.libelle).toContain("FAC-2026-000043");
  });

  it("dit `facturé` dès qu'un verrou existe, et seulement alors", () => {
    expect(bonEstFacture([{ numero: "FAC-2026-000042" }])).toBe(true);
    expect(bonEstFacture([{ numero: "  " }])).toBe(false);
  });
});

/**
 * Le miroir doit refléter ce que la base oppose.
 *
 * Essai à blanc sur la production, le 21/09/2026, migration
 * `20260921150000_le_bon_facture_ne_bouge_plus` appliquée dans une
 * transaction annulée, sur le bon `37e0457f` que la facture FAC-2026-000011
 * suit :
 *
 *   statut_workflow + notes  → ACCEPTÉ   (liste blanche)
 *   conducteur               → ACCEPTÉ   (propagation d'un renommage)
 *   montant                  → REFUSÉ    restrict_violation
 *   delete                   → REFUSÉ    restrict_violation
 *
 * Ce test-ci garde la phrase : si elle change ici sans changer là-bas, deux
 * messages diraient la même chose différemment.
 */
describe("Le message du verrou est celui de la base", () => {
  it("reprend mot pour mot l'ouverture du déclencheur SQL", () => {
    const v = verrouBonCommande([{ numero: "FAC-2026-000011" }]);

    expect(v?.libelle).toMatch(
      /^Ce bon de commande est facturé \(FAC-2026-000011\) : son contenu ne peut plus changer/
    );
  });
});
