/**
 * Comptes et accès : membres, rôles, invitations, profil (AUTH-17, 20, 32, 40,
 * 42, 43). Chaque test travaille sur un compte JETABLE créé ici par
 * inscription (la base locale confirme d'office) — jamais sur les comptes du
 * jeu d'essai, que d'autres suites emploient en parallèle.
 *
 * Les tests marqués [proposition] dépendent de
 * supabase/propositions/20260926010000_profil_seul_le_nom_se_modifie.sql.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ALPHA, anonyme, COMPTES, connecte, MOT_DE_PASSE, type Client } from "./cible";

const ADMIN_ALPHA_ID = "a1000000-0000-0000-0000-000000000001";

/** Une adresse neuve par passage : une adresse déjà inscrite ne redéclenche rien. */
const adresse = (quoi: string) => `essai.soc.${quoi}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@erp.local`;

async function inscrire(email: string): Promise<{ client: Client; id: string }> {
  const client = anonyme();
  const { data, error } = await client.auth.signUp({ email, password: MOT_DE_PASSE, options: { data: { nom: "Compte jetable" } } });
  if (error || !data.user) throw new Error(`Inscription de ${email} impossible : ${error?.message ?? "aucun compte"}`);
  return { client, id: data.user.id };
}

let admin: Client;
let jetable: { client: Client; id: string; email: string };
let membreId = "";
const membresCrees: string[] = [];
const invitationsCrees: string[] = [];

beforeAll(async () => {
  admin = await connecte(COMPTES.adminAlpha);
  const email = adresse("membre");
  jetable = { ...(await inscrire(email)), email };
  const { data, error } = await admin
    .from("membres_societe")
    .insert({ profile_id: jetable.id, societe_id: ALPHA, role: "lecture", actif: true })
    .select("id")
    .single();
  if (error) throw new Error(`Rattachement du compte jetable impossible : ${error.message}`);
  membreId = data.id;
  membresCrees.push(data.id);
});

afterAll(async () => {
  if (membresCrees.length) await admin.from("membres_societe").delete().in("id", membresCrees);
  if (invitationsCrees.length) await admin.from("invitations").delete().in("id", invitationsCrees);
});

describe("membres : l'administrateur gère, la base protège le dernier admin", () => {
  it("l'administrateur change le rôle d'un membre (AUTH-20)", async () => {
    const { data, error } = await admin.from("membres_societe").update({ role: "technicien" }).eq("id", membreId).select("role");
    expect(error).toBeNull();
    expect(data?.[0]?.role).toBe("technicien");
  });

  it("un membre non administrateur ne change aucun rôle (zéro ligne)", async () => {
    const lecture = await connecte(COMPTES.lectureAlpha);
    const { data } = await lecture.from("membres_societe").update({ role: "admin" }).eq("id", membreId).select("id");
    expect(data ?? []).toEqual([]);
  });

  it("l'administrateur ne peut pas se retirer son propre rôle (AUTH-40)", async () => {
    const { error } = await admin.from("membres_societe").update({ role: "lecture" }).eq("profile_id", ADMIN_ALPHA_ID).eq("societe_id", ALPHA);
    expect(error?.code).toBe("42501");
    expect(error?.message).toMatch(/propre role administrateur/);
  });

  it("désactiver l'accès coupe la société au compte, réactiver la lui rend (AUTH-32)", async () => {
    await admin.from("membres_societe").update({ actif: false }).eq("id", membreId);
    const coupe = await jetable.client.from("societes").select("id").eq("id", ALPHA);
    expect(coupe.data ?? []).toEqual([]);
    await admin.from("membres_societe").update({ actif: true }).eq("id", membreId);
    const rendu = await jetable.client.from("societes").select("id").eq("id", ALPHA);
    expect(rendu.data?.length).toBe(1);
  });

  it("tout membre lit les membres de sa société, noms compris", async () => {
    const lecture = await connecte(COMPTES.lectureAlpha);
    const { data } = await lecture.from("membres_societe").select("profile_id, profil:profiles(nom)").eq("societe_id", ALPHA);
    expect(data?.some((m) => m.profile_id === ADMIN_ALPHA_ID && m.profil?.nom)).toBe(true);
  });
});

describe("invitations (AUTH-42, 43)", () => {
  it("une invitation en attente s'applique à l'inscription confirmée : membre, rôle, statut « acceptée »", async () => {
    const email = adresse("invite");
    const { data: inv, error } = await admin
      .from("invitations")
      .insert({ societe_id: ALPHA, email, role: "secretaire", statut: "en_attente", salarie_id: null, sous_traitant_id: null, cree_par: ADMIN_ALPHA_ID })
      .select("id")
      .single();
    expect(error).toBeNull();
    if (inv) invitationsCrees.push(inv.id);

    const invite = await inscrire(email);
    const { data: membre } = await admin.from("membres_societe").select("id, role, actif").eq("profile_id", invite.id).eq("societe_id", ALPHA).single();
    if (membre) membresCrees.push(membre.id);
    expect(membre?.role).toBe("secretaire");
    expect(membre?.actif).toBe(true);
    const { data: relue } = await admin.from("invitations").select("statut").eq("id", inv?.id ?? "").single();
    expect(relue?.statut).toBe("acceptee");
  });

  it("une adresse ne porte qu'une invitation par société, casse comprise", async () => {
    const email = adresse("double");
    const { data } = await admin.from("invitations").insert({ societe_id: ALPHA, email, role: "lecture", statut: "en_attente" }).select("id").single();
    if (data) invitationsCrees.push(data.id);
    const { error } = await admin.from("invitations").insert({ societe_id: ALPHA, email: email.toUpperCase(), role: "lecture", statut: "en_attente" });
    expect(error?.code).toBe("23505");
  });

  it("seul l'administrateur invite ; un membre lit les invitations sans les écrire", async () => {
    const secretaire = await connecte(COMPTES.secretaireAlpha);
    const { error } = await secretaire.from("invitations").insert({ societe_id: ALPHA, email: adresse("intrus"), role: "admin", statut: "en_attente" });
    expect(error?.code).toBe("42501");
  });
});

describe("profil : chacun renomme le sien, rien de plus (AUTH-17)", () => {
  it("un compte renomme son propre profil", async () => {
    const { data, error } = await jetable.client.from("profiles").update({ nom: "Jetable renommé" }).eq("id", jetable.id).select("nom");
    expect(error).toBeNull();
    expect(data?.[0]?.nom).toBe("Jetable renommé");
  });

  it("un compte ne renomme pas le profil d'un autre (zéro ligne)", async () => {
    const { data } = await jetable.client.from("profiles").update({ nom: "Pirate" }).eq("id", ADMIN_ALPHA_ID).select("id");
    expect(data ?? []).toEqual([]);
  });

  it("[proposition] un compte ne touche pas à son propre `actif` : il se réactiverait après avoir été coupé", async () => {
    const { error } = await jetable.client.from("profiles").update({ actif: true }).eq("id", jetable.id);
    expect(error?.code).toBe("42501");
  });

  it("[proposition] un compte ne s'attribue pas l'adresse d'un autre dans l'annuaire", async () => {
    const { error } = await jetable.client.from("profiles").update({ email: COMPTES.adminAlpha }).eq("id", jetable.id);
    expect(error?.code).toBe("42501");
  });
});
