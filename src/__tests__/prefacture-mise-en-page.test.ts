/**
 * La pré-facture ne montre plus que des postes, et le document du client
 * s'ouvre à côté.
 *
 * TROIS DÉFAUTS, relevés à l'usage le 23/09/2026 :
 *
 *  - un bandeau de dossier coiffait la modale — lieu d'intervention, occupant,
 *    numéro de logement, étage, statut, n° de BC client, n° interne. C'est de
 *    l'information de fiche au milieu d'un écran de chiffrage ;
 *  - la pièce de référence s'ouvrait À GAUCHE et seulement sur demande. Or ce
 *    qui fait foi au moment de facturer est le bon SIGNÉ par le client, pas
 *    notre re-rendu de ses lignes : il doit être là d'emblée ;
 *  - le bouton « 📎 Bon du client » ne testait que `pieceJointeChemin`, alors
 *    que les cartes et `ouvrirBonDuClient` testent aussi `pieceJointeData`.
 *    Sur un bon d'avant le 15/09/2026 — dont la pièce est restée en data-URL —
 *    le bouton manquait ICI et s'affichait partout ailleurs.
 *
 * Ce qui se teste : la mise en page produite par `app.js`, et la disparition
 * complète des trois fonctions du bandeau. Cette dernière assertion n'est pas
 * du zèle : le 21/09, une fonction retirée dont la ligne de publication était
 * restée a fait lever « is not defined » au dernier `Object.assign` du fichier,
 * et plus AUCUN nom n'a atteint `window` — l'écran s'affichait sans qu'un seul
 * bouton réponde. `noms-publies-declares.test.ts` tient le cas général ; ici on
 * nomme les trois, pour que leur retrait soit prouvé complet.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE = readFileSync(resolve(__dirname, "../pages/app.js"), "utf8");
const INDEX = readFileSync(resolve(__dirname, "../pages/index.html"), "utf8");

function extraire(entete: string, nom: string): string {
  const debut = SOURCE.indexOf(`\n${entete} ${nom}(`);
  if (debut < 0) throw new Error(`\`${nom}\` introuvable dans src/pages/app.js`);
  const fin = SOURCE.indexOf("\n}", debut);
  if (fin < 0) throw new Error(`fin de \`${nom}\` introuvable dans src/pages/app.js`);
  return SOURCE.slice(debut, fin + 2);
}

/** Le gabarit de la modale, tel qu'il part en production. */
const CORPS = extraire("function", "renderValidationDirecteur");

describe("Le gabarit de la modale", () => {
  it("n'émet plus le bandeau de dossier", () => {
    expect(CORPS).not.toContain("pf-entete");
    expect(CORPS).not.toContain("enteteDossierHTML");
  });

  it("pose le tableau des prix AVANT le document de référence", () => {
    /* L'ordre du balisage est ce qui met le document à droite : `.pf-colonnes`
       est un simple `display:flex`, sans `order`. Inverser les deux blocs le
       renverrait à gauche sans qu'aucune règle CSS ne change. */
    const travail = CORPS.indexOf("pf-travail");
    const reference = CORPS.indexOf("pf-reference");

    expect(travail).toBeGreaterThan(-1);
    expect(reference).toBeGreaterThan(-1);
    expect(travail, "`.pf-travail` doit précéder `.pf-reference`").toBeLessThan(reference);
  });

  it("garde les postes et ce que le terrain a rapporté", () => {
    expect(CORPS).toContain("chiffrageDirecteurHTML(ctx)");
    expect(CORPS).toContain("comptesRendusHTML(ctx)");
  });

  it("garde les identifiants que le rafraîchissement adresse", () => {
    /* `rafraichirChiffrageDirecteur` ne redessine que le total, les sous-totaux
       et les blocages, par `getElementById` : redessiner tout ferait sauter le
       curseur à chaque frappe dans un champ de prix. Et `ZONES_DND.prefacture`
       vise `#validationDirecteurLignes` pour le glisser-déposer. */
    const tableau = extraire("function", "chiffrageDirecteurHTML");
    expect(tableau).toContain("validationDirecteurLignes");
    expect(tableau).toContain("validationDirecteurTotal");
    expect(tableau).toContain("validationDirecteurParMetier");
    expect(CORPS).toContain("rafraichirChiffrageDirecteur()");
  });
});

