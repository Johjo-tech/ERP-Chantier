/**
 * Le délai de paiement et la date qu'il produit.
 *
 * Deux choses se jouent ici. D'abord le calendrier : `toISOString()` recule
 * d'un jour avant 1 h à Paris, et lire en local ce qu'on a construit en UTC
 * redonne le même décalage par l'autre bout. Les cas sont donc écrits en
 * chaînes, de bout en bout — si un fuseau s'invitait, ils tomberaient.
 *
 * Ensuite la distinction entre « pas paramétré » et « paiement à réception » :
 * `null` et `0` ne veulent pas dire la même chose, et un `||` les confondrait.
 */

import { describe, it, expect } from "vitest";
import {
  dateEcheance,
  delaiHorsPlafond,
  delaiPaiementRetenu,
  DELAI_PAIEMENT_DEFAUT_JOURS,
  libelleDelaiPaiement,
} from "@/api/regles-efacture";

const NET = (jours: number) => ({ jours, mode: "net" as const });
const FIN_DE_MOIS = (jours: number) => ({ jours, mode: "fin_de_mois" as const });

describe("La date d'échéance", () => {
  it("ajoute les jours à la date de facture", () => {
    expect(dateEcheance("2026-09-16", NET(30))).toBe("2026-10-16");
  });

  /* Le report de mois ne se code pas à la main : janvier + 30 jours tombe en
     mars, et février décide de la date. */
  it("franchit les mois sans se tromper de longueur", () => {
    expect(dateEcheance("2026-01-31", NET(30))).toBe("2026-03-02");
  });

  it("tient compte de l'année bissextile", () => {
    expect(dateEcheance("2028-01-31", NET(30))).toBe("2028-03-01");
  });

  /* « Fin de mois » compte depuis le dernier jour du mois de la facture, pas
     depuis le jour même : une facture du 15 janvier n'est pas due le 1er mars. */
  it("compte fin de mois depuis la fin du mois, pas depuis la facture", () => {
    expect(dateEcheance("2026-01-15", FIN_DE_MOIS(45))).toBe("2026-03-17");
    expect(dateEcheance("2026-01-31", FIN_DE_MOIS(45))).toBe("2026-03-17");
  });

  it("rend le dernier jour du mois quand le délai fin de mois est nul", () => {
    expect(dateEcheance("2026-02-03", FIN_DE_MOIS(0))).toBe("2026-02-28");
    expect(dateEcheance("2028-02-03", FIN_DE_MOIS(0))).toBe("2028-02-29");
  });

  it("rend la date de facture quand le délai net est nul", () => {
    expect(dateEcheance("2026-09-16", NET(0))).toBe("2026-09-16");
  });

  /* Le changement d'heure de Paris : si un fuseau intervenait quelque part,
     c'est ici que l'écart d'un jour apparaîtrait. */
  it("traverse le changement d'heure sans décaler", () => {
    expect(dateEcheance("2026-03-28", NET(1))).toBe("2026-03-29");
    expect(dateEcheance("2026-03-29", NET(1))).toBe("2026-03-30");
    expect(dateEcheance("2026-10-24", NET(1))).toBe("2026-10-25");
  });

  it("ne rend rien plutôt qu'une échéance inventée", () => {
    expect(dateEcheance("", NET(30))).toBe("");
    expect(dateEcheance(null, NET(30))).toBe("");
    expect(dateEcheance("pas une date", NET(30))).toBe("");
  });
});

describe("Le délai retenu", () => {
  const societe = { delaiPaiementJours: 45, modeDelaiPaiement: "fin_de_mois" };

  it("préfère celui du client", () => {
    expect(delaiPaiementRetenu({ delaiPaiementJours: 15, delaiPaiementMode: "net" }, societe))
      .toEqual({ jours: 15, mode: "net" });
  });

  it("retombe sur celui de la société quand le client n'est pas paramétré", () => {
    expect(delaiPaiementRetenu({ delaiPaiementJours: null }, societe))
      .toEqual({ jours: 45, mode: "fin_de_mois" });
    expect(delaiPaiementRetenu(null, societe)).toEqual({ jours: 45, mode: "fin_de_mois" });
  });

  /* Le cas qui justifie une colonne nullable : « paiement à réception » est un
     choix, pas une absence de choix. Un `||` le remplacerait par 45. */
  it("ne confond pas « paiement à réception » avec « pas paramétré »", () => {
    expect(delaiPaiementRetenu({ delaiPaiementJours: 0 }, societe))
      .toEqual({ jours: 0, mode: "net" });
  });

  it("retombe sur trente jours nets quand rien n'est paramétré", () => {
    expect(delaiPaiementRetenu(null, null))
      .toEqual({ jours: DELAI_PAIEMENT_DEFAUT_JOURS, mode: "net" });
  });

  it("ignore un mode inconnu plutôt que de le propager", () => {
    expect(delaiPaiementRetenu({ delaiPaiementJours: 30, delaiPaiementMode: "lunaire" }, null).mode)
      .toBe("net");
  });
});

describe("Ce que la facture annonce", () => {
  it("dit le délai en toutes lettres", () => {
    expect(libelleDelaiPaiement(NET(30))).toBe("30 jours net");
    expect(libelleDelaiPaiement(FIN_DE_MOIS(45))).toBe("45 jours fin de mois");
  });

  it("dit « à réception » plutôt que « 0 jours »", () => {
    expect(libelleDelaiPaiement(NET(0))).toBe("Paiement à réception");
    expect(libelleDelaiPaiement(FIN_DE_MOIS(0))).toBe("Paiement à réception");
  });
});

describe("Les plafonds de l'art. L441-10", () => {
  it("laisse passer ce qui est dans les clous", () => {
    expect(delaiHorsPlafond(NET(60))).toBeNull();
    expect(delaiHorsPlafond(FIN_DE_MOIS(45))).toBeNull();
  });

  /* Signalé, jamais bloqué : des dérogations sectorielles existent, et refuser
     l'enregistrement ferait perdre la saisie. */
  it("signale le dépassement sans l'interdire", () => {
    expect(delaiHorsPlafond(NET(61))).toContain("60 jours nets");
    expect(delaiHorsPlafond(FIN_DE_MOIS(46))).toContain("45 jours fin de mois");
  });
});
