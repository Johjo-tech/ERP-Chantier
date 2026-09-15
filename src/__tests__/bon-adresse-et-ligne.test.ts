/**
 * Ce qu'un bon de commande doit porter pour être enregistrable.
 *
 * Les deux exigences se rejoignent sur la facture : l'adresse d'intervention y
 * devient le bloc « Lieu d'intervention » (via `adresse_locataire`), et les
 * lignes du bon y deviennent les lignes facturées. Un bon qui n'a ni l'une ni
 * les autres produit une facture qui ne dit ni où, ni quoi — et
 * `bc_generer_facture`, faute de lignes, s'en invente une : « Travaux — BC n°… »
 * au montant global.
 */

import { describe, it, expect } from "vitest";
import {
  essentielsDeLecture,
  lieuIntervention,
  lignesDeTravaux,
  manquesBonCommande,
  refBonCommandeClient,
} from "@/api/regles-bc";

const ADRESSE = "33 rue du Grand Veymont";

/** Les codes seuls : les libellés se relisent, ils ne s'assertent pas. */
function codes(bon: Parameters<typeof manquesBonCommande>[0]) {
  return manquesBonCommande(bon).map((m) => m.code);
}

describe("Ce qu'un bon de commande doit porter", () => {
  it("accepte un bon qui porte l'adresse et un travail décrit", () => {
    expect(
      codes({
        adresse: ADRESSE,
        lignes: [{ type: "ligne", designation: "Remplacement du siphon" }],
      })
    ).toEqual([]);
  });

  /* Le cas qui motive la règle : un bon arrive avant tout chiffrage. Exiger un
     prix interdirait de l'enregistrer au moment où on le reçoit. */
  it("accepte une ligne sans prix — le chiffrage vient plus tard", () => {
    expect(
      codes({
        adresse: ADRESSE,
        lignes: [{ type: "ligne", designation: "Reprise peinture séjour", prixUnitaire: 0 }],
      })
    ).toEqual([]);
  });

  it("réclame l'adresse d'intervention quand elle manque", () => {
    expect(codes({ lignes: [{ type: "ligne", designation: "Siphon" }] })).toEqual([
      "adresse_intervention",
    ]);
  });

  /* L'app historique écrit `""` pour « non renseigné », et un champ qu'on a
     effleuré ne porte souvent qu'une espace. */
  it("ne se contente pas d'une adresse blanche", () => {
    expect(codes({ adresse: "   ", lignes: [{ type: "ligne", designation: "Siphon" }] })).toEqual([
      "adresse_intervention",
    ]);
  });

  it("réclame une ligne de travaux quand le bon n'en porte aucune", () => {
    expect(codes({ adresse: ADRESSE, lignes: [] })).toEqual(["ligne_travaux"]);
    expect(codes({ adresse: ADRESSE })).toEqual(["ligne_travaux"]);
  });

  /* Un chapitre structure le document, un commentaire l'annote : ni l'un ni
     l'autre ne dit ce qu'il y a à faire. */
  it("ne prend ni un chapitre ni un commentaire pour un travail", () => {
    expect(
      codes({
        adresse: ADRESSE,
        lignes: [
          { type: "chapitre", designation: "PLOMBERIE" },
          { type: "commentaire", designation: "Accès par le gardien" },
        ],
      })
    ).toEqual(["ligne_travaux"]);
  });

  it("ne prend pas une ligne vide pour un travail", () => {
    expect(
      codes({
        adresse: ADRESSE,
        lignes: [{ type: "ligne", designation: "  ", prixUnitaire: 120 }],
      })
    ).toEqual(["ligne_travaux"]);
  });

  it("énumère les deux manques plutôt que de s'arrêter au premier", () => {
    expect(codes({})).toEqual(["adresse_intervention", "ligne_travaux"]);
  });

  /* Une ligne sans type est une ligne : c'est le défaut du schéma, et l'app
     historique omet le champ. */
  it("traite une ligne sans type comme une ligne de travaux", () => {
    expect(lignesDeTravaux([{ designation: "Divers" }])).toHaveLength(1);
  });

  /* Le message doit désigner l'endroit où la donnée réapparaît, sinon
     l'exigence passe pour une tracasserie de formulaire. */
  it("dit à quoi servent les deux champs", () => {
    const [adresse, ligne] = manquesBonCommande({}).map((m) => m.libelle);
    expect(adresse).toContain("Lieu d'intervention");
    expect(ligne).toContain("Le prix peut attendre");
  });
});

/**
 * Ce qu'une lecture automatique doit avoir ramené.
 *
 * Le modèle remplit `avertissements` à sa discrétion et se tait précisément
 * quand il n'a rien vu : une lecture vide se présentait comme une réussite.
 */
