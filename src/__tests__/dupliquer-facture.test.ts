/**
 * Ce qu'une facture dupliquée doit — et surtout ne doit pas — emporter.
 *
 * Une facture émise ne se modifie plus (art. L441-9) : refacturer les mêmes
 * prestations au même client obligeait à tout ressaisir. La copie doit naître
 * brouillon, sans numéro, à la date du jour, et laisser derrière elle ce qui
 * appartient à l'original : son numéro, ses liens d'origine et son cadenas.
 *
 * Le piège qui justifie ce test : recopier `lignes` par référence. Les deux
 * factures auraient alors partagé le même tableau, et modifier l'une aurait
 * modifié l'autre sans que rien ne le signale.
 *
 * La fonction est extraite de `src/pages/app.js` et évaluée : une copie
 * passerait au vert pendant que le code livré diverge.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { dateEcheance } from "@/api/regles-efacture";

const SOURCE = readFileSync(resolve(__dirname, "../pages/app.js"), "utf8");

function extraire(entete: string, nom: string): string {
  const debut = SOURCE.indexOf(`\n${entete} ${nom}(`);
  if (debut < 0) throw new Error(`\`${nom}\` introuvable dans src/pages/app.js`);
  const fin = SOURCE.indexOf("\n}", debut);
  if (fin < 0) throw new Error(`fin de \`${nom}\` introuvable dans src/pages/app.js`);
  return SOURCE.slice(debut, fin + 2);
}

const AUJOURD_HUI = "2026-09-21";

interface Ligne {
  id?: string;
  designation: string;
  qte: number;
  prixUnitaire: number;
  tva: number;
  metier?: string | null;
}

interface FactureEcran {
  id: string;
  societeId: string;
  numero: string;
  typeDocument?: string;
  statut?: string;
  verrouillee?: boolean;
  client: string;
  adresse?: string;
  chantierId?: string | null;
  devisId?: string | null;
  interventionId?: string | null;
  bonCommandeId?: string | null;
  logementStatut?: string;
  occupant?: string;
  remisePourcentage?: number;
  delaiPaiementJours?: number | null;
  delaiPaiementMode?: string | null;
  conditionsReglement?: string;
  conducteurId?: string | null;
  conducteur?: string;
  emetteurNom?: string;
  pdpIdentifiant?: string;
  lignes: Ligne[];
}

interface Banc {
  dupliquerFacture: (id: string) => Promise<void>;
  ecrites: Record<string, Record<string, unknown>>;
  ouverte: Record<string, unknown> | null;
  toasts: { texte: string; ton?: string }[];
}

function chargerBanc(factures: FactureEcran[]): Banc {
  const ecrites: Record<string, Record<string, unknown>> = {};
  const toasts: { texte: string; ton?: string }[] = [];
  let ouverte: Record<string, unknown> | null = null;
  const state = { factures };

  const corps = [
    extraire("async function", "dupliquerFacture"),
    extraire("function", "conducteurRepris"),
    extraire("function", "cleanLogementFields"),
  ].join("\n");

  const fabrique = new Function(
    "state",
    "window",
    "uid",
    "todayISO",
    "showToast",
    "saveFailedMessage",
    "recharger",
    "openForm",
    "JSON",
    `${corps}; return dupliquerFacture;`
  );

  let n = 0;
  const dupliquerFacture = fabrique(
    state,
    {
      estAvoir: (t: string) => t === "avoir",
      dateEcheance,
      stSet: async (cle: string, valeur: Record<string, unknown>) => {
        ecrites[cle] = valeur;
        state.factures.push(valeur as unknown as FactureEcran);
        return true;
      },
    },
    () => `copie-${++n}`,
    () => AUJOURD_HUI,
    (texte: string, ton?: string) => { toasts.push({ texte, ton }); },
    () => "échec",
    async () => {},
    (_type: string, prefill: Record<string, unknown>) => { ouverte = prefill; },
    JSON
  );

  return {
    dupliquerFacture,
    ecrites,
    toasts,
    get ouverte() { return ouverte; },
  } as Banc;
}

const originale = (): FactureEcran => ({
  id: "f1",
  societeId: "kta",
  numero: "FAC-2026-000042",
  typeDocument: "facture",
  statut: "impayée",
  verrouillee: true,
  client: "Bailleur Social",
  adresse: "3 avenue du Parc",
  chantierId: "ch1",
  devisId: "d1",
  interventionId: "i1",
  bonCommandeId: "bc1",
  logementStatut: "occupé",
  occupant: "M. Dupont",
  remisePourcentage: 5,
  delaiPaiementJours: 45,
  delaiPaiementMode: "fin_de_mois",
  conditionsReglement: "45 jours fin de mois",
  conducteurId: "c1",
  conducteur: "Karim",
  emetteurNom: "Société au jour de l'émission",
  pdpIdentifiant: "PDP-123",
  lignes: [
    { id: "l1", designation: "Pose", qte: 2, prixUnitaire: 100, tva: 20, metier: "PEINTURE" },
    { id: "l2", designation: "Dépose", qte: 1, prixUnitaire: 50, tva: 10 },
  ],
});

describe("Dupliquer une facture", () => {
  let banc: Banc;
  let copie: Record<string, unknown>;

  beforeEach(async () => {
    banc = chargerBanc([originale()]);
    await banc.dupliquerFacture("f1");
    copie = banc.ecrites["facture:copie-1"];
  });

  it("écrit bien une nouvelle facture", () => {
    expect(copie).toBeDefined();
    expect(copie.id).toBe("copie-1");
  });

  it("naît brouillon et sans numéro — la série ne se consomme qu'à l'émission", () => {
    expect(copie.numero).toBe("");
    expect(copie.statut).toBe("brouillon");
  });

  it("porte la date du jour", () => {
    expect(copie.date).toBe(AUJOURD_HUI);
  });

  it("recalcule l'échéance depuis aujourd'hui, sans recopier l'ancienne", () => {
    /* Recopier l'échéance de l'original livrerait un document déjà en retard. */
    expect(copie.echeance).toBe(
      dateEcheance(AUJOURD_HUI, { jours: 45, mode: "fin_de_mois" })
    );
  });

  it("reprend client, chantier, remise et conditions", () => {
    expect(copie.client).toBe("Bailleur Social");
    expect(copie.chantierId).toBe("ch1");
    expect(copie.remisePourcentage).toBe(5);
    expect(copie.conditionsReglement).toBe("45 jours fin de mois");
  });

  it("reprend les lignes, désignations et prix compris", () => {
    const lignes = copie.lignes as Ligne[];
    expect(lignes).toHaveLength(2);
    expect(lignes[0].designation).toBe("Pose");
    expect(lignes[0].prixUnitaire).toBe(100);
    expect(lignes[0].metier).toBe("PEINTURE");
  });

  it("laisse tomber les identifiants de ligne de l'original", () => {
    /* Les garder rattacherait les lignes copiées à l'ancienne facture. */
    for (const l of copie.lignes as Ligne[]) expect(l.id).toBeUndefined();
  });

  it("copie les lignes en PROFONDEUR", () => {
    /* Partager le tableau ferait changer les deux factures d'un seul geste. */
    const source = originale();
    const banc2 = chargerBanc([source]);
    return banc2.dupliquerFacture("f1").then(() => {
      const copiees = banc2.ecrites["facture:copie-1"].lignes as Ligne[];
      copiees[0].designation = "Modifiée sur la copie";
      copiees[0].qte = 99;

      expect(source.lignes[0].designation).toBe("Pose");
      expect(source.lignes[0].qte).toBe(2);
    });
  });

  it("coupe les liens d'origine", () => {
    /* Garder `bonCommandeId` ferait voir le bon comme facturé deux fois, et
       le verrou du bon facturé s'y tromperait. */
    expect(copie.devisId).toBeNull();
    expect(copie.interventionId).toBeNull();
    expect(copie.bonCommandeId).toBeNull();
  });

  it("n'emporte ni le cadenas d'écran ni le suivi de plateforme", () => {
    expect(copie.verrouillee).toBe(false);
    expect(copie.pdpIdentifiant).toBeUndefined();
    expect(copie.emetteurNom).toBeUndefined();
  });

  it("garde le conducteur par sa référence, jamais par son nom seul", () => {
    expect(copie.conducteurId).toBe("c1");
  });

  it("ouvre le brouillon créé", () => {
    expect(banc.ouverte).not.toBeNull();
    expect((banc.ouverte as Record<string, unknown>).id).toBe("copie-1");
  });
});

describe("Dupliquer un avoir", () => {
  it("est refusé : un avoir rectifie une facture précise", async () => {
    const avoir = { ...originale(), id: "a1", typeDocument: "avoir", numero: "AV-2026-000003" };
    const banc = chargerBanc([avoir]);

    await banc.dupliquerFacture("a1");

    expect(Object.keys(banc.ecrites)).toHaveLength(0);
    expect(banc.toasts.at(-1)?.ton).toBe("danger");
  });
});
