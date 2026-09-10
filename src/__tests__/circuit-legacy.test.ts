/**
 * Circuit de validation historique, rebranché sur la base.
 *
 * L'application porte son circuit sur `metiersFait`, `valideConducteur` et
 * `valideDirecteur`, qui n'ont aucune colonne : ils étaient perdus à chaque
 * enregistrement. Ces tests vérifient la traduction dans les deux sens.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as queries from "@/api/queries";
import { stGet, stListKeys, stSet } from "@/integrations/html-adapter";
import type { Uuid } from "@/api/types";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";

const suite = AUTH_DISPONIBLE ? describe : describe.skip;

/** Force la relecture depuis la base, cache vidé, comme un rechargement. */
async function relire(): Promise<Record<string, unknown>[]> {
  const cles = await stListKeys("bonCommande:");
  const bcs: Record<string, unknown>[] = [];
  for (const c of cles) {
    const v = (await stGet(c)) as Record<string, unknown> | null;
    if (v) bcs.push(v);
  }
  return bcs;
}

suite("Circuit de validation de l'app historique", () => {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  let societeId: Uuid;
  let bcId: Uuid;
  let cle: string;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    societeId = societe!.id;

    const bc = await queries.createBonCommande(societeId, {
      client_nom: "CLIENT DE TEST",
      date: aujourdhui,
      date_planifiee: aujourdhui,
      metiers: ["PEINTURE", "SOL"],
    });
    bcId = bc.id;
    cle = `bonCommande:${bcId}`;

    // Recharge la collection : c'est ce que fait l'app au démarrage
    await relire();
  });

  it("part d'un circuit vierge", async () => {
    const bc = (await stGet(cle)) as Record<string, unknown>;
    expect(bc.valideConducteur).toBeFalsy();
    expect(bc.valideDirecteur).toBeFalsy();
  });

  it("matérialise une tâche quand le technicien coche un métier", async () => {
    const bc = (await stGet(cle)) as Record<string, unknown>;
    await stSet(cle, { ...bc, metiersFait: { PEINTURE: true } });

    const taches = await queries.listTachesBonCommande(bcId);
    const peinture = taches.find((t) => t.metier === "PEINTURE");
    expect(peinture).toBeTruthy();
    expect(peinture!.statut).toBe("realisee");
  });

  /* L'équipe est choisie à la planification, sur le bon ; la tâche naît plus
     tard, au premier pointage. Si elle ne la reprend pas au passage, la garde
     « on ne déclare que les tâches de son équipe » n'a rien à lire — et c'est
     resté vrai pour les 627 tâches existantes, toutes sans équipe. */
  it("reprend l'équipe du bon sur la tâche qu'elle matérialise", async () => {
    /* Nom unique : l'équipe est retrouvée par son libellé, et deux équipes
       homonymes rendraient l'assertion dépendante de l'ordre de lecture. */
    const equipe = await queries.createTechnicien(societeId, {
      nom: `Équipe reprise ${Date.now()}`,
      metier: "PLOMBERIE",
    });

    const bc2 = await queries.createBonCommande(societeId, {
      client_nom: "CLIENT DE TEST",
      date: aujourdhui,
      date_planifiee: aujourdhui,
      metiers: ["PLOMBERIE"],
      technicien: equipe.nom,
    });
    await relire();

    const brut = (await stGet(`bonCommande:${bc2.id}`)) as Record<string, unknown>;
    await stSet(`bonCommande:${bc2.id}`, { ...brut, metiersFait: { PLOMBERIE: true } });

    const taches = await queries.listTachesBonCommande(bc2.id);
    expect(taches[0]?.technicien_id).toBe(equipe.id);
  });

  it("ne valide pas le conducteur tant qu'un métier reste ouvert", async () => {
    const bc = (await relire()).find((b) => b.id === bcId)!;
    // PEINTURE faite, SOL pas encore : le stepper reste à l'étape 1
    expect(bc.valideConducteur).toBe(false);
    expect((bc.metiersFait as Record<string, boolean>).PEINTURE).toBe(true);
  });

  it("refuse la validation conducteur tant qu'un métier n'est pas pointé", async () => {
    /* PEINTURE est pointée, SOL non. C'est le cas d'une affaire multi-métiers
       confiée à deux équipes — 43 bons sont dans cette configuration. */
    await expect(queries.validerAffaireConducteur(bcId)).rejects.toThrow(/SOL/);

    const taches = await queries.listTachesBonCommande(bcId);
    expect(taches.some((t) => t.statut === "validee")).toBe(false);
  });

  it("n'avance plus rien sur un simple enregistrement du drapeau conducteur", async () => {
    const bc = (await stGet(cle)) as Record<string, unknown>;
    await stSet(cle, { ...bc, valideConducteur: true });

    const taches = await queries.listTachesBonCommande(bcId);
    expect(taches.some((t) => t.statut === "validee")).toBe(false);
  });

  it("valide toute l'affaire d'un coup une fois tous les métiers pointés", async () => {
    const bc = (await stGet(cle)) as Record<string, unknown>;
    await stSet(cle, { ...bc, metiersFait: { PEINTURE: true, SOL: true } });

    await queries.validerAffaireConducteur(bcId);

    const taches = await queries.listTachesBonCommande(bcId);
    expect(taches).toHaveLength(2);
    expect(taches.every((t) => t.statut === "validee")).toBe(true);
  });

  it("relit l'état depuis la base, et non depuis l'objet enregistré", async () => {
    const bc = (await relire()).find((b) => b.id === bcId)!;
    expect(bc.valideConducteur).toBe(true);
    expect(bc.dateValideConducteur).toBeTruthy();
    expect(bc.dateOrigineFait).toBe(true);
  });

  it("n'avance plus le bon sur un simple enregistrement du drapeau directeur", async () => {
    /* La signature du directeur engage le montant facturé : elle exige des
       contrôles dont l'échec doit être montré. La déclencher depuis un
       enregistrement générique revenait à avaler le refus et à annoncer un
       succès qui n'avait pas eu lieu. */
    const bc = (await stGet(cle)) as Record<string, unknown>;
    await stSet(cle, { ...bc, valideDirecteur: true });

    const enBase = await queries.getBonCommande(bcId);
    expect(enBase?.statut_workflow ?? "en_cours").toBe("en_cours");
  });

  it("fait avancer le bon quand le directeur valide explicitement", async () => {
    await queries.validerChiffrage(bcId);

    const enBase = await queries.getBonCommande(bcId);
    expect(enBase?.statut_workflow).toBe("chiffre");

    expect((await relire()).find((b) => b.id === bcId)!.valideDirecteur).toBe(true);
  });

  it("ne génère aucune facture : elle reste au geste de la secrétaire", async () => {
    const factures = await queries.listFactures(societeId);
    expect(factures.some((f) => f.bon_commande_id === bcId)).toBe(false);
  });
});

