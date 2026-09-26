/**
 * Parité des pièces imprimées et du courriel qui les accompagne :
 *  - `regles-efacture.ts#identifiantsLegaux` et `integrations/reglages.ts#fusionnerReglages`,
 *    importés tels quels ;
 *  - `piedDePageHTML`, `lignesLogementPourEmail`, `envoyerDocumentEmail`, qui
 *    vivent dans `app.js` : leur source est extraite et évaluée (D-045).
 */
import { describe, expect, it } from "vitest";
import * as ancienEfacture from "../../../src/api/regles-efacture";
import { fusionnerReglages } from "../../../src/integrations/reglages";
import { montant, formatEuros } from "../../src/lib/money";
import { brouillonEmail, lignesLogementPourEmail } from "../../src/modules/documents/domain/email";
import { identifiantsLegaux, lireReglagesImpression, piedDePage, type IdentiteEmettrice } from "../../src/modules/documents/domain/identite";
import { generateur } from "./aleatoire";
import { constanteDe, sourceDe } from "./source-app";
import { UNITES_REPLI, unitesDeLaSociete } from "../../src/modules/documents/domain/unites";

const g = generateur(40926);
const peutEtre = <T>(v: T) => g.parmi([v, null, ""]);

function identiteTiree(): IdentiteEmettrice {
  return {
    nom: g.parmi(["KTA PLOMBERIE", "ALPHA Rénovation"]),
    formeJuridique: peutEtre(g.parmi(["SAS", "SARL"])),
    adresse: peutEtre("12 rue des Lilas"),
    codePostal: peutEtre("69003"),
    ville: peutEtre("Lyon"),
    telephone: null,
    email: null,
    siret: peutEtre(`${g.chiffres(14)}`),
    siren: peutEtre(`${g.chiffres(9)}`),
    tvaIntracom: peutEtre(`FR${g.chiffres(11)}`),
    capitalSocial: g.parmi([null, 0, 1500, 150000, 1234567.5]),
    rcsNumero: peutEtre(`${g.chiffres(9)}`),
    rcsVille: peutEtre("Lyon"),
    codeNaf: peutEtre("43.22A"),
    iban: null,
    bic: null,
    logo: null,
  };
}

describe("parité des identifiants et du pied légal", () => {
  it("identifiantsLegaux : 2 000 tirages", () => {
    for (let i = 0; i < 2000; i++) {
      const s = identiteTiree();
      expect(identifiantsLegaux(s)).toEqual(ancienEfacture.identifiantsLegaux(s));
    }
  });

  it("piedDePageHTML (app.js) : pied personnalisé, sinon nom — identifiants — adresse", () => {
    const ancien = new Function("window", `${sourceDe("piedDePageHTML")}; return piedDePageHTML;`)({ identifiantsLegaux: ancienEfacture.identifiantsLegaux }) as (
      em: { nom: string; siret: string | null; tva: string | null; adresse: string | null },
      s: Record<string, unknown>
    ) => string;
    for (let i = 0; i < 500; i++) {
      const s = identiteTiree();
      const perso = g.parmi(["", "   ", "Pied de page maison"]);
      const em = { nom: s.nom, siret: s.siret, tva: s.tvaIntracom, adresse: s.adresse };
      const reglages = { ...lireReglagesImpression({ reglages: { documents: { piedDePage: perso } } }) };
      expect(piedDePage({ nom: em.nom, siret: em.siret, tvaIntracom: em.tva, adresse: em.adresse }, s, reglages)).toBe(
        ancien(em, { ...s, reglages: { documents: { piedDePage: perso } } })
      );
    }
  });
});

describe("parité des réglages d'impression", () => {
  it("lireReglagesImpression = fusionnerReglages().documents sur les champs imprimés", () => {
    const valeurs = [undefined, null, "", "texte", true, false, 0, 12, {}, []];
    for (let i = 0; i < 1000; i++) {
      const documents = {
        afficherIban: g.parmi(valeurs),
        piedDePage: g.parmi(valeurs),
        mentionsComplementaires: g.parmi(valeurs),
        conditionsDevis: g.parmi(valeurs),
        mentionAcceptation: g.parmi(valeurs),
        siteWeb: g.parmi(valeurs),
        couleurAccent: g.parmi([...valeurs, "#1E8FD5"]),
        couleurSecondaire: g.parmi([...valeurs, "#0B3D2E"]),
      };
      const brut = g.parmi([{ documents }, {}, null, { documents: null }]);
      const a = fusionnerReglages(brut).documents;
      const b = lireReglagesImpression({ reglages: brut });
      expect(b).toEqual({
        afficherIban: a.afficherIban,
        piedDePage: a.piedDePage,
        mentionsComplementaires: a.mentionsComplementaires,
        conditionsDevis: a.conditionsDevis,
        mentionAcceptation: a.mentionAcceptation,
        siteWeb: a.siteWeb,
        couleurAccent: a.couleurAccent,
        couleurSecondaire: a.couleurSecondaire,
      });
    }
  });
});

