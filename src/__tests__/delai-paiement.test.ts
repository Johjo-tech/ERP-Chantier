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
  DELAIS_PREREGLES,
  delaiPreregle,
  delaiDeLaCle,
  MODES_REGLEMENT,
  MODE_REGLEMENT_DEFAUT,
  modeReglementRetenu,
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

/*
 * Les conditions telles qu'elles se choisissent : une liste nommée, et ce
 * qu'elle produit réellement sur le calendrier.
 */
describe("Les délais préréglés", () => {
  it("propose les sept conditions attendues, dans l'ordre", () => {
    expect(DELAIS_PREREGLES.map((d) => d.libelle)).toEqual([
      "À réception",
      "Net 30 jours",
      "Net 45 jours",
      "Net 60 jours",
      "30 jours fin de mois",
      "45 jours fin de mois",
      "60 jours fin de mois",
    ]);
  });

  /* Le tableau dit ce que chaque entrée donne le 15 janvier 2026. C'est le
     contrôle qui attrape une inversion jours/mode dans la liste. */
  it.each([
    ["reception", "2026-01-15"],
    ["net30", "2026-02-14"],
    ["net45", "2026-03-01"],
    ["net60", "2026-03-16"],
    ["fdm30", "2026-03-02"],
    ["fdm45", "2026-03-17"],
    ["fdm60", "2026-04-01"],
  ])("« %s » échoit le %s pour une facture du 15 janvier 2026", (cle, attendue) => {
    expect(dateEcheance("2026-01-15", delaiDeLaCle(cle)!)).toBe(attendue);
  });

  /* Février décide : 28 jours, 29 en bissextile. Une facture de février à
     « 30 jours fin de mois » ne tombe donc pas au même jour selon l'année. */
  it("suit la longueur réelle de février", () => {
    expect(dateEcheance("2026-02-10", delaiDeLaCle("fdm30")!)).toBe("2026-03-30");
    expect(dateEcheance("2028-02-10", delaiDeLaCle("fdm30")!)).toBe("2028-03-30");
    expect(dateEcheance("2026-02-10", delaiDeLaCle("net30")!)).toBe("2026-03-12");
    expect(dateEcheance("2028-02-10", delaiDeLaCle("net30")!)).toBe("2028-03-11");
  });

  it("reconnaît un délai qui correspond à une entrée", () => {
    expect(delaiPreregle({ jours: 45, mode: "fin_de_mois" })?.cle).toBe("fdm45");
    expect(delaiPreregle({ jours: 0, mode: "net" })?.cle).toBe("reception");
  });

  /* Un délai hors liste — 21 jours — ne doit pas se faire ramener à l'entrée
     la plus proche : l'écran doit pouvoir afficher « autre » et le conserver. */
  it("ne rapproche pas un délai hors liste de son voisin", () => {
    expect(delaiPreregle({ jours: 21, mode: "net" })).toBeNull();
    expect(delaiPreregle({ jours: 30, mode: "fin_de_mois" })?.cle).not.toBe("net30");
    expect(delaiPreregle(null)).toBeNull();
  });

  it("ne devine rien à partir d'une clé inconnue", () => {
    expect(delaiDeLaCle("net90")).toBeNull();
    expect(delaiDeLaCle("")).toBeNull();
    expect(delaiDeLaCle(null)).toBeNull();
  });

  /* Chaque entrée doit se nommer comme la facture l'annoncera : deux libellés
     pour une même condition sèmeraient le doute sur le document. */
  it("chaque entrée se dit de la même façon sur la facture", () => {
    expect(libelleDelaiPaiement(delaiDeLaCle("reception")!)).toBe("Paiement à réception");
    expect(libelleDelaiPaiement(delaiDeLaCle("net45")!)).toBe("45 jours net");
    expect(libelleDelaiPaiement(delaiDeLaCle("fdm60")!)).toBe("60 jours fin de mois");
  });
});

describe("Le mode de règlement", () => {
  it("propose les cinq moyens demandés", () => {
    expect(MODES_REGLEMENT.map((m) => m.libelle)).toEqual([
      "Virement",
      "Chèque",
      "Prélèvement",
      "Carte bancaire",
      "Espèces",
    ]);
  });

  /* Les codes sont ceux de l'énumération `mode_paiement` déjà en base : un
     code inventé ici ferait rejeter l'enregistrement de la facture entière. */
  it("n'emploie que des codes que la base accepte", () => {
    const admis = ["virement", "cheque", "especes", "carte", "prelevement", "traite", "autre"];
    for (const m of MODES_REGLEMENT) expect(admis).toContain(m.code);
  });

  it("retombe sur le virement quand rien n'est convenu", () => {
    expect(modeReglementRetenu(null)).toBe(MODE_REGLEMENT_DEFAUT);
    expect(modeReglementRetenu("")).toBe("virement");
    expect(modeReglementRetenu("  ")).toBe("virement");
  });

  it("respecte le moyen convenu", () => {
    expect(modeReglementRetenu("cheque")).toBe("cheque");
  });
});