/**
 * Ce que le directeur ne doit pas pouvoir franchir.
 *
 * Le verrou existait déjà côté base, mais l'écran l'avalait : un bon a atteint
 * `chiffre` en production alors qu'une de ses tâches n'était pas arbitrée.
 */
suite("Refus de la validation directeur", () => {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  let societeId: Uuid;
  let bcTacheEnAttente: Uuid;
  let bcSansTache: Uuid;
  let bcTravailAChiffrer: Uuid;
  let travailId: Uuid;

  /** Bon neuf portant une tâche laissée dans l'état demandé. */
  async function bonAvecTache(statut: "realisee" | "validee"): Promise<Uuid> {
    const bc = await queries.createBonCommande(societeId, {
      client_nom: "CLIENT DE TEST",
      date: aujourdhui,
      metiers: ["PEINTURE"],
    });
    const tache = await queries.planifierTache(societeId, {
      bon_commande_id: bc.id,
      libelle: "Peinture",
      date_tache: aujourdhui,
      metier: "PEINTURE",
    });
    await queries.marquerRealisee(tache.id);
    if (statut === "validee") await queries.validerTache(tache.id, true);
    return bc.id;
  }

  /* Les trois dossiers sont montés en parallèle : chacun coûte plusieurs
     allers-retours réseau, les enchaîner triplerait la durée de la suite. */
  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    societeId = societe!.id;

    const [enAttente, sansTache, avecTravail] = await Promise.all([
      bonAvecTache("realisee"),
      queries
        .createBonCommande(societeId, { client_nom: "CLIENT DE TEST", date: aujourdhui })
        .then((bc) => bc.id),
      bonAvecTache("validee"),
    ]);
    bcTacheEnAttente = enAttente;
    bcSansTache = sansTache;
    bcTravailAChiffrer = avecTravail;

    const travail = await queries.ajouterTravailSupplementaire(societeId, {
      bon_commande_id: bcTravailAChiffrer,
      libelle: "Remplacement du siphon",
      origine: "technicien",
    });
    travailId = travail.id;
  });

  it("refuse tant qu'une tâche n'est pas validée, et nomme laquelle", async () => {
    await expect(queries.validerChiffrage(bcTacheEnAttente)).rejects.toThrow(/Peinture/);

    const enBase = await queries.getBonCommande(bcTacheEnAttente);
    expect(enBase?.statut_workflow ?? "en_cours").toBe("en_cours");
  });

  it("refuse un bon sans aucune tâche", async () => {
    // La base laisse passer ce cas : aucune tâche restante, donc aucune en attente
    await expect(queries.validerChiffrage(bcSansTache)).rejects.toThrow(/tâche/i);
  });

  it("refuse tant qu'un travail supplémentaire reste à chiffrer", async () => {
    await expect(queries.validerChiffrage(bcTravailAChiffrer)).rejects.toThrow(/siphon/i);
  });

  it("laisse passer une fois ce travail chiffré", async () => {
    await queries.chiffrerTravailSupplementaire(travailId, 85);
    await queries.validerChiffrage(bcTravailAChiffrer);

    const enBase = await queries.getBonCommande(bcTravailAChiffrer);
    expect(enBase?.statut_workflow).toBe("chiffre");
  });
});

