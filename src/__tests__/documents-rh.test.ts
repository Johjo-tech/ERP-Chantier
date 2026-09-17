/**
 * Le dossier documentaire d'un salarié.
 *
 * Ces règles décident de deux choses qui doivent rester d'accord : la pastille
 * rouge de l'écran RH et la notification de la cloche. Les faire diverger, ce
 * serait un dossier signalé incomplet à un endroit et complet à l'autre.
 */

import { describe, expect, it } from "vitest";
import {
  TYPES_DOCUMENT_RH,
  dossierSalarie,
  etatDocumentRh,
  joursEntre,
  libelleDocumentRh,
  trierDocumentsRh,
  typeDocumentRh,
  type DocumentRh,
} from "@/api/regles-documents-rh";

const AUJOURDHUI = "2026-09-17";

function doc(partiel: Partial<DocumentRh> = {}): DocumentRh {
  return {
    id: partiel.id ?? "d1",
    salarieId: partiel.salarieId ?? "s1",
    type: partiel.type ?? "contrat",
    ...partiel,
  };
}

/** Le dossier minimal accepté : un document par type obligatoire. */
function dossierComplet(): DocumentRh[] {
  return TYPES_DOCUMENT_RH.filter((t) => t.obligatoire).map((t, i) =>
    doc({
      id: `d${i}`,
      type: t.code,
      dateExpiration: t.perissable ? "2030-01-01" : null,
    })
  );
}

describe("catalogue des types", () => {
  it("rend un type connu, et rabat l'inconnu sur « autre »", () => {
    expect(typeDocumentRh("carteBtp").libelle).toBe("Carte BTP");
    /* Un code retiré du catalogue ne doit pas faire disparaître de l'écran le
       document qu'il désigne — sinon son fichier reste dans le bucket sans
       que personne puisse le supprimer. */
    expect(typeDocumentRh("visa-2019").code).toBe("autre");
    expect(typeDocumentRh(null).code).toBe("autre");
  });
});

describe("joursEntre", () => {
  it("compte en jours calendaires, sans dépendre du fuseau", () => {
    expect(joursEntre("2026-09-17", "2026-09-18")).toBe(1);
    expect(joursEntre("2026-09-17", "2026-09-17")).toBe(0);
    expect(joursEntre("2026-09-17", "2026-09-10")).toBe(-7);
  });

  it("ne franchit pas la journée sur un changement d'heure", () => {
    /* Paris passe à l'heure d'hiver le 25 octobre 2026. Un calcul qui passe
       par l'heure locale rend 30,96 jours et arrondit à 31. */
    expect(joursEntre("2026-10-01", "2026-10-31")).toBe(30);
  });

  it("rend null quand la date manque ou ne veut rien dire", () => {
    expect(joursEntre(AUJOURDHUI, null)).toBeNull();
    expect(joursEntre(AUJOURDHUI, "")).toBeNull();
    expect(joursEntre(AUJOURDHUI, "bientôt")).toBeNull();
  });
});

describe("etatDocumentRh", () => {
  it("classe selon l'échéance et le seuil", () => {
    const seuil = 30;
    expect(etatDocumentRh(doc({ dateExpiration: "2026-09-16" }), AUJOURDHUI, seuil).etat).toBe("expire");
    expect(etatDocumentRh(doc({ dateExpiration: "2026-09-17" }), AUJOURDHUI, seuil).etat).toBe("bientot");
    expect(etatDocumentRh(doc({ dateExpiration: "2026-10-17" }), AUJOURDHUI, seuil).etat).toBe("bientot");
    expect(etatDocumentRh(doc({ dateExpiration: "2026-10-18" }), AUJOURDHUI, seuil).etat).toBe("valide");
  });

  it("le jour même n'est pas encore expiré", () => {
    const etat = etatDocumentRh(doc({ dateExpiration: AUJOURDHUI }), AUJOURDHUI, 30);
    expect(etat.etat).toBe("bientot");
    expect(etat.jours).toBe(0);
  });

  it("signale un périssable sans date de fin, pas un contrat", () => {
    /* Une carte BTP sans échéance saisie ne déclenchera jamais d'alerte : elle
       n'est pas « bonne pour toujours », elle manque d'une information. */
    const carte = etatDocumentRh(doc({ type: "carteBtp" }), AUJOURDHUI, 30);
    expect(carte.etat).toBe("permanent");
    expect(carte.sansEcheance).toBe(true);

    const contrat = etatDocumentRh(doc({ type: "contrat" }), AUJOURDHUI, 30);
    expect(contrat.etat).toBe("permanent");
    expect(contrat.sansEcheance).toBe(false);
  });

  it("suit le seuil qu'on lui donne, pas un seuil écrit en dur", () => {
    const d = doc({ dateExpiration: "2026-11-01" });
    expect(etatDocumentRh(d, AUJOURDHUI, 30).etat).toBe("valide");
    expect(etatDocumentRh(d, AUJOURDHUI, 60).etat).toBe("bientot");
  });
});

