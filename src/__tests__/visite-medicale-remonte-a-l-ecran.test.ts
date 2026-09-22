/**
 * Après une visite enregistrée, la fiche doit dire ce que la base dit.
 *
 * `enregistrerVisiteRh` rechargeait bien `state.salaries` — et s'arrêtait là.
 * Or la fiche ouverte est rendue depuis `state.editing`, un clone figé pris à
 * l'ouverture (`editItem`) : les deux champs « Dernière / Prochaine visite
 * médicale » gardaient donc leur valeur d'avant, pendant que le badge posé à
 * six pixels de là, qui lit `state.salaries`, affichait la bonne échéance. Il
 * fallait fermer la fiche et la rouvrir pour les voir se remplir. L'utilisateur
 * a conclu, à raison, que rien ne remontait.
 *
 * Le `Promise.all` aggravait : le seul redessin du parcours venait de la queue
 * de `chargerVisitesRh`, et pouvait peindre avant que `recharger('salarie')`
 * n'ait ramené quoi que ce soit.
 *
 * Les fonctions ne sont pas recopiées : elles sont extraites du fichier livré
 * et évaluées. Une copie passerait au vert pendant que le code diverge, et ces
 * modules d'écran n'ont aucun autre filet — ni contrôle de types, ni rien.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { colonnesDe } from "@/api/columns";

/* Le registre vit dans son propre module depuis qu'`app.js` frôlait le seuil
   d'analyse de Semgrep ; la fiche salarié, elle, est restée. Les deux sources
   sont donc lues séparément, et chaque assertion vise la bonne. */
const VISITES = readFileSync(resolve(__dirname, "../pages/rh-visites.js"), "utf8");
const ECRAN = readFileSync(resolve(__dirname, "../pages/app.js"), "utf8");

/**
 * Une fonction de premier niveau, prise dans le fichier livré.
 *
 * Le `export ` est retiré : ce que l'écran emprunte au module est exporté pour
 * que son contrôle de types le voie, mais `new Function` ne compile pas un
 * export hors module.
 */
function extraire(nom: string, prefixe = "function", source = VISITES): string {
  const marque = [`\nexport ${prefixe} ${nom}(`, `\n${prefixe} ${nom}(`]
    .map((m) => source.indexOf(m))
    .find((i) => i >= 0);
  if (marque === undefined) throw new Error(`\`${nom}\` introuvable`);
  const fin = source.indexOf("\n}", marque);
  if (fin < 0) throw new Error(`fin de \`${nom}\` introuvable`);
  return source.slice(marque, fin + 2).replace(/^\nexport /, "\n");
}

interface Champ {
  value: string;
  files?: unknown[];
}

interface Banc {
  enregistrerVisiteRh: () => Promise<void>;
  supprimerVisiteRhEcran: (id: string) => Promise<void>;
  state: Record<string, any>;
  champs: Record<string, Champ>;
  journal: string[];
  toasts: string[];
  ecrites: { salarieId: string; saisie: Record<string, string> }[];
}

/**
 * Le banc, et ce qu'il simule de la base.
 *
 * `datesApres` est ce que le déclencheur `salarie_visites_etiquette` pose sur
 * la fiche dès qu'une visite entre au registre. Le banc ne l'applique qu'au
 * `recharger('salarie')` : c'est bien là que l'écran l'apprend.
 */
