/**
 * Le retour au planning quand la pièce arrive.
 *
 * Trois défauts se cachaient derrière un seul symptôme — « la vignette ne
 * revient pas dans Non planifiés » — et chacun a son test ici :
 *
 *   B. on lisait le drapeau sur n'importe quelle tâche et on le levait sur la
 *      première, d'une requête non triée : sur un bon à plusieurs tâches, la
 *      pièce restait en commande ;
 *   C. un bon dont le technicien avait pointé sa journée revenait au planning
 *      sans pouvoir être déplacé — un cul-de-sac ;
 *   et le refus d'une affaire déjà arbitrée, qui doit s'expliquer avant
 *      l'aller-retour plutôt que de remonter en code SQL.
 *
 * Aucun de ces tests ne touche la base.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  cibleAPoserLaPiece,
  ciblesALeverLaPiece,
  refusRetourAuPlanning,
} from "@/api/regles-taches";
import {
  datesSupplementairesDuBon,
  etatPieceDuBon,
  type TacheBC,
} from "@/integrations/html-adapter";

/** Une tâche du circuit, dont on ne précise que ce qui compte au cas d'espèce. */
function tache(partie: Partial<TacheBC>): TacheBC {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    bon_commande_id: null,
    metier: null,
    statut: "planifiee",
    validee_le: null,
    realisee_le: null,
    commentaire: null,
    croquis: null,
    piece_a_commander: null,
    piece_description: null,
    piece_fournisseur: null,
    piece_date_commande: null,
    piece_recue_le: null,
    sous_traitant_id: null,
    date_tache: null,
    ...partie,
  };
}

describe("Le refus de replanifier", () => {
  it("laisse passer un bon dont aucune tâche n'est arbitrée", () => {
    const taches = [
      { metier: "PEINTURE", date_tache: "2026-09-21", statut: "planifiee" },
      { metier: "SOL", date_tache: "2026-09-22", statut: "realisee" },
      { metier: "SOL", date_tache: "2026-09-23", statut: "refusee" },
    ];
    expect(refusRetourAuPlanning(taches)).toBeNull();
  });

  it("n'a rien à dire d'un bon sans tâche", () => {
    expect(refusRetourAuPlanning([])).toBeNull();
  });

  /* Le message doit nommer ce que l'utilisateur a sous les yeux, et dire par
     où sortir : sans le SAV, le refus est un mur. */
  it("nomme les tâches validées et renvoie vers le SAV", () => {
    const refus = refusRetourAuPlanning([
      { metier: "PEINTURE", date_tache: "2026-09-21", statut: "validee" },
      { metier: "SOL", date_tache: "2026-09-22", statut: "planifiee" },
    ]);
    expect(refus).toContain("PEINTURE du 2026-09-21");
    expect(refus).toContain("SAV");
    expect(refus).not.toContain("SOL");
  });

  /* `statut` vaut `null` sur une tâche qui vient de naître : la base y applique
     « planifiee » elle-même, et le miroir doit faire pareil. */
  it("traite un statut absent comme « planifiee »", () => {
    expect(refusRetourAuPlanning([{ statut: null }])).toBeNull();
  });
});

