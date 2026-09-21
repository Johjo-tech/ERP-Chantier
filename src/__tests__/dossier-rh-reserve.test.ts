/**
 * Le dossier RH suit le droit RH, et non le droit de voir les prix.
 *
 * Les vingt colonnes sensibles de `v_salaries_annuaire` — IBAN, salaire net,
 * date et lieu de naissance, nationalité, situation familiale — étaient gardées
 * par `voit_les_prix(societe_id)`, qui vaut
 *
 *     mon_role(societe) not in ('technicien', 'sous_traitant')
 *
 * soit VRAI pour l'administrateur, la secrétaire, le conducteur ET le rôle
 * `lecture`. Un compte en consultation seule lisait donc les coordonnées
 * bancaires et la date de naissance de chaque salarié.
 *
 * Ce garde répond à « cette personne voit-elle les montants d'un devis ». Le
 * droit qui convient existe déjà dans la matrice et désigne exactement ceux qui
 * administrent le personnel : `rh/modifier`, accordé à l'admin et à la
 * secrétaire.
 *
 * Ces tests écrivent vraiment, contre la base locale.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as queries from "@/api/queries";
import { supabase } from "@/api/client";
import type { Uuid } from "@/api/types";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const CLE = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const EN_LOCAL = /127\.0\.0\.1|localhost/.test(URL ?? "");
const suite = AUTH_DISPONIBLE && EN_LOCAL ? describe : describe.skip;

/** Les comptes de rôle de `supabase/seed-tests.sql`, locaux par construction. */
async function session(email: string): Promise<SupabaseClient> {
  const client = createClient(URL, CLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: "motdepasse-test",
  });
  if (error) throw new Error(`Connexion ${email} impossible : ${error.message}`);
  return client;
}

const IBAN = "FR7630006000011234567890189";

suite("Le dossier RH n'est pas l'annuaire", () => {
  let salarieId: Uuid;
  let secretaire: SupabaseClient;
  let conducteur: SupabaseClient;

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error(`Société « ${TEST_SOCIETE_CODE} » introuvable`);

    const { data, error } = await supabase
      .from("salaries")
      .insert({
        societe_id: societe.id,
        nom: "SONDE",
        prenom: "Dossier",
        iban: IBAN,
        salaire_mensuel_net: 2100,
        date_naissance: "1985-04-12",
        situation_familiale: "Marié(e)",
      })
      .select("id")
      .single();
    if (error) throw new Error(`Salarié de sonde impossible : ${error.message}`);
    salarieId = data.id as Uuid;

    /* Le conducteur tient lieu de témoin pour tous les rôles que l'ancien garde
       laissait passer — `voit_les_prix` répondait VRAI pour lui comme pour
       `lecture`, et le nouveau garde `rh/modifier` les exclut tous les deux.
       Seuls les comptes `@local` de `seed-tests.sql` partagent le mot de passe
       d'essai, et il n'y a pas de `lecture@local`. */
    [secretaire, conducteur] = await Promise.all([
      session("secretaire@local"),
      session("conducteur@local"),
    ]);
  });

  afterAll(async () => {
    if (salarieId) await supabase.from("salaries").delete().eq("id", salarieId);
  });

  /** Ce que la vue doit rendre : l'annuaire, pour tout le monde. */
  async function ligne(client: SupabaseClient) {
    const { data } = await client
      .from("v_salaries_annuaire")
      .select("nom, prenom, iban, salaire_mensuel_net, date_naissance, situation_familiale")
      .eq("id", salarieId)
      .maybeSingle();
    return data;
  }

  it("laisse l'annuaire visible — nom et prénom", async () => {
    const l = await ligne(conducteur);
    expect(l?.nom).toBe("SONDE");
    expect(l?.prenom).toBe("Dossier");
  });

  /* LE défaut. Avant ce correctif, chacune de ces lignes rendait la vraie
     valeur — au conducteur comme au rôle `lecture`, en consultation seule. */
  it("cache l'IBAN à qui n'administre pas le personnel — c'était la fuite", async () => {
    expect((await ligne(conducteur))?.iban).toBeNull();
  });

  it("cache aussi salaire, naissance et situation familiale", async () => {
    const l = await ligne(conducteur);
    expect(l?.salaire_mensuel_net).toBeNull();
    expect(l?.date_naissance).toBeNull();
    expect(l?.situation_familiale).toBeNull();
  });

  /* Et le contrôle qui prouve que la vue n'est pas simplement cassée : celle
     qui a le droit RH voit bien tout. Sans lui, les trois tests ci-dessus
     passeraient sur une vue qui ne rendrait plus rien à personne. */
  it("laisse le dossier complet à la secrétaire, qui administre le personnel", async () => {
    const l = await ligne(secretaire);
    expect(l?.iban).toBe(IBAN);
    expect(Number(l?.salaire_mensuel_net)).toBe(2100);
    expect(l?.situation_familiale).toBe("Marié(e)");
  });
});
