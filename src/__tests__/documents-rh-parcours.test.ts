/**
 * Le dossier documentaire d'un salarié, du dépôt au retrait, contre la base.
 *
 * Ce que les règles pures ne peuvent pas prouver : que la ligne arrive dans
 * `salarie_documents`, que le fichier se range sous `<societeId>/salaries/…` —
 * le premier segment est ce que lisent les policies Storage —, que l'URL signée
 * l'ouvre, et qu'un retrait emporte les deux.
 *
 * Le motif justifie la dépense : les contrats et avenants déposés jusqu'ici ne
 * touchaient jamais la base. L'écran les affichait depuis son cache, le
 * rechargement suivant les faisait disparaître, et aucun test ne pouvait le
 * voir puisque rien ne parlait à Postgres.
 *
 * Écrit vraiment : ne tourne que sur la pile locale.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BUCKET, supabase } from "@/api/client";
import * as queries from "@/api/queries";
import type { Uuid } from "@/api/types";
import {
  ajouterDocumentRh,
  chargerDocumentsRh,
  majDocumentRh,
  ouvrirDocumentRh,
  purgerDocumentsRh,
  supprimerDocumentRh,
} from "@/integrations/documents-rh";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";

const suite = AUTH_DISPONIBLE ? describe : describe.skip;

/** Un PDF minuscule mais réel : le stockage refuse un contenu vide. */
function fichierPdf(nom: string): File {
  const octets = new TextEncoder().encode("%PDF-1.4\n% dossier RH de test\n%%EOF\n");
  return new File([octets], nom, { type: "application/pdf" });
}

suite("Dossier documentaire RH", () => {
  let societeId: Uuid;
  let salarieId: Uuid;

  beforeAll(async () => {
    const societes = await queries.listMesSocietes();
    const societe = societes.find((s) => s.code === TEST_SOCIETE_CODE) ?? societes[0];
    if (!societe) throw new Error("Aucune société accessible au compte de test");
    societeId = societe.id;

    const salarie = await queries.createSalarie(societeId, {
      nom: "DOSSIER DE TEST",
      prenom: "Parcours",
      poste: "Plombier",
    });
    salarieId = salarie.id;
  });

  afterAll(async () => {
    if (!salarieId) return;
    await purgerDocumentsRh(salarieId);
    await queries.deleteSalarie(salarieId);
  });

  it("dépose un document, fichier compris, et le relit", async () => {
    const depose = await ajouterDocumentRh(
      salarieId,
      {
        type: "carteBtp",
        nom: "Carte BTP 2026",
        organisme: "CIBTP",
        numeroDocument: "BTP-0042",
        dateDocument: "2026-01-05",
        dateExpiration: "2031-01-05",
        notes: "",
      },
      fichierPdf("carte btp — Résidence Côte d'Azur.pdf")
    );

    expect(depose.id).toBeTruthy();
    expect(depose.nom).toBe("Carte BTP 2026");
    /* Le nom d'origine est conservé tel quel, le chemin est assaini : c'est ce
       que promet `nomSurPourStockage`, et c'est ce que l'écran réaffiche. */
    expect(depose.fichierNom).toBe("carte btp — Résidence Côte d'Azur.pdf");
    expect(depose.fichierChemin).toMatch(
      new RegExp(`^${societeId}/salaries/${salarieId}/\\d+_`)
    );
    expect(depose.fichierChemin).not.toMatch(/[éèêàçÉ—']/);

    /* Le champ vide de l'écran historique ne doit pas arriver tel quel : sur
       une colonne date, Postgres refuse la chaîne vide. */
    expect(depose.notes).toBeNull();

    const relus = await chargerDocumentsRh([salarieId]);
    expect(relus.map((d) => d.id)).toContain(depose.id);
    expect(relus.find((d) => d.id === depose.id)?.numeroDocument).toBe("BTP-0042");
  });

  it("rend une URL signée qui ouvre vraiment le fichier", async () => {
    const [doc] = await chargerDocumentsRh([salarieId]);
    const ouvert = await ouvrirDocumentRh(doc);
    expect(ouvert).not.toBeNull();
    expect(ouvert!.mime).toBe("application/pdf");

    const reponse = await fetch(ouvert!.url);
    expect(reponse.ok).toBe(true);
    expect(await reponse.text()).toContain("%PDF-1.4");
  });

  it("accepte un document sans fichier — la pièce notée avant d'être reçue", async () => {
    const sansFichier = await ajouterDocumentRh(salarieId, {
      type: "visiteMedicale",
      nom: "Visite du 12/09",
      dateDocument: "2026-09-12",
      dateExpiration: "",
    });
    expect(sansFichier.fichierChemin).toBeNull();
    expect(sansFichier.dateExpiration).toBeNull();
    await supprimerDocumentRh(sansFichier);
  });

  it("remplace le fichier et efface l'ancien", async () => {
    const [avant] = await chargerDocumentsRh([salarieId]);
    const ancienChemin = avant.fichierChemin!;

    const apres = await majDocumentRh(
      avant.id,
      {
        type: avant.type,
        nom: "Carte BTP 2026 (recto-verso)",
        organisme: avant.organisme,
        numeroDocument: avant.numeroDocument,
        dateDocument: avant.dateDocument,
        dateExpiration: avant.dateExpiration,
        notes: avant.notes,
      },
      fichierPdf("carte-btp-v2.pdf")
    );

    expect(apres.id).toBe(avant.id);
    expect(apres.fichierChemin).not.toBe(ancienChemin);
    expect(apres.nom).toBe("Carte BTP 2026 (recto-verso)");

    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(ancienChemin, 60);
    expect(data).toBeNull();
  });

  it("retirer le document emporte la ligne et le fichier", async () => {
    const [doc] = await chargerDocumentsRh([salarieId]);
    const chemin = doc.fichierChemin!;

    await supprimerDocumentRh(doc);

    expect(await chargerDocumentsRh([salarieId])).toEqual([]);
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(chemin, 60);
    expect(data).toBeNull();
  });
});