function chargerBanc(salarie: Record<string, any>, datesApres: {
  visiteMedicaleDate: string | null;
  visiteMedicaleProchaine: string | null;
}): Banc {
  const journal: string[] = [];
  const toasts: string[] = [];
  const ecrites: { salarieId: string; saisie: Record<string, string> }[] = [];

  const enBase = { ...salarie };
  const state: Record<string, any> = {
    salaries: [enBase],
    visitesRh: [{ id: "v1", salarieId: salarie.id }],
    editing: { ...salarie },
    formOpen: { salarie: true },
    rhVisiteForm: { salarieId: salarie.id, id: null, cleAttente: null },
  };

  const champs: Record<string, Champ> = {
    visRh_dateVisite: { value: "2026-09-22" },
    visRh_type: { value: "periodique" },
    visRh_suivi: { value: "simple" },
    visRh_organisme: { value: "APST BTP" },
    visRh_medecin: { value: "Dr Marchand" },
    visRh_avis: { value: "apte" },
    visRh_reserves: { value: "" },
    visRh_prochaineVisite: { value: "2031-09-22" },
    visRh_notes: { value: "" },
    visRh_fichier: { value: "", files: [] },
    sal_visiteMedicaleDate: { value: salarie.visiteMedicaleDate || "" },
    sal_visiteMedicaleProchaine: { value: salarie.visiteMedicaleProchaine || "" },
  };

  const fenetre = {
    verifierPieceJointe: () => ({ ok: true }),
    ajouterVisiteMedicale: async (salarieId: string, saisie: Record<string, string>) => {
      journal.push("ajouterVisiteMedicale");
      ecrites.push({ salarieId, saisie });
    },
    majVisiteMedicale: async () => { journal.push("majVisiteMedicale"); },
    supprimerVisiteMedicale: async () => { journal.push("supprimerVisiteMedicale"); },
  };

  const fabrique = new Function(
    "state",
    "window",
    "document",
    "showToast",
    "refusDocumentRh",
    "chargerVisitesRh",
    "recharger",
    "rafraichirZoneVisites",
    "uid",
    "fmtDate",
    "confirm",
    "console",
    `${extraire("resynchroniserDatesVisite")}
     ${extraire("empilerVisiteEnAttente")}
     ${extraire("enregistrerVisiteRh", "async function")}
     ${extraire("supprimerVisiteRhEcran", "async function")}
     const VISITE_FICHE_NEUVE = '__salarie_en_creation__';
     return { enregistrerVisiteRh, supprimerVisiteRhEcran };`
  );

  const api = fabrique(
    state,
    fenetre,
    { getElementById: (id: string) => champs[id] || null },
    (texte: string) => { toasts.push(texte); },
    (err: { message?: string }) => err?.message || "refus",
    async () => { journal.push("chargerVisitesRh"); },
    async () => {
      journal.push("recharger");
      /* Ce que la base a fait entretemps : le déclencheur a posé les deux
         dates sur la fiche, et c'est le rechargement qui les rapporte. */
      Object.assign(enBase, datesApres);
    },
    () => { journal.push("rafraichirZoneVisites"); },
    () => "cle-1",
    (d: string) => d,
    () => true,
    console
  );

  return { ...api, state, champs, journal, toasts, ecrites };
}

const SALARIE_SANS_SUIVI = {
  id: "s1",
  nom: "Benali",
  visiteMedicaleDate: null,
  visiteMedicaleProchaine: null,
};

describe("Enregistrer une visite remplit les deux champs de la fiche", () => {
  it("la fiche ouverte porte les dates que la base vient de calculer", async () => {
    const banc = chargerBanc(SALARIE_SANS_SUIVI, {
      visiteMedicaleDate: "2026-09-22",
      visiteMedicaleProchaine: "2031-09-22",
    });

    await banc.enregistrerVisiteRh();

    /* Le défaut d'origine : ces deux-là restaient vides jusqu'à ce qu'on ferme
       la fiche et qu'on la rouvre. */
    expect(banc.state.editing.visiteMedicaleDate).toBe("2026-09-22");
    expect(banc.state.editing.visiteMedicaleProchaine).toBe("2031-09-22");
  });

  it("repose aussi la valeur dans les deux `input`, qui sont grisés", async () => {
    const banc = chargerBanc(SALARIE_SANS_SUIVI, {
      visiteMedicaleDate: "2026-09-22",
      visiteMedicaleProchaine: "2031-09-22",
    });

    await banc.enregistrerVisiteRh();

    expect(banc.champs.sal_visiteMedicaleProchaine.value).toBe("2031-09-22");
  });

  it("recharge la fiche APRÈS le registre, et jamais de front", async () => {
    const banc = chargerBanc(SALARIE_SANS_SUIVI, {
      visiteMedicaleDate: "2026-09-22",
      visiteMedicaleProchaine: "2031-09-22",
    });

    await banc.enregistrerVisiteRh();

    expect(banc.journal).toEqual([
      "ajouterVisiteMedicale",
      "chargerVisitesRh",
      "recharger",
      "rafraichirZoneVisites",
    ]);
  });
});