describe("dossierSalarie", () => {
  it("liste les pièces obligatoires absentes", () => {
    const bilan = dossierSalarie([doc({ type: "contrat" })], AUJOURDHUI, 30);
    const codes = bilan.manquants.map((t) => t.code);
    expect(codes).toContain("dpae");
    expect(codes).toContain("carteBtp");
    expect(codes).not.toContain("contrat");
    /* L'avenant ne concerne pas tout le monde : le réclamer à tous ferait un
       écran rouge en permanence, donc un écran qu'on n'écoute plus. */
    expect(codes).not.toContain("avenant");
    expect(bilan.complet).toBe(false);
  });

  it("déclare complet un dossier qui a tout et rien de périmé", () => {
    const bilan = dossierSalarie(dossierComplet(), AUJOURDHUI, 30);
    expect(bilan.manquants).toEqual([]);
    expect(bilan.expires).toEqual([]);
    expect(bilan.complet).toBe(true);
  });

  it("ne compte pas comme manquant un document présent mais expiré", () => {
    /* Les deux se réparent autrement — l'un se demande, l'autre se renouvelle.
       Les confondre compterait le même défaut deux fois. */
    const docs = dossierComplet().map((d) =>
      d.type === "carteBtp" ? { ...d, dateExpiration: "2026-01-01" } : d
    );
    const bilan = dossierSalarie(docs, AUJOURDHUI, 30);
    expect(bilan.manquants.map((t) => t.code)).not.toContain("carteBtp");
    expect(bilan.expires).toHaveLength(1);
    expect(bilan.complet).toBe(false);
  });

  it("une échéance proche n'empêche pas le dossier d'être complet", () => {
    const docs = dossierComplet().map((d) =>
      d.type === "carteBtp" ? { ...d, dateExpiration: "2026-09-30" } : d
    );
    const bilan = dossierSalarie(docs, AUJOURDHUI, 30);
    expect(bilan.bientot).toHaveLength(1);
    expect(bilan.complet).toBe(true);
  });

  it("remonte les périssables déposés sans date de fin", () => {
    const docs = dossierComplet().map((d) =>
      d.type === "pieceIdentite" ? { ...d, dateExpiration: null } : d
    );
    const bilan = dossierSalarie(docs, AUJOURDHUI, 30);
    expect(bilan.sansEcheance.map((d) => d.type)).toEqual(["pieceIdentite"]);
  });

  it("un dossier vide n'est pas complet", () => {
    const bilan = dossierSalarie([], AUJOURDHUI, 30);
    expect(bilan.complet).toBe(false);
    expect(bilan.manquants.length).toBe(
      TYPES_DOCUMENT_RH.filter((t) => t.obligatoire).length
    );
  });
});

describe("libelleDocumentRh", () => {
  it("se rabat sur le nom du fichier, puis sur le type", () => {
    expect(libelleDocumentRh(doc({ nom: "CDI Dupont" }))).toBe("CDI Dupont");
    expect(libelleDocumentRh(doc({ nom: "  ", fichierNom: "cdi.pdf" }))).toBe("cdi.pdf");
    expect(libelleDocumentRh(doc({ type: "rib" }))).toBe("RIB");
  });
});

describe("trierDocumentsRh", () => {
  it("met les échéances les plus proches devant, et les sans-date derrière", () => {
    const ordre = trierDocumentsRh([
      doc({ id: "sans", type: "contrat", nom: "Contrat" }),
      doc({ id: "loin", dateExpiration: "2027-01-01" }),
      doc({ id: "proche", dateExpiration: "2026-10-01" }),
    ]).map((d) => d.id);
    expect(ordre).toEqual(["proche", "loin", "sans"]);
  });
});
