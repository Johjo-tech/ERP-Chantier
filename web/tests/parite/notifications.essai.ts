/**
 * Parité de la cloche (TRV-09) contre `computeNotifications` de l'ancien écran,
 * dont la SOURCE est extraite de `app.js` et évaluée (D-045) avec les modules
 * qu'il appelle, importés tels quels (`alertes.ts`, `regles-documents-rh.ts`).
 *
 * Écarts assumés, vérifiés comme tels (D-CLI-06) : libellé des véhicules (plaque
 * au lieu de `nom`), une habilitation annoncée une fois (l'ancien la comptait
 * aussi comme document RH), bons dont les travaux sont finis écartés.
 */
import { describe, expect, it } from "vitest";
import * as ancienAlertes from "../../../src/integrations/alertes";
import * as ancienRh from "../../../src/api/regles-documents-rh";
import { todayISO } from "../../src/lib/dates";
import {
  notificationsActives,
  notificationsBonsEnRetard,
  notificationsDocumentsLegaux,
  notificationsDossierRh,
  notificationsRappels,
  notificationsSalarie,
  notificationsSousTraitants,
  notificationsVehicules,
} from "../../src/modules/notifications/domain/notifications";
import { alertesVehicule } from "../../src/modules/vehicules/domain/echeances";
import { SEUILS_DEFAUT } from "../../src/modules/societes/domain/reglages-societe";
import type { Vehicule } from "../../src/modules/vehicules/domain/vehicule";
import { constanteDe, sourceDe } from "./source-app";

const SOC = "soc-1";

/** Une date à `n` jours d'aujourd'hui, à Paris. */
function dans(n: number): string {
  const [a, m, j] = todayISO().split("-").map(Number) as [number, number, number];
  const d = new Date(Date.UTC(a, m - 1, j + n));
  return d.toISOString().slice(0, 10);
}

type Notif = { id: string; urgent: boolean; texte: string };

const ancienneCloche = new Function(
  "state",
  "window",
  `${["dateLocaleISO", "todayISO", "fmtDate", "joursAvant", "toutesLesHabilitations", "computeNotifications"].map((n) => sourceDe(n)).join("\n")}
   ${constanteDe("TYPE_HABILITATION")}
   function dossiersRhPrets(){ return true; }
   function seuilDocumentRh(){ return 30; }
   return computeNotifications();`
) as (state: unknown, window: unknown) => Notif[];

const fenetre = { ...ancienAlertes, etatDocumentRh: ancienRh.etatDocumentRh, libelleDocumentRh: ancienRh.libelleDocumentRh };