describe("Les essentiels d'une lecture", () => {
  const COMPLETE = {
    numeroBC: "E816222",
    adresse: "33 rue du Grand Veymont",
    lignes: [{ type: "ligne", designation: "Reprise peinture séjour" }],
  };

  it("ne signale rien quand les trois sont là", () => {
    expect(essentielsDeLecture(COMPLETE)).toEqual([]);
  });

  it("signale le numéro de bon non lu", () => {
    const codes = essentielsDeLecture({ ...COMPLETE, numeroBC: null }).map((m) => m.code);
    expect(codes).toEqual(["numero_bc"]);
  });

  it("signale l'adresse de chantier non lue", () => {
    const codes = essentielsDeLecture({ ...COMPLETE, adresse: "" }).map((m) => m.code);
    expect(codes).toEqual(["adresse_intervention"]);
  });

  /* Un bon lu sans tableau chiffré : le modèle doit résumer les travaux. S'il
     ne rend que la structure, il n'a rien rapporté d'utilisable. */
  it("ne prend pas un chapitre seul pour une ligne de travaux", () => {
    const codes = essentielsDeLecture({
      ...COMPLETE,
      lignes: [{ type: "chapitre", designation: "PLOMBERIE" }],
    }).map((m) => m.code);
    expect(codes).toEqual(["ligne_travaux"]);
  });

  it("les énumère tous les trois sur une lecture vide", () => {
    expect(essentielsDeLecture({}).map((m) => m.code)).toEqual([
      "numero_bc",
      "adresse_intervention",
      "ligne_travaux",
    ]);
  });

  /* Le numéro se signale mais ne refuse rien : « Sans BC » est un cas réel.
     Les deux autres, eux, bloquent l'enregistrement. */
  it("signale le numéro sans pour autant interdire d'enregistrer", () => {
    const bon = { adresse: COMPLETE.adresse, lignes: COMPLETE.lignes };
    expect(essentielsDeLecture({ ...bon }).map((m) => m.code)).toContain("numero_bc");
    expect(manquesBonCommande(bon)).toEqual([]);
  });
});

/**
 * La référence de commande qui part sur la facture (BT-13 de l'EN 16931).
 *
 * Elle valait `null` sur les 428 factures de production : la colonne existait,
 * le mapping vers la facture électronique aussi, seule la valeur manquait.
 * Cette fonction est le miroir exact de `public.ref_bc_client` — les factures
 * nées en base et celles nées à l'écran doivent porter la même.
 */
describe("La référence du bon telle que le client la connaît", () => {
  it("rend le numéro du client", () => {
    expect(refBonCommandeClient("E816222")).toBe("E816222");
  });

  /* Le champ est un textarea : un bon peut en citer plusieurs, seule la
     première ligne fait référence. */
  it("ne retient que la première ligne", () => {
    expect(refBonCommandeClient("BC-123\nBC-456")).toBe("BC-123");
  });

  /* « Sans BC » et « En attente de BC » sont écrits par la saisie quand il n'y
     a pas de numéro : ce sont des phrases françaises, pas des références. */
  it("écarte les sentinelles de saisie", () => {
    expect(refBonCommandeClient("Sans BC")).toBeNull();
    expect(refBonCommandeClient("En attente de BC")).toBeNull();
  });

  /* Un SAV porte un numéro de NOTRE série : l'envoyer à l'acheteur comme sa
     propre référence de commande serait une erreur de fond. */
  it("écarte un numéro de notre série SAV", () => {
    expect(refBonCommandeClient("SAV-2026-0053")).toBeNull();
  });

  it("rend nul plutôt que vide", () => {
    expect(refBonCommandeClient("   ")).toBeNull();
    expect(refBonCommandeClient("")).toBeNull();
    expect(refBonCommandeClient(null)).toBeNull();
    expect(refBonCommandeClient(undefined)).toBeNull();
  });
});

/**
 * Le lieu des travaux, tel que l'écran de validation doit le poser.
 *
 * Le motif était recopié cinq fois dans l'écran — deux littéraux dans le
 * document imprimé, trois compositions dans les cartes. Il vit désormais ici.
 */
describe("Le lieu d'intervention", () => {
  it("compose la rue et la commune", () => {
    expect(lieuIntervention({ adresse: "33 rue du Grand Veymont", codePostal: "38320", ville: "Eybens" }))
      .toEqual({ texte: "33 rue du Grand Veymont, 38320 Eybens", renseigne: true });
  });

  /* Un bon de commande n'a pas d'`adresseLocataire` — son formulaire saisit le
     chantier dans `adresse`. Devis et factures, si. D'où le repli. */
  it("préfère l'adresse du locataire quand elle existe", () => {
    const lu = lieuIntervention({
      adresse: "11 boulevard Jean Pain",
      adresseLocataire: "LAEP Salle Mistral",
      ville: "Grenoble",
    });
    expect(lu.texte).toBe("LAEP Salle Mistral, Grenoble");
  });

  it("se contente de la rue quand la commune manque", () => {
    expect(lieuIntervention({ adresse: "33 rue du Grand Veymont" }).texte)
      .toBe("33 rue du Grand Veymont");
  });

  /* Le cas qui motive le drapeau : « 38000 Grenoble » est un texte non vide qui
     ne dit pas où aller. C'est la rue qui décide, pas la longueur du texte. */
  it("ne tient pas une commune seule pour un lieu renseigné", () => {
    const sansRue = lieuIntervention({ codePostal: "38000", ville: "Grenoble" });
    expect(sansRue.texte).toBe("38000 Grenoble");
    expect(sansRue.renseigne).toBe(false);
  });

  it("ne se laisse pas prendre par des champs à blanc", () => {
    expect(lieuIntervention({ adresse: "   ", ville: "  " })).toEqual({ texte: "", renseigne: false });
    expect(lieuIntervention({})).toEqual({ texte: "", renseigne: false });
  });

  /* La file de validation compte 195 bons sans référence client : si le numéro
     devenait obligatoire à l'enregistrement, elle se bloquerait tout entière. */
  it("laisse `manquesBonCommande` indifférent au numéro de bon", () => {
    const bon = { adresse: "33 rue du Grand Veymont", lignes: [{ type: "ligne", designation: "Siphon" }] };
    expect(manquesBonCommande(bon)).toEqual([]);
  });
});
