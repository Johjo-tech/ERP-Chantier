/**
 * Parité du parc (véhicules et matériel), contre l'ancien code pris TEL QUEL :
 *  - `src/integrations/alertes.ts` et `src/api/regles-referentiels.ts`, importés ;
 *  - `libelleVehicule`, `vehiculeTypeLabel`, `materielStatut`, `addJours`,
 *    `joursAvant`, `etatMaterielOptions`, `confirmVendreVehicule`,
 *    `addVehiculeEntretien`, qui vivent dans `app.js` : leur SOURCE est extraite
 *    et évaluée (D-045).
 *
 * Écarts assumés, vérifiés comme tels : libellé des alertes (plaque au lieu de
 * `nom`), CT dans les alertes (D-VEH-04).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as ancienAlertes from "../../../src/integrations/alertes";
import { referentielCompose } from "../../../src/api/regles-referentiels";
import { ajouterJours, pretEnCours } from "../../src/modules/materiel/domain/prets";
import { composerListe, etatsProposes } from "../../src/modules/materiel/domain/materiel";
import { alertesVehicule, etiquetteEcheance, joursAvant } from "../../src/modules/vehicules/domain/echeances";
import { kilometrageApres } from "../../src/modules/vehicules/domain/entretien";
import { designationVente, tvaVenteParDefaut } from "../../src/modules/vehicules/domain/vente";
import { libelleType, libelleVehicule, type Vehicule } from "../../src/modules/vehicules/domain/vehicule";
import { generateur } from "./aleatoire";
import { constanteDe, sourceDe } from "./source-app";

const g = generateur(20260926);
/** « async nom » : `sourceDe` part de `function nom(` et laisserait le mot-clé `async` derrière lui. */
const source = (n: string) => (n.startsWith("async ") ? `async ${sourceDe(n.slice(6))}` : sourceDe(n));
const compiler = <T>(noms: string[], params: string[] = [], retour = noms[noms.length - 1]?.replace("async ", "")) =>
  new Function(...params, `${noms.map(source).join("\n")}\nreturn ${retour};`) as (...a: unknown[]) => T;

const PLAQUES = ["", "  ", "AB-123-CD", "ef-456-gh", " XY-999-ZZ "];
const MARQUES = [null, "", "Renault", " Peugeot "];
const MODELES = [null, "", "Trafic", "Partner "];
const NOMS = [null, "", "Camion 3", " Utilitaire "];

function vehiculeAuHasard(): Vehicule {
  return {
    id: `v${g.entier(1, 9999)}`,
    societe_id: "s",
    nom: g.parmi(NOMS),
    immatriculation: g.parmi(PLAQUES),
    marque: g.parmi(MARQUES),
    modele: g.parmi(MODELES),
    type_vehicule: g.parmi(["CTTE", "VP", "Tourisme", null, "Poids lourd"]),
    tva_applicable: g.parmi([true, false, null]),
    motorisation: g.parmi([null, "", "Diesel 2.0L"]),
    taille_pneus: g.parmi([null, "205/65 R16"]),
    kilometrage: g.parmi([null, 0, 123456, 87000.5]),
    date_achat: g.parmi([null, "2021-03-15"]),
    date_controle_technique: null,
    conducteur_salarie_id: null,
    telepeage_fournisseur: null,
    telepeage_numero: null,
    telepeage_validite: null,
    carte_carburant_fournisseur: null,
    carte_carburant_numero: null,
    carte_carburant_validite: null,
    vendu: g.parmi([true, false]),
    date_vente: null,
    prix_vente: null,
    facture_vente_id: null,
  };
}

/** L'ancien objet véhicule (camelCase) d'une fiche de la base. */
const versAncien = (v: Vehicule) => ({
  id: v.id, nom: v.nom, immatriculation: v.immatriculation, marque: v.marque, modele: v.modele, motorisation: v.motorisation,
  taillePneus: v.taille_pneus, kilometrage: v.kilometrage, dateAchat: v.date_achat, tvaApplicable: v.tva_applicable, vendu: v.vendu,
  carteCarburantValidite: v.carte_carburant_validite, telepeageValidite: v.telepeage_validite,
});

describe("désigner un véhicule (VEH-02)", () => {
  const ancien = compiler<(v: object) => string>(["libelleVehicule"]);
  const ancienType = compiler<(t: string | null) => string>(["vehiculeTypeLabel"]);

  it("libellé : plaque · marque modèle, ou surnom — 300 tirages", () => {
    for (let i = 0; i < 300; i++) {
      const v = vehiculeAuHasard();
      expect(libelleVehicule(v), JSON.stringify(v)).toBe(ancien()(versAncien(v)));
    }
  });

  it("type : le code court, ou la valeur inconnue telle quelle", () => {
    for (const t of ["CTTE", "VP", "Tourisme", "Poids lourd", null, ""]) expect(libelleType(t)).toBe(ancienType()(t));
  });
});