describe("parité de la cloche", () => {
  const salarie = { id: "s1", nom: "Martin", prenom: "Léa", actif: true, carteBtpValidite: dans(10), visiteMedicaleProchaine: dans(-2) };
  const inactif = { id: "s2", nom: "Durand", prenom: null, actif: false, carteBtpValidite: dans(1), visiteMedicaleProchaine: null };
  const docsRh = [
    { id: "d1", salarieId: "s1", type: "titreSejour", nom: "Titre de séjour", dateExpiration: dans(5) },
    { id: "d2", salarieId: "s1", type: "pieceIdentite", nom: null, fichierNom: "cni.pdf", dateExpiration: dans(-1) },
    { id: "d3", salarieId: "s1", type: "carteBtp", nom: "Carte", dateExpiration: dans(90) },
  ];
  const legaux = [
    { id: "l1", nom: "Kbis", type: "kbis", date_validite: dans(3) },
    { id: "l2", nom: null, type: "URSSAF", date_validite: dans(-4) },
    { id: "l3", nom: "Décennale", type: null, date_validite: dans(200) },
  ];
  const bons = [
    { id: "b1", numero_bc: "BC-1", client_nom: "OPH", date_fin_travaux: dans(-3), rappel_date: null, statut_workflow: "en_cours" },
    { id: "b2", numero_bc: null, client_nom: "Habitat 44", date_fin_travaux: dans(-1), rappel_date: dans(0), statut_workflow: null },
    { id: "b3", numero_bc: "BC-3", client_nom: "X", date_fin_travaux: dans(4), rappel_date: dans(-2), statut_workflow: "en_cours" },
  ];
  const sousTraitants = [{ id: "st1", nom: "Élec Pro" }];
  const docsSt = [
    { id: "sd1", sousTraitantId: "st1", type: "Kbis", dateValidite: dans(-5) },
    { id: "sd2", sousTraitantId: "st1", type: "URSSAF", dateValidite: dans(12) },
    { id: "sd3", sousTraitantId: "st1", type: "Assurance", dateValidite: dans(45) },
  ];

  const ancienEtat = {
    societeId: SOC,
    vehicules: [],
    salaries: [salarie, inactif].map((s) => ({ ...s, societeId: SOC })),
    documentsRh: docsRh,
    documents: legaux.map((d) => ({ id: d.id, nom: d.nom ?? undefined, type: d.type ?? undefined, dateValidite: d.date_validite, societeId: SOC })),
    bonsCommande: bons.map((b) => ({ id: b.id, numeroBC: b.numero_bc, client: b.client_nom, dateFinTravaux: b.date_fin_travaux, rappelDate: b.rappel_date, societeId: SOC })),
    sousTraitants: sousTraitants.map((s) => ({ ...s, societeId: SOC, documents: docsSt.filter((d) => d.sousTraitantId === s.id).map((d) => ({ id: d.id, type: d.type, dateExpiration: d.dateValidite })) })),
    settings: { [SOC]: { notifsTraitees: ["doc_l2"] } },
  };

  const aujourdhui = todayISO();
  const nouvelles = notificationsActives(
    [
      ...[salarie, inactif].flatMap((s) => notificationsSalarie(s, docsRh, SEUILS_DEFAUT, aujourdhui)),
      ...notificationsDocumentsLegaux(legaux, SEUILS_DEFAUT.documentLegal, aujourdhui),
      ...notificationsDossierRh(docsRh, [salarie, inactif], 30, aujourdhui),
      ...notificationsBonsEnRetard(bons, aujourdhui),
      ...notificationsSousTraitants(sousTraitants, docsSt, 30, aujourdhui),
      ...notificationsRappels(bons, aujourdhui),
    ],
    new Set(["doc_l2"])
  );
  const anciennes = ancienneCloche(ancienEtat, fenetre);

  it("mêmes alertes, mêmes textes, même ordre (urgentes d'abord, familles dans l'ordre)", () => {
    const vue = (n: Notif) => ({ id: n.id, urgent: n.urgent, texte: n.texte });
    expect(nouvelles.map(vue)).toEqual(anciennes.map(vue));
    expect(nouvelles.length).toBeGreaterThan(8);
  });

  it("« fait » est mémorisé par identifiant : l'alerte traitée ne revient pas", () => {
    expect(anciennes.some((n) => n.id === "doc_l2")).toBe(false);
    expect(nouvelles.some((n) => n.id === "doc_l2")).toBe(false);
  });

  it("écart assumé : une habilitation n'est annoncée qu'une fois (l'ancien la doublait en document RH)", () => {
    const hab = [{ id: "h1", salarieId: "s1", type: "habilitation", nom: "CACES R489", dateExpiration: dans(20) }];
    const ancien = ancienneCloche({ ...ancienEtat, documentsRh: hab, documents: [], bonsCommande: [], sousTraitants: [], settings: {} }, fenetre).map((n) => n.id);
    expect(ancien).toEqual(expect.arrayContaining(["hab_h1", "docrh_h1"]));
    const nouveau = [...notificationsSalarie(salarie, hab, SEUILS_DEFAUT, aujourdhui), ...notificationsDossierRh(hab, [salarie], 30, aujourdhui)].map((n) => n.id);
    expect(nouveau).toContain("hab_h1");
    expect(nouveau).not.toContain("docrh_h1");
  });

  it("écart assumé : un bon dont les travaux sont finis n'est plus « en retard »", () => {
    const facture = { id: "b9", numero_bc: "BC-9", client_nom: "Y", date_fin_travaux: dans(-30), rappel_date: null, statut_workflow: "facture" };
    const ancien = ancienneCloche({ ...ancienEtat, salaries: [], documentsRh: [], documents: [], sousTraitants: [], settings: {}, bonsCommande: [{ id: "b9", numeroBC: "BC-9", client: "Y", dateFinTravaux: facture.date_fin_travaux, societeId: SOC }] }, fenetre);
    expect(ancien.map((n) => n.id)).toEqual(["bc_retard_b9"]);
    expect(notificationsBonsEnRetard([facture], aujourdhui)).toEqual([]);
  });

  it("véhicules : mêmes identifiants et urgences que l'ancienne cloche pour les cartes", () => {
    const v = { id: "v1", vendu: false, immatriculation: "AB-123-CD", marque: null, modele: null, nom: null, date_controle_technique: null, carte_carburant_validite: dans(-1), telepeage_validite: dans(20) } as unknown as Vehicule;
    const ancien = ancienneCloche({ ...ancienEtat, vehicules: [{ id: "v1", societeId: SOC, carteCarburantValidite: v.carte_carburant_validite, telepeageValidite: v.telepeage_validite }], salaries: [], documentsRh: [], documents: [], bonsCommande: [], sousTraitants: [], settings: {} }, fenetre);
    const nouveau = notificationsActives(notificationsVehicules(alertesVehicule(v, SEUILS_DEFAUT, [], aujourdhui)), new Set());
    expect(nouveau.map((n) => [n.id, n.urgent])).toEqual(ancien.map((n) => [n.id, n.urgent]));
  });
});
