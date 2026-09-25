import { describe, expect, it } from "vitest";
import { couleurAnnotation, fermerZone, pointeDeFleche, COULEUR_CONSTATATION, COULEUR_PRECONISATION } from "./annotation";
import { avecLeBon, basculerCategorie, dupliquer, placesPhotos, saisieInitiale, type BonSource, type PhotoEdition } from "./assistant";
import { courrielDuRapport, filtrerRapports, lignesAReprendre, schemaSaisieRapport, signatureClientDemandee, STATUT_DEFAUT, type RapportListe } from "./rapport";

const photo = (cle: string, s: Partial<PhotoEdition> = {}): PhotoEdition => ({ cle, id: cle, apercu: `https://x/${cle}.jpg`, dataUrl: null, categorie: null, ...s });

describe("rapport (PLN-20, PLN-21)", () => {
  it("statut « en cours » par défaut, client requis, code postal à 5 chiffres", () => {
    const s = saisieInitiale("2026-09-25", "09:30", null);
    expect(s.statut).toBe(STATUT_DEFAUT);
    expect(s.heure).toBe("09:30");
    const r = schemaSaisieRapport.safeParse({ ...s, code_postal: "690" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toEqual(["Le nom du client est requis (étape Infos).", "Code postal à 5 chiffres."]);
  });

  it("pas de signature du client dans un logement vacant ni une partie commune", () => {
    expect(signatureClientDemandee("vacant")).toBe(false);
    expect(signatureClientDemandee("commune")).toBe(false);
    expect(signatureClientDemandee("occupé")).toBe(true);
    expect(signatureClientDemandee(null)).toBe(true);
  });

  it("lier un bon reprend client et lieu sans écraser la saisie", () => {
    const bon: BonSource = { id: "b1", client_id: "c1", client_nom: "OPAC", interlocuteur: "M. Martin", adresse: "3 place Bellecour", code_postal: "69002", ville: "Lyon", logement_statut: "occupé", occupant: "Mme D", etage: "2", numero_logement: "12", conducteur_id: "k1" };
    const s = avecLeBon({ ...saisieInitiale("2026-09-25", "09:30", null), ville: "Villeurbanne" }, bon);
    expect(s).toMatchObject({ bon_commande_id: "b1", client_id: "c1", client_nom: "OPAC", adresse_locataire: "3 place Bellecour", ville: "Villeurbanne", logement_statut: "occupé", conducteur_id: "k1" });
    expect(avecLeBon(s, null).bon_commande_id).toBeNull();
  });

  it("trois photos au plus ; dupliquer, catégoriser", () => {
    expect(placesPhotos([photo("a"), photo("b")], 3)).toEqual({ acceptees: 1, message: "Seules 1 photo(s) ont été ajoutées (maximum 3 au total)." });
    expect(placesPhotos([photo("a"), photo("b"), photo("c")], 1)).toEqual({ acceptees: 0, message: "Maximum 3 photos par intervention." });
    const d = dupliquer([photo("a"), photo("b")], "a", "a2");
    expect(d.map((p) => p.cle)).toEqual(["a", "a2", "b"]);
    expect(d[1]).toMatchObject({ id: null, dataUrl: "https://x/a.jpg" });
    expect(basculerCategorie(basculerCategorie(photo("a"), "preconisation"), "preconisation").categorie).toBeNull();
  });

  it("lignes reprises : préconisations, sinon constatations, sinon le métier", () => {
    expect(lignesAReprendre({ preconisations: "Joint x2\nEnduit x3,5 m²", constatations: "x", metier: null })).toEqual([
      { designation: "Joint", quantite: 2, unite: "u" },
      { designation: "Enduit", quantite: 3.5, unite: "m²" },
    ]);
    expect(lignesAReprendre({ preconisations: " ", constatations: "Fuite visible", metier: null })).toEqual([{ designation: "Fuite visible", quantite: 1, unite: "u" }]);
    expect(lignesAReprendre({ preconisations: null, constatations: null, metier: "plomberie" })).toEqual([{ designation: "Plomberie", quantite: 1, unite: "u" }]);
  });

  it("liste : émetteur, conducteur, logement, recherche multi-mots (PLN-52)", () => {
    const r = (s: Partial<RapportListe>): RapportListe => ({ id: "1", numero: "INT-2026-000001", client_nom: "OPAC", interlocuteur: null, adresse: null, adresse_locataire: "3 place Bellecour", code_postal: null, ville: "Lyon", numero_logement: null, occupant: null, logement_statut: "occupé", conducteur: "Christophe", metier: "plomberie", constatations: "fuite", preconisations: null, sous_traitant_id: null, ...s });
    const liste = [r({}), r({ id: "2", sous_traitant_id: "st", client_nom: "Régie" })];
    expect(filtrerRapports(liste, { recherche: "", conducteur: "", logement: "", emetteur: "internes" }).map((x) => x.id)).toEqual(["1"]);
    expect(filtrerRapports(liste, { recherche: "", conducteur: "", logement: "", emetteur: "sous_traitants" }).map((x) => x.id)).toEqual(["2"]);
    expect(filtrerRapports(liste, { recherche: "plomberie bellecour", conducteur: "Christophe", logement: "occupé", emetteur: "tous" }).map((x) => x.id)).toEqual(["1", "2"]);
    expect(filtrerRapports(liste, { recherche: "", conducteur: "", logement: "vacant", emetteur: "tous" })).toEqual([]);
  });

  it("courriel du rapport", () => {
    const c = courrielDuRapport({ client_nom: "OPAC", adresse: null, adresse_locataire: "3 place Bellecour", code_postal: "69002", ville: "Lyon", logement_statut: "vacant", occupant: null, ancien_locataire: "M. B", numero_logement: "12", constatations: "Fuite", preconisations: "Joint x2", date: "2026-09-25" });
    expect(c.objet).toBe("Rapport d'intervention — OPAC");
    expect(c.corps).toContain("Adresse : 3 place Bellecour, 69002 Lyon\nAncien locataire : M. B\nN° de logement : 12\nDate : 25/09/2026");
  });
});

describe("annotation (PLN-10)", () => {
  it("vert pour une préconisation, rouge sinon ; zone gardée dès deux points", () => {
    expect(couleurAnnotation("preconisation")).toBe(COULEUR_PRECONISATION);
    expect(couleurAnnotation(null)).toBe(COULEUR_CONSTATATION);
    expect(fermerZone([], [{ x: 0, y: 0 }])).toEqual([]);
    expect(fermerZone([], [{ x: 0, y: 0 }, { x: 5, y: 5 }])).toHaveLength(1);
    const [g, d] = pointeDeFleche({ x: 0, y: 0 }, { x: 10, y: 0 }, 5);
    expect(g.x).toBeCloseTo(10 - 5 * Math.cos(-Math.PI / 6));
    expect(d.y).toBeCloseTo(-5 * Math.sin(Math.PI / 6));
  });
});
