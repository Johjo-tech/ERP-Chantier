/**
 * Une facture émise ne se corrige plus — montant compris.
 *
 * La protection posée sur le numéro ne couvrait que la référence. Une sonde
 * menée sous un compte « technicien » a montré que le montant, lui, restait
 * ouvert : la ligne d'une facture émise passait de 2 340 € à 1 €, et sa
 * suppression rendait HTTP 204. La facture restait numérotée, datée, et ne
 * valait plus rien.
 *
 * Deux gardes trop larges le permettaient — `peut_ecrire` pour la
 * modification, qui inclut le technicien, et `est_membre` pour la
 * suppression, c'est-à-dire n'importe quel membre. Mais resserrer les rôles
 * n'aurait pas suffi : une facture émise ne se corrige pas **même par un
 * administrateur**. C'est cette règle-là qui est éprouvée ici.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as queries from "@/api/queries";
import { supabase } from "@/api/client";
import { stGet, stSet } from "@/integrations/html-adapter";
import type { Uuid } from "@/api/types";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const CLE = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
/** Le compte technicien n'existe que dans le conteneur local. */
const EN_LOCAL = /127\.0\.0\.1|localhost/.test(URL ?? "");
const suite = AUTH_DISPONIBLE ? describe : describe.skip;

function motif(erreur: unknown): string {
  const e = erreur as { message?: string; details?: unknown };
  const d = e?.details as { message?: string } | undefined;
  return [e?.message, d?.message].filter(Boolean).join(" ");
}