suite("Commande de pièces", () => {
  /**
   * L'app signale la pièce sur le bon de commande (`pieceACommander`), la base
   * la porte sur la tâche (`planning_taches.piece_*`). Sans traduction, tout le
   * circuit pièces reste muet : rien n'arrive dans « Pièces en commande ».
   */
  const aujourdhui = new Date().toISOString().slice(0, 10);
  let bcId: Uuid;
  let cle: string;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    const bc = await queries.createBonCommande(societe!.id, {
      client_nom: "CLIENT DE TEST",
      date: aujourdhui,
      date_planifiee: aujourdhui,
      metiers: ["PLOMBERIE"],
    });
    bcId = bc.id;
    cle = `bonCommande:${bcId}`;
    await relire();
  });

  it("enregistre la pièce signalée par le technicien", async () => {
    const bc = (await stGet(cle)) as Record<string, unknown>;
    await stSet(cle, {
      ...bc,
      pieceACommander: true,
      pieceACommanderDetail: "Mitigeur thermostatique Grohe",
      technicienCommentaire: "Fuite au niveau du raccord",
    });

    const taches = await queries.listTachesBonCommande(bcId);
    expect(taches).toHaveLength(1);
    expect(taches[0].piece_a_commander).toBe(true);
    expect(taches[0].piece_description).toBe("Mitigeur thermostatique Grohe");
    expect(taches[0].commentaire).toBe("Fuite au niveau du raccord");
  });

  it("remonte la pièce au rechargement, pour l'onglet Pièces en commande", async () => {
    const bc = (await relire()).find((b) => b.id === bcId)!;
    expect(bc.pieceACommander).toBe(true);
    expect(bc.pieceACommanderDetail).toBe("Mitigeur thermostatique Grohe");
    expect(bc.technicienCommentaire).toBe("Fuite au niveau du raccord");
  });

  it("enregistre le fournisseur et la date de commande", async () => {
    const bc = (await stGet(cle)) as Record<string, unknown>;
    await stSet(cle, {
      ...bc,
      pieceACommanderFournisseur: "Cedeo",
      pieceACommanderDateCommande: aujourdhui,
    });

    const relu = (await relire()).find((b) => b.id === bcId)!;
    expect(relu.pieceACommanderFournisseur).toBe("Cedeo");
    expect(relu.pieceACommanderDateCommande).toBe(aujourdhui);
  });

  it("lève le signalement quand la pièce est arrivée", async () => {
    const bc = (await stGet(cle)) as Record<string, unknown>;
    await stSet(cle, { ...bc, pieceACommander: false });

    const relu = (await relire()).find((b) => b.id === bcId)!;
    expect(relu.pieceACommander).toBe(false);
  });
});