describe("L'état de la pièce, dérivé des tâches", () => {
  /* Le défaut B, reproduit : la pièce est signalée sur la DEUXIÈME tâche. */
  const bonMultiTaches = [
    tache({ id: "t1", metier: "PEINTURE", date_tache: "2026-09-21" }),
    tache({
      id: "t2",
      metier: "SOL",
      date_tache: "2026-09-22",
      piece_a_commander: true,
      piece_description: "Barre de seuil alu 90 cm",
      piece_fournisseur: "Point P",
      piece_date_commande: "2026-09-23",
    }),
    tache({ id: "t3", metier: "SOL", date_tache: "2026-09-24" }),
  ];

  it("voit la pièce même quand elle n'est pas sur la première tâche", () => {
    const etat = etatPieceDuBon(bonMultiTaches);
    expect(etat.pieceACommander).toBe(true);
    expect(etat.pieceACommanderDetail).toBe("Barre de seuil alu 90 cm");
    expect(etat.pieceACommanderFournisseur).toBe("Point P");
    expect(etat.pieceACommanderDateCommande).toBe("2026-09-23");
  });

  /* Le cœur du bug : une levée écrite sur la seule première tâche laissait le
     drapeau en place sur la porteuse, et le bon restait « en commande ». */
  it("reste en commande tant qu'UNE tâche porte le drapeau", () => {
    const leveePartielle = bonMultiTaches.map((t) =>
      t.id === "t1" ? { ...t, piece_a_commander: false } : t
    );
    expect(etatPieceDuBon(leveePartielle).pieceACommander).toBe(true);
  });

  it("ne l'est plus quand TOUTES les tâches ont été levées", () => {
    const leveeComplete = bonMultiTaches.map((t) => ({
      ...t,
      piece_a_commander: false,
      piece_recue_le: t.piece_description ? "2026-10-01T09:00:00Z" : null,
    }));
    expect(etatPieceDuBon(leveeComplete).pieceACommander).toBe(false);
  });

  /* La trace survit à l'attente : sans elle, tout ce qui explique les semaines
     de report disparaît de l'écran à la seconde où la pièce arrive. */
  it("garde la description et le fournisseur après la réception", () => {
    const apresReception = bonMultiTaches.map((t) => ({
      ...t,
      piece_a_commander: false,
      piece_recue_le: t.piece_description ? "2026-10-01T09:00:00Z" : null,
    }));
    const etat = etatPieceDuBon(apresReception);
    expect(etat.pieceACommanderDetail).toBe("Barre de seuil alu 90 cm");
    expect(etat.pieceACommanderFournisseur).toBe("Point P");
    expect(etat.pieceRecueLe).toBe("2026-10-01T09:00:00Z");
  });

  it("ne dit rien d'un bon qui n'a jamais attendu de pièce", () => {
    const etat = etatPieceDuBon([tache({ id: "t1" }), tache({ id: "t2" })]);
    expect(etat.pieceACommander).toBe(false);
    expect(etat.pieceACommanderDetail).toBe("");
    expect(etat.pieceRecueLe).toBe("");
  });
});

describe("Où poser, où lever le drapeau de la pièce", () => {
  const taches = [
    { id: "t1", piece_a_commander: false },
    { id: "t2", piece_a_commander: true },
    { id: "t3", piece_a_commander: true },
  ];

  /* Le fournisseur et la date de commande doivent rejoindre la description
     déjà saisie : écrits ailleurs, ils ne se relisaient jamais, et le bouton
     « 📦 Commandé » ne disparaissait pas. */
  it("pose sur la porteuse, pas sur la première venue", () => {
    expect(cibleAPoserLaPiece(taches)).toBe("t2");
  });

  it("pose sur la plus ancienne quand aucune ne porte encore", () => {
    expect(cibleAPoserLaPiece([
      { id: "t1", piece_a_commander: false },
      { id: "t2", piece_a_commander: false },
    ])).toBe("t1");
  });

  it("n'a rien à viser sur un bon sans tâche", () => {
    expect(cibleAPoserLaPiece([])).toBeNull();
  });

  /* Le défaut B, reproduit : lever sur `taches[0]` — qui ne portait rien —
     laissait t2 et t3 drapées, et le bon restait « en commande ». */
  it("lève sur TOUTES les porteuses", () => {
    expect(ciblesALeverLaPiece(taches)).toEqual(["t2", "t3"]);
  });

  it("n'écrit nulle part quand plus rien n'est en attente", () => {
    expect(ciblesALeverLaPiece([{ id: "t1", piece_a_commander: false }])).toEqual([]);
  });
});

