/**
 * Parité de la lecture automatique contre l'ancien code :
 *  - `src/integrations/ocr.ts` crée le client Supabase à l'import : ses
 *    fonctions (`rapprocherClient`, `versSaisieBonCommande`, `preparer`) sont
 *    EXTRAITES de la source et évaluées — une évolution de l'ancien code fait
 *    échouer ce test (relecture 3, M10 : la copie verbatim ne le faisait pas) ;
 *  - `src/api/regles-bc.ts` et `src/api/regles-ocr.ts`, importés tels quels.
 */
import { describe, expect, it } from "vitest";
import * as ancienBc from "../../../src/api/regles-bc";
import * as ancienOcr from "../../../src/api/regles-ocr";
import { decisionPreparation } from "../../src/modules/ocr/api/preparer";
import type { ExtractionBC } from "../../src/modules/ocr/domain/contrat";
import * as lecture from "../../src/modules/ocr/domain/lecture";
import { essentielsManquants } from "../../src/modules/ocr/domain/lecture";
import { versPreRemplissage } from "../../src/modules/ocr/domain/prefill";
import { rapprocherClient } from "../../src/modules/ocr/domain/rapprochement";
import { generateur } from "./aleatoire";
import { evaluer, fonctionTs, instructionDe, lireAncien, sansTypes } from "./source";

const AUJOURDHUI = "2026-09-25";
const ocrTs = lireAncien("src/integrations/ocr.ts");
const extraire = (noms: string[]) => noms.map((n) => sansTypes(fonctionTs(ocrTs, `function ${n}(`)));

interface AncienOcr {
  rapprocherClient: (nom: string | null | undefined, clients: string[]) => { nom: string; reconnu: boolean; suggestions: string[] };
  versSaisieBonCommande: (e: ExtractionBC) => Record<string, unknown>;
  preparer: (f: { type: string; size: number; name?: string }) => Promise<unknown>;
}

const RECOMPRESSE = Symbol("recompressé");
const ancien = evaluer<AncienOcr>(
  [
    ...[instructionDe(ocrTs, "const MIMES_ACCEPTES"), instructionDe(ocrTs, "const TAILLE_MAX"), instructionDe(ocrTs, "const TAILLE_RECOMPRESSION")].map(sansTypes),
    ...extraire(["normaliser", "motsCles", "rapprocherClient", "versSaisieBonCommande", "preparer"]),
  ],
  ["rapprocherClient", "versSaisieBonCommande", "preparer"],
  // Ce que les extraits lisent autour d'eux : la date du jour, et la recompression (canvas, hors d'un test).
  { todayISO: () => AUJOURDHUI, normaliserImage: async () => RECOMPRESSE }
);

const CLIENTS = ["OPAC du Rhône", "ALPES ISERE HABITAT (AIH)", "Grand Lyon Habitat", "SCI Les Tilleuls", "Mairie de Villeurbanne", "Lyon Métropole Habitat", "Mme Durand"];

describe("parité du rapprochement de client (OCR-05, OCR-14)", () => {
  it.each([
    "OPAC DU RHONE", "opac du rhône sa", "Alpes Isère Habitat", "LYON HABITAT", "Mairie Villeurbanne", "Inconnu SARL", "", null,
    "Grand Lyon", "SCI LES TILLEULS", "Habitat", "Durand",
  ])("« %s »", (lu) => {
    expect(rapprocherClient(lu, CLIENTS)).toEqual(ancien.rapprocherClient(lu, CLIENTS));
  });
});

describe("parité des essentiels de lecture (OCR-13)", () => {
  it.each([
    [{ numeroBC: null, adresse: null, lignes: [] }],
    [{ numeroBC: "12", adresse: "rue", lignes: [{ type: "ligne", designation: "x" }] }],
    [{ numeroBC: " ", adresse: "rue", lignes: [{ type: "chapitre", designation: "Lot" }, { type: "ligne", designation: " " }] }],
  ])("%o", (lu) => {
    const nouveau = essentielsManquants({ ...lu, lignes: lu.lignes.map((l) => ({ ...l, type: l.type as "ligne", qte: null, unite: null, prixUnitaire: null, tva: null })) });
    expect(nouveau).toEqual(ancienBc.essentielsDeLecture(lu).map((m) => m.libelle));
  });
});

const g = generateur(18275);

function extractionTiree(): ExtractionBC {
  const t = () => g.parmi([null, "texte lu", "3"]);
  return {
    client: t(), numeroBC: g.parmi([null, "BC-77"]), dateBC: g.parmi([null, "2026-09-20"]), referenceChantier: t(), natureTravaux: t(), dateFinTravaux: g.parmi([null, "2026-10-01"]),
    interlocuteur: t(), adresse: t(), codePostal: t(), ville: t(), facturationAdresse: t(), facturationCodePostal: t(), facturationVille: t(), numeroLogement: t(),
    logementStatut: g.parmi([null, "occupé", "vacant", "commune"]), occupant: t(), etage: t(), notes: t(), montantTotalHT: g.parmi([null, 0, 471.5]),
    lignes: Array.from({ length: g.entier(0, 3) }, () => ({ type: g.parmi(["ligne", "chapitre", "commentaire"] as const), designation: g.parmi(["", "Joint"]), qte: g.parmi([null, 2]), unite: g.parmi([null, "u"]), prixUnitaire: g.parmi([null, 10]), tva: g.parmi([null, 5.5]) })),
    avertissements: [],
  };
}