describe("Retirer la dernière visite vide les deux champs", () => {
  it("l'échéance disparue disparaît aussi de la fiche", async () => {
    const banc = chargerBanc(
      { ...SALARIE_SANS_SUIVI, visiteMedicaleDate: "2026-09-22", visiteMedicaleProchaine: "2031-09-22" },
      { visiteMedicaleDate: null, visiteMedicaleProchaine: null }
    );

    await banc.supprimerVisiteRhEcran("v1");

    /* Plus dangereux encore que le vide initial : la fiche affichait une
       échéance que la base n'avait plus. */
    expect(banc.state.editing.visiteMedicaleProchaine).toBe("");
    expect(banc.champs.sal_visiteMedicaleProchaine.value).toBe("");
  });
});

describe("Une visite saisie à la création attend la fiche", () => {
  it("n'écrit rien en base tant que le salarié n'existe pas", async () => {
    const banc = chargerBanc(SALARIE_SANS_SUIVI, {
      visiteMedicaleDate: null,
      visiteMedicaleProchaine: null,
    });
    banc.state.editing = { id: undefined };
    banc.state.rhVisiteForm = { salarieId: "__salarie_en_creation__", id: null, cleAttente: null };

    await banc.enregistrerVisiteRh();

    /* La RLS du registre lit `salaries` pour décider, et l'attestation se range
       sous l'identifiant du salarié : il n'y a rien à écrire avant lui. */
    expect(banc.ecrites).toEqual([]);
    expect(banc.state.editing.visitesAJoindre).toHaveLength(1);
    expect(banc.state.editing.visitesAJoindre[0].saisie.dateVisite).toBe("2026-09-22");
  });

  it("garde les garde-fous communs aux deux chemins", async () => {
    const banc = chargerBanc(SALARIE_SANS_SUIVI, {
      visiteMedicaleDate: null,
      visiteMedicaleProchaine: null,
    });
    banc.state.editing = { id: undefined };
    banc.state.rhVisiteForm = { salarieId: "__salarie_en_creation__", id: null, cleAttente: null };
    /* Une échéance antérieure à la visite n'est pas une échéance : le refus
       doit tomber avant la mise en attente, pas à l'enregistrement de la
       fiche, trop tard pour être corrigé. */
    banc.champs.visRh_prochaineVisite.value = "2020-01-01";

    await banc.enregistrerVisiteRh();

    expect(banc.state.editing.visitesAJoindre).toBeUndefined();
    expect(banc.toasts[0]).toContain("ne peut pas précéder");
  });
});

describe("Ce que la source doit garantir", () => {
  it("le dépôt des visites attend que le salarié existe", () => {
    const pose = ECRAN.indexOf("const r = await window.stSet('salarie:'+id, obj);");
    const depot = ECRAN.indexOf("await deposerVisitesEnAttente(id);");
    expect(pose).toBeGreaterThan(0);
    expect(depot).toBeGreaterThan(pose);
  });

  it("plus aucune course entre le registre et la fiche", () => {
    expect(VISITES).not.toContain("Promise.all([chargerVisitesRh");
  });

  it("`visitesAJoindre` n'est jamais posé sur la fiche envoyée à la base", () => {
    /* Un `File` sérialisé en JSON devient `{}`, et `colonnesDe()` l'écarterait
       en silence — le trou par lequel `habilitations` partait déjà. */
    expect(ECRAN).not.toContain("visitesAJoindre: ");
    expect(colonnesDe("salaries")?.has("visites_a_joindre")).toBe(false);
    expect(colonnesDe("salaries")?.has("visitesAJoindre")).toBe(false);
  });

  it("les deux champs grisés ne sont plus relus dans le DOM à l'enregistrement", () => {
    expect(ECRAN).not.toContain("visiteMedicaleDate: document.getElementById('sal_visiteMedicaleDate').value");
    expect(ECRAN).toContain("visiteMedicaleDate: e.visiteMedicaleDate || null");
  });

  it("le panneau de visite ne survit pas à la fermeture de la fiche", () => {
    /* Sans cela, abandonner une fiche neuve puis en ouvrir une autre faisait
       réapparaître la visite abandonnée — sur quelqu'un d'autre. */
    const closeForm = ECRAN.slice(ECRAN.indexOf("\nfunction closeForm("));
    expect(closeForm.slice(0, 400)).toContain("state.rhVisiteForm = null");
  });
});