describe("prêts (VEH-03, VEH-05)", () => {
  const ancienStatut = compiler<(m: object) => { enPret: boolean; pret?: { id: string } }>(["materielStatut"]);
  const ancienAddJours = compiler<(d: string, j: number) => string>(["isoDate", "addJours"]);

  it("un prêt est en cours tant qu'il n'a pas de retour réel — 200 tirages", () => {
    for (let i = 0; i < 200; i++) {
      const prets = Array.from({ length: g.entier(0, 4) }, (_, k) => ({ id: `p${k}`, date_fin: g.parmi([null, "2026-09-01"]) }));
      const a = ancienStatut()({ prets: prets.map((p) => ({ id: p.id, dateRetourReelle: p.date_fin })) });
      const n = pretEnCours(prets);
      expect(n?.id ?? null).toBe(a.enPret ? a.pret?.id : null);
    }
  });

  it("retour prévu = date + n jours (fin de mois, bissextile, changement d'heure)", () => {
    for (const d of ["2026-01-31", "2024-02-28", "2026-03-28", "2026-10-24", "2026-12-31"]) {
      for (const j of [0, 1, 2, 7, 30, 365]) expect(ajouterJours(d, j), `${d} + ${j}`).toBe(ancienAddJours()(d, j));
    }
  });
});

describe("échéances (VEH-01, VEH-21)", () => {
  afterEach(() => vi.useRealTimers());

  it("jours restants : ceux de l'ancien `joursAvant`, à « aujourd'hui » fixé", () => {
    const aujourdhui = "2026-09-25";
    const ancien = compiler<(d: string | null) => number | null>(["joursAvant"], ["todayISO"])(() => aujourdhui);
    for (const d of [null, "", "2026-09-25", "2026-09-24", "2026-10-25", "2027-03-30", "2025-12-31"]) {
      expect(joursAvant(d, aujourdhui), String(d)).toBe(ancien(d));
    }
  });

  it("étiquette du CT : « EXPIRÉ » / « DANS n J » à ≤ 30 j, jamais pour un véhicule vendu", () => {
    const aujourdhui = "2026-09-25";
    const jA = compiler<(d: string | null) => number | null>(["joursAvant"], ["todayISO"])(() => aujourdhui);
    for (const d of ["2026-09-01", "2026-09-25", "2026-10-25", "2026-10-26", null]) {
      for (const vendu of [false, true]) {
        const j = jA(d);
        const attendu = j != null && j <= 30 && !vendu ? (j < 0 ? "EXPIRÉ" : `DANS ${j} J`) : null;
        expect(etiquetteEcheance(d, 30, vendu, aujourdhui)?.texte ?? null, `${d} ${vendu}`).toBe(attendu);
      }
    }
  });

  it("cartes carburant et télépéage : mêmes alertes que `alertesVehicule` (ids, catégories, jours, niveau)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 25, 10, 0, 0));
    for (let i = 0; i < 100; i++) {
      const v = { ...vehiculeAuHasard(), carte_carburant_validite: g.parmi([null, "2026-09-20", "2026-10-10", "2026-12-31"]), telepeage_validite: g.parmi([null, "2026-09-25", "2026-10-26"]) };
      const seuils = { vehiculeCarte: g.parmi([0, 15, 30, 60]), vehiculeControle: 30 };
      const anciennes = ancienAlertes.alertesVehicule({ ...versAncien(v), nom: v.nom ?? undefined }, { ...ancienAlertes.SEUILS, ...seuils });
      const nouvelles = alertesVehicule(v, seuils, [], "2026-09-25").filter((a) => a.categorie !== "Contrôle technique");
      expect(nouvelles.map((a) => [a.id, a.categorie, a.jours, a.niveau === "alerte" ? "warn" : "danger"])).toEqual(
        anciennes.map((a) => [a.id, a.categorie, a.jours, a.niveau])
      );
    }
  });
});