describe("Le bandeau de dossier a bien disparu", () => {
  /* Nommées une à une : le seul moyen de dire que le retrait a été complet, et
     pas seulement que le fichier se construit. */
  const retirees = ["enteteDossierHTML", "refPartanteHTML", "majEnteteDirecteur"];

  it.each(retirees)("%s n'est plus déclarée", (nom) => {
    expect(SOURCE).not.toMatch(new RegExp(`function ${nom}\\s*\\(`));
  });

  it.each(retirees)("%s n'est plus publiée sur window", (nom) => {
    expect(SOURCE).not.toMatch(new RegExp(`^  ${nom},$`, "m"));
  });

  it("ne laisse plus de zone `pfEnteteRef` à adresser", () => {
    expect(SOURCE).not.toContain("pfEnteteRef");
    expect(INDEX).not.toContain("pfEnteteRef");
  });

  it("retire aussi les règles CSS devenues mortes", () => {
    /* On cherche une RÈGLE — un sélecteur suivi de son accolade — et non le
       texte « .pf-entete », que le commentaire expliquant le retrait contient
       légitimement. Une première version l'interdisait partout et rougissait
       sur sa propre documentation. */
    const regles = INDEX.match(/\.pf-entete[\w-]*\s*\{/g) ?? [];

    expect(regles, `règles orphelines : ${regles.join(", ")}`).toEqual([]);
  });
});

describe("Le lieu d'intervention n'est plus réécrit par le chiffrage", () => {
  it("n'enregistre que les lignes et le montant", () => {
    /* La modale faisait saisir l'adresse et la référence du client, et les
       renvoyait en base avec les prix. Sans formulaire, ce n'était plus qu'un
       aller-retour — et la pré-facture n'a pas à faire autorité sur l'adresse
       du chantier, que porte la fiche du bon. */
    const enregistrer = extraire("async function", "enregistrerChiffrageDirecteur");

    expect(enregistrer).toContain("b.lignes = JSON.parse");
    expect(enregistrer).not.toContain("b.adresse =");
    expect(enregistrer).not.toContain("b.codePostal =");
    expect(enregistrer).not.toContain("b.ville =");
    expect(enregistrer).not.toContain("b.numeroBC =");
  });
});

/**
 * Le bon du client est-il là ? Les deux rangements comptent.
 *
 * La fonction est extraite et ÉVALUÉE, pas recopiée : une copie passerait au
 * vert pendant que le code livré diverge.
 */
const aUnBonDuClient = new Function(
  `${extraire("function", "aUnBonDuClient")}; return aUnBonDuClient;`
)() as (b: unknown) => boolean;

describe("La pièce jointe du client se reconnaît sous ses deux formes", () => {
  it("accepte un chemin de stockage", () => {
    expect(aUnBonDuClient({ pieceJointeChemin: "kta/bons-commande/abc/171_bc.pdf" })).toBe(true);
  });

  it("accepte une data-URL héritée d'avant le 15/09/2026", () => {
    /* C'est le défaut corrigé : ces bons-là affichaient le bouton sur leur
       carte et ne l'avaient pas dans la modale. */
    expect(aUnBonDuClient({ pieceJointeData: "data:application/pdf;base64,JVBER" })).toBe(true);
  });

  it("refuse un bon sans pièce", () => {
    expect(aUnBonDuClient({})).toBe(false);
    expect(aUnBonDuClient({ pieceJointeChemin: null, pieceJointeData: null })).toBe(false);
  });

  it("ne tombe pas sur un bon absent", () => {
    expect(aUnBonDuClient(null)).toBe(false);
    expect(aUnBonDuClient(undefined)).toBe(false);
  });
});

describe("Le document s'ouvre d'emblée", () => {
  it("choisit le bon du client quand il existe, la fiche interne sinon", () => {
    const ouvrir = extraire("async function", "openValidationDirecteurModal");

    expect(ouvrir).toContain("reference: aUnBonDuClient(b) ? 'bonClient' : 'bonCommande'");
    /* `reference: null` était « rien d'ouvert au départ » : le panneau restait
       fermé et il fallait savoir qu'il existait pour le trouver. */
    expect(ouvrir).not.toContain("reference: null");
  });

  it("demande l'URL signée avant le premier rendu", () => {
    /* Obtenue après, la première peinture montrerait la fiche interne puis
       sauterait sur le PDF sous les yeux de l'utilisateur. Elle part donc avec
       les deux autres lectures du dossier. */
    const ouvrir = extraire("async function", "openValidationDirecteurModal");
    const promesses = ouvrir.slice(ouvrir.indexOf("Promise.all"));

    expect(promesses).toContain("chargerUrlBonDuClient(validationDirecteurCtx, b)");
    expect(promesses.indexOf("chargerUrlBonDuClient"))
      .toBeLessThan(promesses.indexOf("renderValidationDirecteur()"));
  });

  it("ne signe qu'une fois, et la bascule réutilise la même fonction", () => {
    /* La modale se redessine à chaque frappe dans un champ de prix : re-signer
       à chaque rendu rechargerait le document en pleine saisie. Deux copies de
       cette logique finiraient par diverger — d'où une seule fonction. */
    const charger = extraire("async function", "chargerUrlBonDuClient");
    const basculer = extraire("async function", "basculerReferencePrefacture");

    expect(charger).toContain("if(!ctx || !b || ctx.urlBonClient) return;");
    expect(basculer).toContain("chargerUrlBonDuClient(ctx,");
    expect(basculer).not.toContain("urlPieceJointe(");
  });
});

describe("Le panneau empilé reste devant", () => {
  it("rend au document la première place sous 900 px", () => {
    /* L'ordre du balisage sert à le poser à droite en deux colonnes. En pile,
       sans `order`, il atterrirait sous le tableau, ses comptes rendus et son
       total — hors de vue au moment où l'on commence à chiffrer. */
    const etroit = INDEX.slice(INDEX.indexOf("@media(max-width:900px){ .pf-colonnes"));
    const regle = etroit.slice(0, etroit.indexOf("}", etroit.indexOf(".pf-reference")));

    expect(regle).toContain("order:-1");
  });
});