suite("Circuit sous-traitant", () => {
  /**
   * L'app désigne le sous-traitant par son nom et pose les dates
   * supplémentaires sur le bon. La base référence un uuid sur la tâche, et
   * traite chaque date comme une tâche de plus.
   */
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const demain = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  let societeId: Uuid;
  let bcId: Uuid;
  let cle: string;
  let nomST: string | null = null;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    societeId = societe!.id;

    const sts = await queries.listSousTraitants(societeId);
    nomST = sts[0]?.nom ?? null;

    const bc = await queries.createBonCommande(societeId, {
      client_nom: "CLIENT DE TEST",
      date: aujourdhui,
      date_planifiee: aujourdhui,
      metiers: ["ETANCHEITE"],
    });
    bcId = bc.id;
    cle = `bonCommande:${bcId}`;
    await relire();
  });

  it("crée une tâche par journée quand on ajoute une date", async () => {
    const bc = (await stGet(cle)) as Record<string, unknown>;
    await stSet(cle, {
      ...bc,
      metiersFait: { ETANCHEITE: true },
      datesSupplementaires: [{ date: demain, heure: "08:00", duree: 2 }],
    });

    const taches = await queries.listTachesBonCommande(bcId);
    expect(taches.map((t) => t.date_tache).sort()).toEqual([aujourdhui, demain]);
  });

  it("relit la date supplémentaire, sans confondre avec la date d'origine", async () => {
    const bc = (await relire()).find((b) => b.id === bcId)!;
    const dates = bc.datesSupplementaires as { date: string; fait: boolean }[];
    expect(dates).toHaveLength(1);
    expect(dates[0].date).toBe(demain);
    // La journée d'origine est pointée, la supplémentaire non
    expect(dates[0].fait).toBe(false);
  });

  it("assigne le sous-traitant par son nom", async () => {
    if (!nomST) return; // aucune fiche sous-traitant dans cette société
    const bc = (await stGet(cle)) as Record<string, unknown>;
    await stSet(cle, { ...bc, sousTraitant: nomST });

    const taches = await queries.listTachesBonCommande(bcId);
    expect(taches.every((t) => t.sous_traitant_id)).toBe(true);

    const relu = (await relire()).find((b) => b.id === bcId)!;
    expect(relu.sousTraitant).toBe(nomST);
  });

  it("ignore un sous-traitant inconnu plutôt que d'écrire n'importe quoi", async () => {
    const bc = (await stGet(cle)) as Record<string, unknown>;
    await stSet(cle, { ...bc, sousTraitant: "ENTREPRISE QUI N'EXISTE PAS" });

    const relu = (await relire()).find((b) => b.id === bcId)!;
    expect(relu.sousTraitant).not.toBe("ENTREPRISE QUI N'EXISTE PAS");
  });
});

/**
 * Les réglages de la société sont répartis entre les colonnes de `societes` et
 * le jsonb `infos_entreprise`, selon une liste blanche fermée. Un champ qui n'y
 * figure pas part dans le jsonb **sans avertissement** : la donnée paraît
 * enregistrée, et la colonne reste NULL. C'est le seul endroit du pont où une
 * erreur est silencieuse, donc le seul qui exige une vérification en base.
 */
suite("Réglages de la société — identité légale", () => {
  const cle = `settings:${TEST_SOCIETE_CODE}`;
  let initial: Record<string, unknown>;
  let societeId: Uuid;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    societeId = societe!.id;
    initial = ((await stGet(cle)) as Record<string, unknown>) ?? {};
  });

  afterAll(async () => {
    // On rend les réglages dans l'état où on les a trouvés
    await stSet(cle, initial);
  });

  it("écrit l'identité légale dans les colonnes, pas dans le jsonb", async () => {
    await stSet(cle, {
      ...initial,
      siren: "840320014",
      tvaIntracom: "FR88840320014",
      raisonSocialeLegale: "KTA PLOMBERIE SAS",
      adresseElectroniqueSchema: "0009",
      adresseElectroniqueValeur: "84032001400029",
      iban: "FR7630006000011234567890189",
    });

    const societe = await queries.getSociete(societeId);
    expect(societe?.siren).toBe("840320014");
    expect(societe?.tva_intracom).toBe("FR88840320014");
    expect(societe?.raison_sociale_legale).toBe("KTA PLOMBERIE SAS");
    expect(societe?.adresse_electronique_valeur).toBe("84032001400029");
    expect(societe?.iban).toBeTruthy();
  });

  it("convertit les nombres et les booléens, qu'un champ de saisie rend en texte", async () => {
    await stSet(cle, {
      ...initial,
      capitalSocial: "5000",
      indemniteRecouvrement: "40",
      tvaSurEncaissements: true,
      autoliquidationBatiment: false,
    });

    const societe = await queries.getSociete(societeId);
    expect(societe?.capital_social).toBe(5000);
    expect(societe?.indemnite_recouvrement).toBe(40);
    expect(societe?.tva_sur_encaissements).toBe(true);
    expect(societe?.autoliquidation_batiment).toBe(false);
  });

  it("relit ce qu'il a écrit", async () => {
    const relu = (await stGet(cle)) as Record<string, unknown>;
    expect(relu.capitalSocial).toBe(5000);
    expect(relu.tvaSurEncaissements).toBe(true);
  });

  it("écrit le régime de TVA et la périodicité d'e-reporting", async () => {
    /* Deux colonnes `text` sans contrainte CHECK — vérifié sur le schéma réel.
       `ereporting_regime` valait « mensuel » partout par simple défaut de
       colonne, jamais par un choix. */
    await stSet(cle, {
      ...initial,
      regimeTva: "franchise_en_base",
      ereportingRegime: "annuel",
    });

    const societe = await queries.getSociete(societeId);
    expect(societe?.regime_tva).toBe("franchise_en_base");
    expect(societe?.ereporting_regime).toBe("annuel");
  });

  it("laisse un champ vide devenir NULL, pas la chaîne vide", async () => {
    await stSet(cle, { ...initial, rcsVille: "" });
    const societe = await queries.getSociete(societeId);
    expect(societe?.rcs_ville).toBeNull();
  });
});

