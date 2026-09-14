/**
 * PostgREST tronque une réponse trop longue sans le signaler : ni erreur, ni
 * marqueur. L'application recevait alors une collection amputée et continuait
 * comme si de rien n'était — totaux faux, enregistrements récents invisibles.
 *
 * Ces cas fixent la règle : reçu < total ⇒ refus, et le message doit dire quoi
 * faire. Le seuil exact du plafond n'entre pas en jeu, c'est justement ce qui
 * rend le garde-fou juste quel que soit le réglage.
 */

import { describe, it, expect } from "vitest";
import { refuserSiTronque } from "@/integrations/html-adapter";

describe("Troncature silencieuse des collections", () => {
  it("laisse passer un chargement entier", () => {
    expect(() => refuserSiTronque("bons_commande", 827, 827)).not.toThrow();
  });

  it("laisse passer une collection vide", () => {
    expect(() => refuserSiTronque("chantiers", 0, 0)).not.toThrow();
  });

  it("refuse une collection amputée", () => {
    expect(() => refuserSiTronque("bons_commande", 1000, 1247)).toThrow(
      /Chargement incomplet/
    );
  });

  it("refuse dès la première ligne manquante", () => {
    expect(() => refuserSiTronque("factures", 999, 1000)).toThrow();
  });

  it("nomme la table et les deux nombres", () => {
    expect(() => refuserSiTronque("facture_lignes", 1000, 3400)).toThrow(
      /facture_lignes.*1000.*3400/
    );
  });

  it("dit où relever le plafond", () => {
    expect(() => refuserSiTronque("devis", 1000, 1001)).toThrow(/Max rows/);
  });

  /* PostgREST ne renvoie de total que si on le demande. Sans total, on ne peut
     rien affirmer : se taire vaut mieux que refuser un chargement peut-être
     entier — le bruit ferait ignorer le garde-fou le jour où il a raison. */
  it("s'abstient quand le total est inconnu", () => {
    expect(() => refuserSiTronque("materiels", 1000, null)).not.toThrow();
  });

  /* Le total est calculé après la réponse : entre les deux, une insertion
     concurrente peut le faire dépasser ce qu'on a reçu sans qu'il y ait
     troncature. Ce cas ne doit pas bloquer l'application. */
  it("tolère un total inférieur à ce qui a été reçu", () => {
    expect(() => refuserSiTronque("reglements", 51, 50)).not.toThrow();
  });
});