describe("parité du préremplissage (OCR-12, relecture 3 M2)", () => {
  it("chaque champ que l'ancien transmettait arrive au formulaire, avec la même valeur", () => {
    for (let i = 0; i < 500; i++) {
      const e = extractionTiree();
      const a = ancien.versSaisieBonCommande(e);
      const n = versPreRemplissage(e, null, AUJOURDHUI);
      const vide = (v: unknown) => (v === "" || v === undefined ? null : v);
      const ctx = JSON.stringify(e);
      expect(n.mode === "sans_bc", ctx).toBe(a.sansBC);
      expect(n.date_reception, ctx).toBe(a.dateReception);
      const paires: [keyof typeof n, string][] = [
        ["interlocuteur", "interlocuteur"], ["numero_bc", "numeroBC"], ["reference_chantier", "referenceChantier"], ["nature_travaux", "natureTravaux"],
        ["date_fin_travaux", "dateFinTravaux"], ["adresse_locataire", "adresse"], ["code_postal", "codePostal"], ["ville", "ville"],
        ["facturation_adresse", "facturationAdresse"], ["facturation_code_postal", "facturationCodePostal"], ["facturation_ville", "facturationVille"],
        ["logement_statut", "logementStatut"], ["numero_logement", "numeroLogement"], ["occupant", "occupant"], ["etage", "etage"], ["notes", "notes"], ["montant", "montant"],
      ];
      for (const [neuf, vieux] of paires) expect(vide(n[neuf]), `${vieux} ${ctx}`).toEqual(vide(a[vieux]));
      const lignes = a.lignes as { type: string; designation: string; qte?: number; unite?: string; prixUnitaire?: number; tva?: number }[];
      expect(n.lignes.map((l) => [l.type, l.designation, l.quantite, l.unite, l.prix_unitaire, l.tva]), ctx).toEqual(lignes.map((l) => [l.type, l.designation, l.qte ?? null, l.unite ?? null, l.prixUnitaire ?? null, l.tva ?? null]));
    }
  });
});

describe("parité de la préparation du document (OCR-10)", () => {
  it.each([
    { type: "image/heic", size: 10 }, { type: "image/jpeg", size: 3_000_001 }, { type: "image/png", size: 200 }, { type: "", size: 10 },
    { type: "application/pdf", size: 200 }, { type: "application/pdf", size: 14_000_001 }, { type: "application/zip", size: 10 }, { type: "image/webp", size: 3_000_000 },
  ])("%o", async (f) => {
    const d = decisionPreparation(f);
    // L'extrait perd son `async` (il commence à `function`) : on le rend promesse pour lire refus et résultat pareil.
    const vieux = await Promise.resolve()
      .then(() => ancien.preparer(f))
      .then(
      (r) => (r === RECOMPRESSE ? { quoi: "recompresser" } : { quoi: "tel_quel" }),
      (e: Error) => ({ quoi: "refus", motif: e.message })
    );
    expect(d).toEqual(vieux);
  });
});

describe("parité des étapes et délais de lecture (OCR-02, OCR-11)", () => {
  it("mêmes seuils, mêmes libellés, mêmes issues", () => {
    expect([lecture.DELAI_LECTURE_MS, lecture.DUREE_HABITUELLE_MS, lecture.SEUIL_PLUS_LONG_QUE_DHABITUDE_MS, lecture.DELAI_BASCULE_ANALYSE_MS]).toEqual([
      ancienOcr.DELAI_LECTURE_MS, ancienOcr.DUREE_HABITUELLE_MS, ancienOcr.SEUIL_PLUS_LONG_QUE_DHABITUDE_MS, ancienOcr.DELAI_BASCULE_ANALYSE_MS,
    ]);
    expect(lecture.ETAPES_LECTURE).toEqual(ancienOcr.ETAPES_LECTURE);
    expect(lecture.attenteAnnoncee()).toBe(ancienOcr.attenteAnnoncee());
    for (const ms of [0, 999, 1000, 59_999, 60_000, 65_000, 125_000]) {
      expect(lecture.formaterDuree(ms)).toBe(ancienOcr.formaterDuree(ms));
      expect(lecture.etatAnnule(ms)).toEqual(ancienOcr.etatAnnule(ms));
      expect(lecture.etatDelaiDepasse(ms)).toEqual(ancienOcr.etatDelaiDepasse(ms));
      for (const e of lecture.ETAPES_LECTURE) expect(lecture.etatLecture(e, ms)).toEqual(ancienOcr.etatLecture(e, ms));
    }
    expect(lecture.etatEchec("x")).toEqual(ancienOcr.etatEchec("x"));
  });
});
