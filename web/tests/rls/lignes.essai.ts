/**
 * Intégration contre la base locale : l'enregistrement des lignes de document.
 * Reproduit le défaut vu en e2e (lignes d'un nouveau devis supprimées aussitôt
 * insérées) et fixe le comportement attendu.
 */
import { afterAll, describe, expect, it } from "vitest";
import { synchroniserLignes } from "../../src/modules/documents/api/lignes";
import type { LigneAEnregistrer } from "../../src/modules/documents/domain/lignes";
import { ALPHA, COMPTES, connecte } from "./cible";

const ligne = (designation: string, id: string | null = null, position = 0): LigneAEnregistrer => ({
  id, position, type: "ligne", designation, quantite: 2, prix_unitaire: 10, unite: "u", tva: 20,
  article_reference: null, commentaire: null, metier: null, montant_ht: 20,
});

const crees: string[] = [];
afterAll(async () => {
  const c = await connecte(COMPTES.adminAlpha);
  if (crees.length) await c.from("devis").delete().in("id", crees);
});

async function nouveauDevis() {
  const c = await connecte(COMPTES.adminAlpha);
  const { data, error } = await c
    .from("devis")
    .insert({ societe_id: ALPHA, numero: `ESSAI-${Date.now()}-${Math.random()}`, client_nom: "Essai lignes" })
    .select("id")
    .single();
  if (error) throw error;
  crees.push(data.id);
  return { c, id: data.id };
}

const lire = async (c: Awaited<ReturnType<typeof connecte>>, id: string) =>
  (await c.from("devis_lignes").select("id, designation, position").eq("devis_id", id).order("position")).data ?? [];

describe("synchroniserLignes", () => {
  it("les lignes d'un NOUVEAU document sont bien écrites", async () => {
    const { c, id } = await nouveauDevis();
    await synchroniserLignes("devis_lignes", "devis_id", id, [ligne("A", null, 0), ligne("B", null, 1)], c);
    expect((await lire(c, id)).map((l) => l.designation)).toEqual(["A", "B"]);
  });

  it("modifie les gardées, insère les nouvelles, supprime seulement les retirées", async () => {
    const { c, id } = await nouveauDevis();
    await synchroniserLignes("devis_lignes", "devis_id", id, [ligne("A", null, 0), ligne("B", null, 1)], c);
    const [a] = await lire(c, id);
    await synchroniserLignes("devis_lignes", "devis_id", id, [ligne("A modifiée", a?.id ?? null, 0), ligne("C", null, 1)], c);
    const apres = await lire(c, id);
    expect(apres.map((l) => l.designation)).toEqual(["A modifiée", "C"]);
    expect(apres[0]?.id).toBe(a?.id);
  });

  it("une liste vide vide le document", async () => {
    const { c, id } = await nouveauDevis();
    await synchroniserLignes("devis_lignes", "devis_id", id, [ligne("A")], c);
    await synchroniserLignes("devis_lignes", "devis_id", id, [], c);
    expect(await lire(c, id)).toEqual([]);
  });

  it("le rôle lecture ne peut rien écrire : l'erreur remonte", async () => {
    const { id } = await nouveauDevis();
    const lecture = await connecte(COMPTES.lectureAlpha);
    await expect(synchroniserLignes("devis_lignes", "devis_id", id, [ligne("Intrus")], lecture)).rejects.toMatchObject({ code: "42501" });
  });
});