describe("entretien : le compteur monte, jamais ne descend", () => {
  it("comme `addVehiculeEntretien` — 200 tirages", async () => {
    for (let i = 0; i < 200; i++) {
      const kmV = g.parmi([null, "", 0, 50000, "50000"]);
      const kmE = g.parmi(["", "0", "49999", "50000", "50001", "120000"]);
      const champs: Record<string, { value: string; files?: File[] }> = {
        entretienDesignation_v: { value: "Vidange" },
        entretienKilometrage_v: { value: kmE },
        entretienMontant_v: { value: "10" },
        entretienDate_v: { value: "2026-09-25" },
        entretienFichier_v: { value: "", files: [] },
      };
      const v: { id: string; kilometrage: unknown; entretiens: unknown[] } = { id: "v", kilometrage: kmV, entretiens: [] };
      const f = compiler<(id: string) => Promise<void>>(["async addVehiculeEntretien"], ["document", "state", "window", "todayISO", "uid", "recharger", "renderTab", "showToast"])(
        { getElementById: (id: string) => champs[id] },
        { vehicules: [v] },
        { stSet: async () => true },
        () => "2026-09-25",
        () => "x",
        async () => undefined,
        () => undefined,
        () => undefined
      );
      await f("v");
      const kmVehicule = kmV === null || kmV === "" ? null : Number(kmV);
      const kmEntretien = Number.parseFloat(kmE) || null;
      const monte = kilometrageApres(kmVehicule, kmEntretien);
      // Rien à écrire ↔ l'ancien a laissé le compteur tel quel ; sinon, même valeur.
      if (monte === null) expect(v.kilometrage, `${kmV} / ${kmE}`).toBe(kmV);
      else expect(v.kilometrage, `${kmV} / ${kmE}`).toBe(monte);
    }
  });
});

describe("vente (VEH-04)", () => {
  it("désignation et taux : ceux de `confirmVendreVehicule` — 100 tirages", async () => {
    for (let i = 0; i < 100; i++) {
      const v = vehiculeAuHasard();
      const ancienV = { ...versAncien(v), societeId: "s", vendu: false };
      const ecrits: { cle: string; obj: { lignes?: { designation: string; tva: number }[] } }[] = [];
      const champs: Record<string, { value: string }> = { venteAcheteur: { value: "Acheteur" }, venteDate: { value: "2026-09-25" }, ventePrix: { value: "5000" } };
      const f = compiler<() => Promise<void>>(["fmtDate", "libelleVehicule", "async confirmVendreVehicule"], [
        "document", "state", "window", "todayISO", "uid", "recharger", "renderTab", "showToast", "closeVendreVehiculeModal", "saveFailedMessage", "vendreVehiculeCtx",
      ])(
        { getElementById: (id: string) => champs[id] },
        { vehicules: [ancienV], societeId: "s" },
        { stSet: async (cle: string, obj: object) => (ecrits.push({ cle, obj }), true) },
        () => "2026-09-25",
        () => "f1",
        async () => undefined,
        () => undefined,
        () => undefined,
        () => undefined,
        () => "",
        v.id
      );
      await f();
      const ligne = ecrits.find((e) => e.cle.startsWith("facture:"))?.obj.lignes?.[0];
      expect(designationVente(v)).toBe(ligne?.designation);
      expect(tvaVenteParDefaut(v)).toBe(ligne?.tva);
    }
  });
});

describe("listes de choix du matériel", () => {
  const ETATS = constanteDe("ETATS_MATERIEL");

  it("états proposés : référentiel, sinon repli ; valeur courante réinjectée en tête", () => {
    for (let i = 0; i < 100; i++) {
      const declares = g.parmi([[], ["Neuf", "Usé"], ["Très bon", "À jeter"]]);
      const courant = g.parmi(["", "Neuf", "Cassé", "Bon état"]);
      const ancien = new Function(
        "referentielsDuDomaine",
        "jsAttr",
        "esc",
        `${ETATS}\n${sourceDe("etatMaterielOptions")}\nreturn etatMaterielOptions;`
      )(() => declares.map((libelle) => ({ libelle })), (s: string) => s, (s: string) => s) as (c: string) => string;
      const valeurs = [...ancien(courant).matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]);
      expect(etatsProposes(declares, courant || null)).toEqual(valeurs);
    }
  });

  it("catégories : déclarées puis employées (`referentielCompose`)", () => {
    const pool = ["Échafaudage", "echafaudage", "Outillage", " Levage ", "", null, "Perçage"];
    for (let i = 0; i < 200; i++) {
      const declares = Array.from({ length: g.entier(0, 3) }, () => g.parmi(pool));
      const employes = Array.from({ length: g.entier(0, 4) }, () => g.parmi(pool));
      expect(composerListe(declares, employes)).toEqual(referentielCompose(declares, employes));
    }
  });
});