suite("Lignes d'une facture émise", () => {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  let societeId: Uuid;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error(`Société « ${TEST_SOCIETE_CODE} » introuvable`);
    societeId = societe.id;
  });

  /** Une facture émise, composée en un geste, avec une ligne chiffrée. */
  async function factureEmise() {
    const f = await queries.createFacture(
      societeId,
      { client_nom: "CLIENT DE TEST", date: aujourdhui, statut: "impayée" },
      [
        {
          type: "ligne",
          designation: "Prestation",
          quantite: 1,
          unite: "forfait",
          prix_unitaire: 5000,
          tva: 20,
        },
      ]
    );
    expect(f.numero).toMatch(/^FAC-/);
    expect(f.lignes).toHaveLength(1);
    return f;
  }

  it("se compose normalement à la création", async () => {
    const f = await factureEmise();
    const totaux = await queries.getFactureTotaux(f.id);
    expect(totaux?.ht).toBeCloseTo(5000, 2);
  });

  it("refuse qu'on en modifie le prix", async () => {
    const f = await factureEmise();
    const { error } = await supabase
      .from("facture_lignes")
      .update({ prix_unitaire: 1 })
      .eq("id", f.lignes[0].id);

    expect(error).not.toBeNull();
    expect(`${error?.message} ${error?.details}`).toMatch(/émise/i);

    const apres = await queries.listFactureLignes(f.id);
    expect(Number(apres[0].prix_unitaire)).toBe(5000);
  });

  it("refuse qu'on en supprime une ligne", async () => {
    const f = await factureEmise();
    const { error } = await supabase
      .from("facture_lignes")
      .delete()
      .eq("id", f.lignes[0].id);

    expect(error).not.toBeNull();
    expect(await queries.listFactureLignes(f.id)).toHaveLength(1);
  });

  /* L'ajout est le troisième chemin : sans lui, il suffirait de gonfler la
     facture au lieu de la vider. */
  it("refuse qu'on lui ajoute une ligne", async () => {
    const f = await factureEmise();
    const { error } = await supabase.from("facture_lignes").insert({
      facture_id: f.id,
      position: 1,
      type: "ligne",
      designation: "Ligne ajoutée après coup",
      quantite: 1,
      prix_unitaire: 99999,
      tva: 20,
    });

    expect(error).not.toBeNull();
    expect(await queries.listFactureLignes(f.id)).toHaveLength(1);
  });

  /* Le point qui distingue cette règle d'un simple durcissement de rôle. */
  it("refuse même à l'administrateur", async () => {
    const f = await factureEmise();
    await expect(
      queries.replaceFactureLignes(f.id, [
        { type: "ligne", designation: "Réécriture", quantite: 1, prix_unitaire: 1, tva: 20 },
      ])
    ).rejects.toThrow();

    const apres = await queries.listFactureLignes(f.id);
    expect(Number(apres[0].prix_unitaire)).toBe(5000);
  });

  it("laisse un brouillon librement modifiable", async () => {
    const f = await queries.createFacture(
      societeId,
      { client_nom: "CLIENT DE TEST", date: aujourdhui, statut: "brouillon" },
      [{ type: "ligne", designation: "Devisé", quantite: 1, prix_unitaire: 100, tva: 20 }]
    );
    expect(f.numero).toBeNull();

    const majees = await queries.replaceFactureLignes(f.id, [
      { type: "ligne", designation: "Corrigé", quantite: 2, prix_unitaire: 250, tva: 20 },
    ]);
    expect(majees).toHaveLength(1);
    expect(Number(majees[0].prix_unitaire)).toBe(250);
  });

  /* Le pont réécrivait toutes les lignes à chaque enregistrement, même quand
     seul le statut changeait : encaisser un règlement rejouait donc un
     « supprimer puis réinsérer » que la base refuse désormais. Comparer avant
     d'écrire règle le cas — et il faut que ça reste vrai. */
  it("laisse passer un enregistrement qui ne change pas les lignes", async () => {
    const f = await factureEmise();
    const cle = `facture:${f.id}`;
    const lu = (await stGet(cle)) as Record<string, unknown>;
    expect(lu).toBeTruthy();

    // Le geste de `syncFactureStatut` : même objet, statut différent.
    expect(await stSet(cle, { ...lu, statut: "payée" })).toBe(true);
    expect(await queries.listFactureLignes(f.id)).toHaveLength(1);
    expect((await queries.getFacture(f.id))?.statut).toBe("payée");
  });

  /* PostgREST ne lève pas : il range son refus dans `error`. Le pont l'avalait,
     si bien que l'écran annonçait « enregistré » sur des lignes que rien
     n'avait touchées. Un refus doit se voir. */
  it("rend faux quand la base refuse la réécriture des lignes", async () => {
    const f = await factureEmise();
    const cle = `facture:${f.id}`;
    const lu = (await stGet(cle)) as Record<string, unknown>;
    const lignes = (lu.lignes as Record<string, unknown>[]).map((l) => ({
      ...l,
      prixUnitaire: 1,
    }));

    expect(await stSet(cle, { ...lu, lignes })).toBe(false);

    const apres = await queries.listFactureLignes(f.id);
    expect(Number(apres[0].prix_unitaire)).toBe(5000);
  });

  /* La règle doit tenir quel que soit le rôle, pas seulement pour le compte
     de test qui est administrateur partout. */
  (EN_LOCAL ? it : it.skip)("refuse au technicien, qui y parvenait", async () => {
    const f = await factureEmise();
    const client: SupabaseClient = createClient(URL, CLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: connexion } = await client.auth.signInWithPassword({
      email: "tech.a@local",
      password: "motdepasse-test",
    });
    expect(connexion).toBeNull();

    const { error } = await client
      .from("facture_lignes")
      .update({ prix_unitaire: 1 })
      .eq("id", f.lignes[0].id);
    expect(motif(error)).toMatch(/émise/i);

    const { error: suppression } = await client
      .from("facture_lignes")
      .delete()
      .eq("id", f.lignes[0].id);
    expect(motif(suppression)).toMatch(/émise/i);

    await client.auth.signOut();
    expect(await queries.listFactureLignes(f.id)).toHaveLength(1);
  });
});