/**
 * Instantané d'identité sur la facture.
 *
 * L'en-tête était recomposé à l'impression depuis les réglages courants :
 * changer le SIRET de la société réécrivait rétroactivement l'en-tête de toutes
 * les factures déjà émises. Ces colonnes existaient et n'étaient jamais écrites.
 */
suite("Identité figée sur la facture", () => {
  let societeId: Uuid;
  let factureId: Uuid;
  const aSupprimer: Uuid[] = [];

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    societeId = societe!.id;
    factureId = crypto.randomUUID();
    aSupprimer.push(factureId);
  });

  /* Ces factures n'ont aucune valeur métier : les laisser polluerait l'écran
     Factures à chaque exécution. Aucun numéro de série n'a été consommé. */
  afterAll(async () => {
    for (const id of aSupprimer) {
      await queries.deleteFacture(id).catch((err) => {
        console.error("Nettoyage de la facture de test impossible", id, err);
      });
    }
  });

  it("écrit l'identité des deux parties dans leurs colonnes", async () => {
    /* Numéro fourni explicitement : le test ne doit pas consommer un numéro de
       la série, ils ne sont jamais réattribués. */
    const ok = await stSet(`facture:${factureId}`, {
      id: factureId,
      societeId: TEST_SOCIETE_CODE,
      numero: `TEST-IDENTITE-${Date.now()}`,
      client: "CLIENT DE TEST",
      date: new Date().toISOString().slice(0, 10),
      verrouillee: true,
      emetteurNom: "KTA PLOMBERIE SAS",
      emetteurSiret: "88898282400011",
      emetteurSiren: "888982824",
      emetteurTvaIntracom: "FR26888982824",
      clientSiret: "84032001400029",
      clientTvaIntracom: "FR88840320014",
      cadreFacturation: "B2B_national",
    });
    expect(ok).toBe(true);

    const f = await queries.getFacture(factureId);
    expect(f?.emetteur_nom).toBe("KTA PLOMBERIE SAS");
    expect(f?.emetteur_siret).toBe("88898282400011");
    expect(f?.emetteur_tva_intracom).toBe("FR26888982824");
    expect(f?.client_siret).toBe("84032001400029");
    expect(f?.cadre_facturation).toBe("B2B_national");
  });

  it("relit l'instantané en camelCase", async () => {
    const relu = (await stGet(`facture:${factureId}`)) as Record<string, unknown>;
    expect(relu.emetteurSiret).toBe("88898282400011");
    expect(relu.clientTvaIntracom).toBe("FR88840320014");
  });

  it("n'invente rien sur une facture jamais émise", async () => {
    const brouillon = crypto.randomUUID();
    aSupprimer.push(brouillon);
    await stSet(`facture:${brouillon}`, {
      id: brouillon,
      societeId: TEST_SOCIETE_CODE,
      numero: `TEST-BROUILLON-${Date.now()}`,
      client: "CLIENT DE TEST",
      date: new Date().toISOString().slice(0, 10),
    });

    const f = await queries.getFacture(brouillon);
    expect(f?.emetteur_siret).toBeNull();
  });
});
