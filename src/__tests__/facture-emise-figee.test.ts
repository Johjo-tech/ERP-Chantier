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

  /* Deux couches, et elles n'agissent pas au même moment.
     Le trigger — éprouvé plus haut — refuse à tout le monde, message à l'appui.
     La RLS, elle, arrête le technicien **avant** : la matrice lui refuse le
     module `factures`, la ligne ne lui est donc même pas visible. Son écriture
     ne lève rien, elle ne trouve simplement rien à écrire. C'est plus fort
     qu'un refus, et c'est pourquoi ce cas n'attend pas de message. */
  (EN_LOCAL ? it : it.skip)("dérobe la ligne au technicien, qui la réécrivait", async () => {
    const f = await factureEmise();
    const client: SupabaseClient = createClient(URL, CLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: connexion } = await client.auth.signInWithPassword({
      email: "tech.a@local",
      password: "motdepasse-test",
    });
    expect(connexion).toBeNull();

    // Invisible : la matrice refuse `factures` au technicien, jusqu'à la lecture.
    const { data: vues } = await client
      .from("facture_lignes")
      .select("*")
      .eq("facture_id", f.id);
    expect(vues).toEqual([]);

    const { data: modifiees } = await client
      .from("facture_lignes")
      .update({ prix_unitaire: 1 })
      .eq("id", f.lignes[0].id)
      .select();
    expect(modifiees ?? []).toEqual([]);

    await client.from("facture_lignes").delete().eq("id", f.lignes[0].id);
    await client.auth.signOut();

    const apres = await queries.listFactureLignes(f.id);
    expect(apres).toHaveLength(1);
    expect(Number(apres[0].prix_unitaire)).toBe(5000);
  });
});

/*
 * L'en-tête aussi.
 *
 * Les lignes étaient gelées et le numéro définitif, mais on pouvait encore
 * changer le client, la date ou l'adresse d'une facture portant un numéro. Le
 * cadenas de l'écran n'était qu'un garde-fou d'affichage, levé par un bouton.
 * Art. L441-9 : la facture est définitive, la correction passe par un avoir.
 */
suite("En-tête d'une facture émise", () => {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  let societeId: Uuid;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error(`Société « ${TEST_SOCIETE_CODE} » introuvable`);
    societeId = societe.id;
  });

  async function emise() {
    return queries.createFacture(
      societeId,
      { client_nom: "CLIENT DE TEST", date: aujourdhui, statut: "impayée", adresse: "1 rue d'Avant" },
      [{ type: "ligne", designation: "Prestation", quantite: 1, unite: "forfait", prix_unitaire: 100, tva: 20 }]
    );
  }

  it.each([
    ["le client", { client_nom: "CLIENT SUBSTITUÉ" }],
    ["la date", { date: "2020-01-01" }],
    ["l'adresse", { adresse: "9 rue d'Après" }],
    ["l'échéance", { echeance: "2099-12-31" }],
    ["le lieu d'intervention", { adresse_locataire: "ailleurs" }],
    ["la remise", { remise_pourcentage: 50 }],
  ])("refuse qu'on en change %s", async (_quoi, correction) => {
    const f = await emise();
    const { error } = await supabase.from("factures").update(correction).eq("id", f.id);
    expect(error).toBeTruthy();
    expect(error?.message).toMatch(/émise|avoir/i);
  });

  /* Le suivi du règlement est toute la vie de la facture après son émission :
     le geler rendrait l'encaissement impossible. */
  it("laisse le statut suivre l'encaissement", async () => {
    const f = await emise();
    const { error } = await supabase.from("factures").update({ statut: "payée" }).eq("id", f.id);
    expect(error).toBeNull();
  });

  it("laisse le suivi de la plateforme et l'affectation interne", async () => {
    const f = await emise();
    const { error } = await supabase
      .from("factures")
      .update({ statut_cycle: "deposee", conducteur: "Paul", verrouillee: true })
      .eq("id", f.id);
    expect(error).toBeNull();
  });

  /* Le service comptable du client déménage sans que la créance change. */
  it("laisse corriger l'adresse de facturation", async () => {
    const f = await emise();
    const { error } = await supabase
      .from("factures")
      .update({ facturation_adresse: "12 rue du Service Comptable" })
      .eq("id", f.id);
    expect(error).toBeNull();
  });

  /* L'écran réécrit la ligne entière à chaque enregistrement : réécrire une
     valeur à l'identique ne doit pas passer pour une modification, sinon plus
     rien ne s'enregistrerait du tout. */
  it("laisse réécrire les mêmes valeurs", async () => {
    const f = await emise();
    const { error } = await supabase
      .from("factures")
      .update({ client_nom: f.client_nom, date: f.date, adresse: f.adresse })
      .eq("id", f.id);
    expect(error).toBeNull();
  });

  /* Un brouillon se compose librement — c'est justement à quoi il sert. */
  it("laisse un brouillon libre", async () => {
    const brouillon = await queries.createFacture(
      societeId,
      { client_nom: "CLIENT DE TEST", date: aujourdhui, statut: "brouillon" },
      [{ type: "ligne", designation: "X", quantite: 1, unite: "forfait", prix_unitaire: 10, tva: 20 }]
    );
    expect(brouillon.numero ?? "").toBe("");
    const { error } = await supabase
      .from("factures")
      .update({ client_nom: "AUTRE", date: "2026-01-01" })
      .eq("id", brouillon.id);
    expect(error).toBeNull();
  });
});