describe("parité des unités proposées (DEV-08)", () => {
  it("le référentiel de la société dans l'ordre de entreesDuDomaine, sinon la liste de repli d'app.js", async () => {
    const { entreesDuDomaine } = await import("../../../src/api/regles-referentiels");
    const repliAncien = new Function(`${constanteDe("UNITES")}; return UNITES;`)() as string[];
    expect([...UNITES_REPLI]).toEqual(repliAncien);
    for (let i = 0; i < 500; i++) {
      const entrees = Array.from({ length: g.entier(0, 6) }, (_, j) => ({
        id: `e${j}`,
        domaine: g.parmi(["unite", "unite", "categorie_achat"]),
        libelle: g.parmi(["m²", "ml", "U", "forfait", "Épaisseur", "", "heure"]),
        position: g.parmi([0, 1, 2, 5]),
        societeId: "s",
      }));
      const declarees = entreesDuDomaine(entrees, "unite", "s").map((r) => r.libelle).filter(Boolean);
      expect(unitesDeLaSociete(entrees)).toEqual(declarees.length ? declarees : repliAncien);
    }
  });
});

interface DocAncien {
  id: string;
  numero: string;
  client: string;
  typeDocument?: string;
  adresse?: string | null;
  adresseLocataire?: string | null;
  codePostal?: string | null;
  ville?: string | null;
  logementStatut?: string | null;
  occupant?: string | null;
  ancienLocataire?: string | null;
  numeroLogement?: string | null;
}

describe("parité du courriel (DEV-16, FAC-13)", () => {
  const lieuTire = () => ({
    adresse_locataire: peutEtre("14 rue Garibaldi"),
    adresse: peutEtre("siège"),
    code_postal: peutEtre("69003"),
    ville: peutEtre("Lyon"),
    logement_statut: g.parmi(["occupé", "vacant", "commune", null] as const),
    occupant: peutEtre("M. Martin"),
    ancien_locataire: peutEtre("Mme Petit"),
    numero_logement: peutEtre("12"),
  });
  const versAncien = (l: ReturnType<typeof lieuTire>): Omit<DocAncien, "id" | "numero" | "client"> => ({
    adresseLocataire: l.adresse_locataire,
    adresse: l.adresse,
    codePostal: l.code_postal,
    ville: l.ville,
    logementStatut: l.logement_statut,
    occupant: l.occupant,
    ancienLocataire: l.ancien_locataire,
    numeroLogement: l.numero_logement,
  });

  it("lignesLogementPourEmail : 1 000 tirages", () => {
    const ancien = new Function(`${sourceDe("withVille")}\n${sourceDe("lignesLogementPourEmail")}; return lignesLogementPourEmail;`)() as (d: object) => string[];
    for (let i = 0; i < 1000; i++) {
      const l = lieuTire();
      expect(lignesLogementPourEmail(l)).toEqual(ancien(versAncien(l)));
    }
  });

  it("envoyerDocumentEmail : objet, corps, avoir « en votre faveur »", () => {
    for (let i = 0; i < 300; i++) {
      const l = lieuTire();
      const nature = g.parmi(["devis", "facture"] as const);
      const avoir = nature === "facture" && g.parmi([true, false]);
      const ttc = Number(`${g.entier(0, 9000)}.${g.chiffres(2)}`);
      const doc: DocAncien = { id: "d1", numero: "FAC-2026-000042", client: "OPAC", typeDocument: avoir ? "avoir" : "facture", ...versAncien(l) };
      let capture: { dest: string; subject: string; body: string } | null = null;
      const etat = { devis: [doc], factures: [doc], clients: [{ societeId: "s", nom: "OPAC", email: "opac@example.org" }], societeId: "s" };
      const envoyer = new Function(
        "state", "window", "computeDocTotals", "money", "societeName", "openEmailComposeModal", "printDocument",
        `${sourceDe("withVille")}\n${sourceDe("lignesLogementPourEmail")}\n${sourceDe("envoyerDocumentEmail")}; return envoyerDocumentEmail;`
      )(
        etat,
        { estAvoir: (t: string) => String(t ?? "").includes("avoir") },
        () => ({ ttc: avoir ? -ttc : ttc }),
        (v: number) => formatEuros(montant(v)),
        () => "ALPHA Rénovation",
        (o: { dest: string; subject: string; body: string }) => { capture = o; },
        () => undefined
      ) as (type: string, id: string) => void;
      envoyer(nature, "d1");
      const nouveau = brouillonEmail({ nature, avoir, numero: doc.numero, ttc: montant(avoir ? -ttc : ttc), societeNom: "ALPHA Rénovation", destinataire: "opac@example.org", lieu: l });
      expect({ dest: nouveau.destinataire, subject: nouveau.objet, body: nouveau.corps }).toEqual(capture && { dest: (capture as { dest: string }).dest, subject: (capture as { subject: string }).subject, body: (capture as { body: string }).body });
    }
  });
});