describe("Les journées supplémentaires du bon", () => {
  it("écarte celle du rendez-vous principal", () => {
    const dates = datesSupplementairesDuBon(
      [
        tache({ id: "t1", date_tache: "2026-09-21" }),
        tache({ id: "t2", date_tache: "2026-09-22" }),
      ],
      "2026-09-21"
    );
    expect(dates.map((d) => d.date)).toEqual(["2026-09-22"]);
  });

  /* Le défaut A, reproduit : après « pièce arrivée », le bon n'a plus de date.
     Tant que les tâches gardaient la leur, plus aucune n'égalait la date
     d'origine — elles y passaient TOUTES, et le planning reposait une vignette
     sur chacune. Dé-datées, elles n'en produisent aucune. */
  it("ne compte pas les tâches en attente de replanification", () => {
    const taches = [
      tache({ id: "t1", date_tache: null, statut: "realisee" }),
      tache({ id: "t2", date_tache: null, statut: "planifiee" }),
    ];
    expect(datesSupplementairesDuBon(taches, "")).toEqual([]);
    expect(datesSupplementairesDuBon(taches, undefined)).toEqual([]);
  });

  it("marque faite une journée dont toutes les tâches sont pointées", () => {
    const dates = datesSupplementairesDuBon(
      [
        tache({ id: "t1", date_tache: "2026-09-22", statut: "realisee" }),
        tache({ id: "t2", date_tache: "2026-09-22", statut: "validee" }),
        tache({ id: "t3", date_tache: "2026-09-23", statut: "planifiee" }),
      ],
      "2026-09-21"
    );
    expect(dates).toEqual([
      { date: "2026-09-22", heure: "08:00", duree: 1, fait: true },
      { date: "2026-09-23", heure: "08:00", duree: 1, fait: false },
    ]);
  });
});

/**
 * `dragStartBC`, prise dans le fichier qui part en production.
 *
 * Extraite et évaluée, jamais recopiée : une copie passerait au vert pendant
 * que le code livré diverge, et `app.js` n'a aucun autre filet.
 */
function chargerDragStartBC(bc: Record<string, unknown>) {
  const source = readFileSync(resolve(__dirname, "../pages/app.js"), "utf8");
  const debut = source.indexOf("\nfunction dragStartBC(");
  if (debut < 0) throw new Error("`dragStartBC` introuvable dans src/pages/app.js");
  const fin = source.indexOf("\n}", debut);
  if (fin < 0) throw new Error("fin de `dragStartBC` introuvable dans src/pages/app.js");

  const fabrique = new Function(
    "state",
    "estSousTraitant",
    "resolvePlanningItem",
    "schedField",
    "bcInterventionFaite",
    "draggedItem",
    `${source.slice(debut, fin + 2)}; return dragStartBC;`
  );

  return fabrique(
    { currentRole: "admin" },
    () => false,
    () => ({ bc, metierKey: null, bcId: "bc-1" }),
    (b: Record<string, unknown>, _cle: string | null, champ: string) => b[champ],
    (b: Record<string, unknown>) => !!b.interventionFaite,
    null
  ) as (ev: unknown, kind: string, id: string) => void;
}

/** Un évènement de glissement, réduit à ce que la fonction en touche. */
function evenement() {
  const trace = { refuse: 0 };
  return {
    trace,
    ev: {
      preventDefault: () => { trace.refuse++; },
      dataTransfer: { effectAllowed: "", setData: () => {} },
    },
  };
}

describe("Le glisser-déposer d'un bon terminé", () => {
  it("reste interdit tant que le bon est posé sur le calendrier", () => {
    const drag = chargerDragStartBC({ interventionFaite: true, datePlanifiee: "2026-09-21" });
    const { ev, trace } = evenement();
    drag(ev, "bonCommande", "bc-1");
    expect(trace.refuse).toBe(1);
  });

  /* Le défaut C, reproduit : de retour de « Pièces en commande », le bon n'a
     plus de date mais ses tâches restent pointées. L'interdire revenait à le
     condamner à « Non planifiés » — impossible à replanifier. */
  it("redevient possible dès que le bon n'a plus de date", () => {
    const drag = chargerDragStartBC({ interventionFaite: true, datePlanifiee: "" });
    const { ev, trace } = evenement();
    drag(ev, "bonCommande", "bc-1");
    expect(trace.refuse).toBe(0);
  });

  it("reste possible sur un bon non terminé", () => {
    const drag = chargerDragStartBC({ interventionFaite: false, datePlanifiee: "2026-09-21" });
    const { ev, trace } = evenement();
    drag(ev, "bonCommande", "bc-1");
    expect(trace.refuse).toBe(0);
  });
});
