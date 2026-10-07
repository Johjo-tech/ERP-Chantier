/**
 * AUTH-52 — la fonction de bord `inviter-salarie`, de bout en bout, contre la
 * base LOCALE : l'écran appelle `inviterSalarie()` (module comptes), la requête
 * `functions.invoke` est servie par le code de la fonction TEL QUEL (voir
 * `bord/charger.ts`), qui écrit l'invitation et fabrique l'identité en base
 * locale. Contrat, statuts et motifs vérifiés d'un bout à l'autre.
 *
 * Tout ce qui est créé (salariés, invitations, comptes) est supprimé à la fin.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ALPHA, COMPTES, connecte, type Client } from "./cible";
import { chargerFonctionDeBord } from "./bord/charger";

const courant = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase", () => ({ supabase: () => courant.client, supabasePropositions: () => courant.client }));
const { inviterSalarie } = await import("../../src/modules/comptes/api/comptes");

const URL_API = process.env.RLS_API_URL ?? "";
const CLE_ANON = process.env.RLS_ANON_KEY ?? "";
const CLE_SERVICE = process.env.RLS_SERVICE_ROLE_KEY ?? "";
const TRACE = Date.now();
const adresse = (quoi: string) => `invite.${quoi}.${TRACE}@erp.local`;

let admin: Client;
let secretaire: Client;
const salaries: string[] = [];
const vraiFetch = globalThis.fetch;

async function nouveauSalarie(nom: string, profileId: string | null = null): Promise<string> {
  const { data, error } = await admin.from("salaries").insert({ societe_id: ALPHA, nom, prenom: "Invité", actif: true, profile_id: profileId }).select("id").single();
  if (error) throw error;
  salaries.push(data.id);
  return data.id;
}

describe.skipIf(!CLE_SERVICE)("inviter-salarie de bout en bout (AUTH-52)", () => {
  beforeAll(async () => {
    const gestionnaire = await chargerFonctionDeBord("inviter-salarie", { url: URL_API, cleAnon: CLE_ANON, cleService: CLE_SERVICE, site: "http://localhost:5173" });
    // `functions.invoke` vise /functions/v1/<nom> : servi ici par la fonction ; tout le reste part vers la base locale.
    globalThis.fetch = (async (entree: RequestInfo | URL, init?: RequestInit) => {
      const requete = new Request(entree, init);
      return new URL(requete.url).pathname === "/functions/v1/inviter-salarie" ? gestionnaire(requete) : vraiFetch(requete);
    }) as typeof fetch;
    [admin, secretaire] = await Promise.all([connecte(COMPTES.adminAlpha), connecte(COMPTES.secretaireAlpha)]);
  });

  afterAll(async () => {
    globalThis.fetch = vraiFetch;
    if (!admin) return;
    const service = createClient(URL_API, CLE_SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
    await admin.from("invitations").delete().in("salarie_id", salaries);
    const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
    for (const u of data?.users ?? []) {
      if (u.email?.endsWith(`.${TRACE}@erp.local`)) {
        const { error } = await service.auth.admin.deleteUser(u.id);
        if (error) console.error(`Compte d'essai ${u.email} non supprimé`, error);
      }
    }
    await admin.from("salaries").delete().in("id", salaries);
  });

  it("l'administrateur invite : { etat: invitee }, invitation « en attente » datée, identité créée", async () => {
    courant.client = admin;
    const id = await nouveauSalarie("Nouveau");
    const r = await inviterSalarie(id, { email: adresse("nouveau"), role: "technicien" });
    expect(r).toEqual({ etat: "invitee", email: adresse("nouveau") });
    const { data } = await admin.from("invitations").select("statut, role, invitee_le").eq("salarie_id", id).single();
    expect(data).toMatchObject({ statut: "en_attente", role: "technicien" });
    expect(data?.invitee_le).not.toBeNull();
  });

  it("un renvoi dans les 10 minutes est refusé (429), avec le délai restant repris tel quel", async () => {
    courant.client = admin;
    const id = salaries[0] ?? "";
    await expect(inviterSalarie(id, { email: adresse("nouveau"), role: "technicien" })).rejects.toThrow("Invitation déjà envoyée. Réessayez dans 10 min.");
  });

  it("la secrétaire n'invite pas (403) : la RLS des invitations décide, le motif arrive à l'écran", async () => {
    courant.client = secretaire;
    const id = await nouveauSalarie("Refusé");
    await expect(inviterSalarie(id, { email: adresse("refuse"), role: "technicien" })).rejects.toThrow("Seul un administrateur de la société peut inviter un salarié.");
  });

  it("un salarié déjà relié à un compte n'est pas réinvité (409)", async () => {
    courant.client = admin;
    const id = await nouveauSalarie("Déjà relié", "a1000000-0000-0000-0000-000000000005");
    await expect(inviterSalarie(id, { email: adresse("relie"), role: "lecture" })).rejects.toThrow("Ce salarié a déjà un compte rattaché.");
  });

  it("un rôle hors liste (sous-traitant) est refusé (400) avant toute écriture", async () => {
    courant.client = admin;
    const id = await nouveauSalarie("Sous-traitant");
    // L'écran ne propose pas ce rôle (le type l'exclut) ; la fonction doit le refuser quand même.
    const horsListe = { email: adresse("st"), role: "sous_traitant" } as unknown as Parameters<typeof inviterSalarie>[1];
    await expect(inviterSalarie(id, horsListe)).rejects.toThrow("Rôle impossible pour un salarié : sous_traitant.");
    expect((await admin.from("invitations").select("id").eq("salarie_id", id)).data).toEqual([]);
  });
});
