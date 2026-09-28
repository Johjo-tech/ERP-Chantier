/**
 * [proposition] Les fonctions de bord CORRIGÉES proposées par web/
 * (`supabase/propositions/fonctions/`, jamais déployées), exécutées telles quelles
 * contre la base LOCALE par `bord/charger.ts` — comme `inviter-salarie.essai.ts`
 * le fait pour l'originale :
 *
 *   DEF-REP-11  extraire-bc : un jeton anon ou un compte sans « bons_commande / créer » est refusé
 *   DEF-REP-12  fonctions PDP : la matrice décide (dépôt : « factures / modifier ») ;
 *               le secret du webhook se compare à temps constant
 *   DEF-REP-06  inviter-salarie : un sous-traitant s'invite, avec `sous_traitant_id`
 *   DEF-REP-13  inviter-salarie : un compte existant se trouve au-delà de la 1re page d'Auth
 *
 * Aucun appel ne part vers Mistral ni vers la plateforme : chaque cas s'arrête au
 * contrôle essayé, ou juste après (clé Mistral absente, facture non numérotée).
 * Écrit, NON LANCÉ (brief du 28/09) : à passer par `npm run test:rls`.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ALPHA, COMPTES, connecte, type Client } from "./cible";
import { chargerFonctionDeBord, RACINE_PROPOSITIONS, type EnvBord } from "./bord/charger";

const URL_API = process.env.RLS_API_URL ?? "";
const CLE_ANON = process.env.RLS_ANON_KEY ?? "";
const CLE_SERVICE = process.env.RLS_SERVICE_ROLE_KEY ?? "";
const SECRET_WEBHOOK = "secret-webhook-essai-rls";
const TRACE = Date.now();
const MARQUE = "Essai RLS FDB";

type Gestionnaire = (req: Request) => Response | Promise<Response>;

const env: EnvBord = { url: URL_API, cleAnon: CLE_ANON, cleService: CLE_SERVICE, site: "http://localhost:5173", autres: { SUPERPDP_WEBHOOK_SECRET: SECRET_WEBHOOK } };

async function jeton(c: Client): Promise<string> {
  const { data } = await c.auth.getSession();
  const t = data.session?.access_token;
  if (!t) throw new Error("session sans jeton");
  return t;
}

function appel(g: Gestionnaire, nom: string, jetonAppelant: string, corps: unknown, entetes: Record<string, string> = {}) {
  return g(new Request(`${URL_API}/functions/v1/${nom}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jetonAppelant}`, apikey: CLE_ANON, "Content-Type": "application/json", ...entetes },
    body: JSON.stringify(corps),
  }));
}

describe.skipIf(!CLE_SERVICE)("[proposition] fonctions de bord corrigées (DEF-REP-06, 11, 12, 13)", () => {
  let admin: Client;
  let lecture: Client;
  let technicien: Client;
  let extraire: Gestionnaire;
  let emettre: Gestionnaire;
  let deconnecter: Gestionnaire;
  let webhook: Gestionnaire;
  let inviter: Gestionnaire;
  const service = createClient(URL_API, CLE_SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  const factures: string[] = [];
  const sousTraitants: string[] = [];
  const salaries: string[] = [];

  beforeAll(async () => {
    [admin, lecture, technicien] = await Promise.all([connecte(COMPTES.adminAlpha), connecte(COMPTES.lectureAlpha), connecte(COMPTES.technicienAlpha)]);
    // Chargées l'une après l'autre : chacune confie son gestionnaire au registre commun.
    extraire = await chargerFonctionDeBord("extraire-bc", env, RACINE_PROPOSITIONS);
    emettre = await chargerFonctionDeBord("pdp-emit-invoice", env, RACINE_PROPOSITIONS);
    deconnecter = await chargerFonctionDeBord("pdp-disconnect", env, RACINE_PROPOSITIONS);
    webhook = await chargerFonctionDeBord("pdp-webhook", env, RACINE_PROPOSITIONS);
    inviter = await chargerFonctionDeBord("inviter-salarie", env, RACINE_PROPOSITIONS);
  });

  afterAll(async () => {
    if (!admin) return;
    if (factures.length) await admin.from("factures").delete().in("id", factures).is("numero", null);
    await admin.from("invitations").delete().in("sous_traitant_id", sousTraitants);
    await admin.from("invitations").delete().in("salarie_id", salaries);
    if (sousTraitants.length) await admin.from("sous_traitants").delete().in("id", sousTraitants);
    if (salaries.length) await admin.from("salaries").delete().in("id", salaries);
    for (let page = 1; page <= 20; page++) {
      const { data } = await service.auth.admin.listUsers({ page, perPage: 1000 });
      const users = data?.users ?? [];
      for (const u of users) {
        if (u.email?.endsWith(`.${TRACE}@erp.local`)) {
          const { error } = await service.auth.admin.deleteUser(u.id);
          if (error) console.error(`Compte d'essai ${u.email} non supprimé`, error);
        }
      }
      if (users.length < 1000) break;
    }
  });

  describe("extraire-bc (DEF-REP-11)", () => {
    const corps = { fichierBase64: "JVBERi0xLjQK", mimeType: "application/pdf" };

    it("la clé anon — qui passe verify_jwt — est refusée (401)", async () => {
      const r = await appel(extraire, "extraire-bc", CLE_ANON, corps);
      expect(r.status).toBe(401);
    });

    it("un compte sans « bons_commande / créer » (lecture) est refusé (403)", async () => {
      const r = await appel(extraire, "extraire-bc", await jeton(lecture), corps);
      expect(r.status).toBe(403);
      expect(await r.json()).toEqual({ erreur: "La lecture automatique est réservée à qui peut créer un bon de commande." });
    });

    it("l'administrateur passe le contrôle (et bute ensuite sur la clé Mistral, absente en local)", async () => {
      const r = await appel(extraire, "extraire-bc", await jeton(admin), corps);
      expect(r.status).toBe(500);
      expect(await r.json()).toEqual({ erreur: "MISTRAL_API_KEY absente des secrets Supabase" });
    });
  });

  describe("fonctions PDP (DEF-REP-12)", () => {
    const xml = "<rsm:CrossIndustryInvoice><ram:ID>X</ram:ID></rsm:CrossIndustryInvoice>";

    async function brouillon(): Promise<string> {
      const { data, error } = await admin.from("factures").insert({ societe_id: ALPHA, client_nom: `${MARQUE} ${TRACE}`, statut: "brouillon", type_document: "facture", date: "2026-09-28" }).select("id").single();
      if (error) throw error;
      factures.push(data.id);
      return data.id;
    }

    it("le rôle lecture ne dépose pas une facture (403) ; l'administrateur passe le contrôle des droits", async () => {
      const id = await brouillon();
      const refus = await appel(emettre, "pdp-emit-invoice", await jeton(lecture), { facture_id: id, xml });
      expect(refus.status).toBe(403);
      // L'administrateur passe les droits et s'arrête au contrôle suivant : la facture n'est pas numérotée.
      const suite = await appel(emettre, "pdp-emit-invoice", await jeton(admin), { facture_id: id, xml });
      expect(suite.status).toBe(400);
      expect(await suite.json()).toEqual({ error: "Numérotez la facture avant de la transmettre." });
    });

    it("un technicien ne déconnecte pas la plateforme (403)", async () => {
      const r = await appel(deconnecter, "pdp-disconnect", await jeton(technicien), { societe_id: ALPHA });
      expect(r.status).toBe(403);
    });

    it("webhook : mauvais secret 401 (même longueur, même préfixe), bon secret accepté", async () => {
      const faux = SECRET_WEBHOOK.slice(0, -1) + "X";
      const refus = await appel(webhook, "pdp-webhook", CLE_ANON, {}, { "x-webhook-secret": faux });
      expect(refus.status).toBe(401);
      const accepte = await appel(webhook, "pdp-webhook", CLE_ANON, {}, { "x-webhook-secret": SECRET_WEBHOOK });
      expect(await accepte.json()).toEqual({ recu: true, ignore: true });
    });
  });

  describe("inviter-salarie (DEF-REP-06, DEF-REP-13)", () => {
    const adresse = (quoi: string) => `invite.${quoi}.${TRACE}@erp.local`;

    async function sousTraitant(nom: string): Promise<string> {
      const { data, error } = await admin.from("sous_traitants").insert({ societe_id: ALPHA, nom: `${MARQUE} ${nom}` }).select("id").single();
      if (error) throw error;
      sousTraitants.push(data.id);
      return data.id;
    }

    it("un sous-traitant s'invite : invitation « sous_traitant » portant sa fiche (DEF-REP-06)", async () => {
      const id = await sousTraitant("Plomberie");
      const r = await appel(inviter, "inviter-salarie", await jeton(admin), { sous_traitant_id: id, email: adresse("st"), role: "sous_traitant" });
      expect(await r.json()).toEqual({ etat: "invitee", email: adresse("st") });
      const { data } = await admin.from("invitations").select("role, statut, salarie_id, sous_traitant_id").eq("sous_traitant_id", id).single();
      expect(data).toMatchObject({ role: "sous_traitant", statut: "en_attente", salarie_id: null, sous_traitant_id: id });
    });

    it("un autre rôle pour un sous-traitant, ou les deux fiches à la fois, sont refusés (400)", async () => {
      const id = await sousTraitant("Refus");
      const role = await appel(inviter, "inviter-salarie", await jeton(admin), { sous_traitant_id: id, email: adresse("st2"), role: "technicien" });
      expect(role.status).toBe(400);
      const deux = await appel(inviter, "inviter-salarie", await jeton(admin), { sous_traitant_id: id, salarie_id: id, email: adresse("st3"), role: "sous_traitant" });
      expect(deux.status).toBe(400);
    });

    it("un compte confirmé au-delà de la 1re page d'Auth est retrouvé et rattaché (DEF-REP-13)", async () => {
      const cible = adresse("loin");
      const creee = await service.auth.admin.createUser({ email: cible, email_confirm: true, password: `Mdp-${TRACE}-essai` });
      expect(creee.error).toBeNull();
      // Au moins 51 comptes APRÈS la cible : `listUsers()` sans page ne rend que les 50 premiers.
      for (let i = 0; i < 55; i++) {
        const { error } = await service.auth.admin.createUser({ email: adresse(`remplissage${i}`), email_confirm: true, password: `Mdp-${TRACE}-${i}` });
        if (error) throw error;
      }
      const premiere = await service.auth.admin.listUsers();
      if ((premiere.data?.users ?? []).some((u) => u.email === cible)) {
        console.warn("La cible est sur la 1re page d'Auth (ordre du serveur) : ce cas ne prouve pas la pagination sur cette base.");
      }
      const { data: s, error } = await admin.from("salaries").insert({ societe_id: ALPHA, nom: `${MARQUE} Loin`, prenom: "Invité", actif: true }).select("id").single();
      if (error) throw error;
      salaries.push(s.id);
      const r = await appel(inviter, "inviter-salarie", await jeton(admin), { salarie_id: s.id, email: cible, role: "lecture" });
      expect(await r.json()).toEqual({ etat: "rattachee", email: cible });
    });
  });
});
