/**
 * Le circuit d'invitation, de bout en bout.
 *
 * Deux triggers sur `auth.users` le font vivre. Ils n'étaient pas versionnés :
 * une base locale fraîche avait les fonctions et personne pour les appeler, si
 * bien que ce circuit n'avait jamais été éprouvé ailleurs qu'en production.
 *
 * Ce qui se joue ici n'est pas du confort : c'est la frontière entre « je
 * connais l'adresse de quelqu'un » et « j'ai son rôle ». Le cas décisif est
 * donc le troisième — un compte créé mais non confirmé ne reçoit **rien**.
 *
 * Base locale uniquement. La clé `service_role` sert à fabriquer un compte non
 * confirmé, ce qu'aucune clé publique ne permet — c'est justement la garantie
 * qu'on vérifie. Elle vaut pour le conteneur et n'approche jamais le navigateur.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/api/client";
import type { RoleMembre } from "@/api/types";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";

const URL = process.env.VITE_SUPABASE_URL ?? "";
const ANON = process.env.VITE_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const EN_LOCAL = URL.includes("127.0.0.1") || URL.includes("localhost");

/* Sans pile locale, on ne joue pas : ces cas créent de vrais comptes. */
const suite = AUTH_DISPONIBLE && SERVICE && EN_LOCAL ? describe : describe.skip;

const MOT_DE_PASSE = "mot-de-passe-de-test-42";

suite("Circuit d'invitation", () => {
  const service = createClient(URL, SERVICE, { auth: { persistSession: false } });
  let societeId: string;
  const comptesCrees: string[] = [];

  beforeAll(async () => {
    const { data, error } = await supabase
      .from("societes")
      .select("id")
      .eq("code", TEST_SOCIETE_CODE)
      .single();
    if (error || !data) throw new Error("Société de test introuvable");
    societeId = data.id;
  });

  afterAll(async () => {
    for (const id of comptesCrees) await service.auth.admin.deleteUser(id);
  });

  /** L'administrateur pose l'invitation : c'est tout ce que l'écran fera. */
  async function inviter(email: string, role: RoleMembre) {
    const { error } = await supabase
      .from("invitations")
      .insert({ societe_id: societeId, email, role });
    if (error) throw new Error(`Invitation refusée : ${error.message}`);
  }

  /* Lu avec la clé de service : on veut savoir ce que la base contient, pas ce
     que la RLS veut bien montrer au compte de test. */
  async function rattachement(profileId: string) {
    const { data } = await service
      .from("membres_societe")
      .select("role, actif")
      .eq("profile_id", profileId)
      .eq("societe_id", societeId)
      .maybeSingle();
    return data;
  }

  /** Inscription ordinaire, à la clé publique — le geste du collaborateur. */
  async function sInscrire(email: string) {
    const anonyme = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data, error } = await anonyme.auth.signUp({
      email,
      password: MOT_DE_PASSE,
    });
    if (error) throw new Error(`Inscription refusée : ${error.message}`);
    comptesCrees.push(data.user!.id);
    return data.user!.id;
  }

  const adresse = (quoi: string) => `${quoi}.${Date.now()}@exemple.local`;

  it("rattache l'invité à sa société, avec le rôle invité", async () => {
    const email = adresse("invite");
    await inviter(email, "conducteur");

    const profileId = await sInscrire(email);

    expect(await rattachement(profileId)).toMatchObject({
      role: "conducteur",
      actif: true,
    });
  });

  it("marque l'invitation acceptée, pour qu'elle ne resserve pas", async () => {
    const email = adresse("accepte");
    await inviter(email, "lecture");

    await sInscrire(email);

    const { data } = await service
      .from("invitations")
      .select("statut")
      .eq("email", email)
      .single();
    expect(data?.statut).toBe("acceptee");
  });

  /* Le cas qui compte. S'inscrire avec l'adresse d'un autre ne doit rien
     donner : le rôle est accordé à la confirmation, pas à la demande. */
  it("n'accorde le rôle qu'une fois l'adresse confirmée", async () => {
    const email = adresse("non-confirme");
    await inviter(email, "technicien");

    const { data: cree, error } = await service.auth.admin.createUser({
      email,
      password: MOT_DE_PASSE,
      email_confirm: false,
    });
    if (error) throw new Error(`Création refusée : ${error.message}`);
    comptesCrees.push(cree.user!.id);

    expect(await rattachement(cree.user!.id)).toBeNull();

    await service.auth.admin.updateUserById(cree.user!.id, {
      email_confirm: true,
    });

    expect(await rattachement(cree.user!.id)).toMatchObject({
      role: "technicien",
      actif: true,
    });
  });

  /* Sans invitation, le compte existe mais n'ouvre rien : `mon_role()` renvoie
     null faute de `membres_societe`. C'est ce qui rend l'inscription libre
     sans danger — il n'y a pas d'autre garde, et il n'en faut pas d'autre. */
  it("ne donne aucun accès à qui s'inscrit sans invitation", async () => {
    const profileId = await sInscrire(adresse("sans-invitation"));

    expect(await rattachement(profileId)).toBeNull();

    const { data: profil } = await service
      .from("profiles")
      .select("id")
      .eq("id", profileId)
      .maybeSingle();
    expect(profil, "le profil est créé, mais vide de droits").not.toBeNull();
  });
});