/*
 * Compléter n'est pas modifier.
 *
 * 1 399 factures émises sur 1 792 n'avaient aucun lien vers la fiche de leur
 * client : le pont n'écrivait que son nom. Sans identifiant, la plateforme les
 * refuse — « le client doit être joignable ». Le gel doit laisser combler ce
 * vide, mais pas laisser désigner un autre acheteur.
 */
suite("Désigner l'acheteur d'une facture émise", () => {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  let societeId: Uuid;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error(`Société « ${TEST_SOCIETE_CODE} » introuvable`);
    societeId = societe.id;
  });

  async function emiseSansLien() {
    const f = await queries.createFacture(
      societeId,
      { client_nom: "CLIENT DE TEST", date: aujourdhui, statut: "impayée" },
      [{ type: "ligne", designation: "P", quantite: 1, unite: "forfait", prix_unitaire: 10, tva: 20 }]
    );
    await supabase.from("factures").update({ client_id: null, client_siret: null }).eq("id", f.id);
    return f;
  }

  it("laisse combler un lien client absent", async () => {
    const f = await emiseSansLien();
    const client = await queries.listClients(societeId);
    const cible = client.find((c: any) => c.nom === "CLIENT DE TEST");
    if (!cible) return;
    const { error } = await supabase
      .from("factures")
      .update({ client_id: cible.id, client_siret: "12345678901234" })
      .eq("id", f.id);
    expect(error).toBeNull();
  });

  /* Une fois l'acheteur désigné, il ne change plus : ce serait adresser la
     facture à quelqu'un d'autre après coup. */
  it("refuse qu'on désigne ensuite un autre acheteur", async () => {
    const f = await emiseSansLien();
    await supabase.from("factures").update({ client_siret: "11111111111111" }).eq("id", f.id);
    const { error } = await supabase
      .from("factures")
      .update({ client_siret: "99999999999999" })
      .eq("id", f.id);
    expect(error).toBeTruthy();
    expect(error?.message).toMatch(/émise|avoir/i);
  });

  /* Et vider un identifiant déjà porté n'est pas « compléter ». */
  it("refuse qu'on efface un identifiant déjà porté", async () => {
    const f = await emiseSansLien();
    await supabase.from("factures").update({ client_siret: "11111111111111" }).eq("id", f.id);
    const { error } = await supabase.from("factures").update({ client_siret: null }).eq("id", f.id);
    expect(error).toBeTruthy();
  });
});
