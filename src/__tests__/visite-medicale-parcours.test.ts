/**
 * Le registre des visites médicales, contre la base.
 *
 * Ce que les règles pures ne peuvent pas prouver : que la ligne arrive, que
 * l'attestation se range sous `<societeId>/salaries/…`, que l'URL signée
 * l'ouvre — et surtout que les deux déclencheurs tiennent l'étiquette.
 *
 * Le cas décisif est le troisième. L'écran repose la fiche salarié ENTIÈRE à
 * chaque « Enregistrer », `visite_medicale_prochaine` comprise : sans le
 * déclencheur de retour, le premier enregistrement rendrait à cette colonne la
 * valeur affichée, c'est-à-dire la précédente, et l'échéance dériverait sans
 * que personne ne le voie. Griser le champ à l'écran ne protégerait de rien —
 * c'est la base qui doit refuser, et c'est ce qu'on vérifie ici.
 *
 * Écrit vraiment : ne tourne que sur la pile locale.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BUCKET, supabase } from "@/api/client";
import * as queries from "@/api/queries";
import type { Uuid } from "@/api/types";
import {
  ajouterVisiteMedicale,
  chargerVisitesMedicales,
  majVisiteMedicale,
  ouvrirAttestationVisite,
  purgerVisitesMedicales,
  supprimerVisiteMedicale,
} from "@/integrations/visites-medicales";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";

const URL = import.meta.env.VITE_SUPABASE_URL as string;
const CLE = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const suite = AUTH_DISPONIBLE ? describe : describe.skip;

/** Un PDF minuscule mais réel : le stockage refuse un contenu vide. */
function attestation(nom: string): File {
  const octets = new TextEncoder().encode("%PDF-1.4\n% attestation de test\n%%EOF\n");
  return new File([octets], nom, { type: "application/pdf" });
}

suite("Registre des visites médicales", () => {
  let societeId: Uuid;
  let salarieId: Uuid;
  /** La clé de service voit la table, pas seulement ce que la RLS en montre. */
  let service: SupabaseClient | null = null;

  async function colonnesDeLaFiche() {
    const client = service ?? supabase;
    const { data } = await client
      .from("salaries")
      .select("visite_medicale_date, visite_medicale_prochaine")
      .eq("id", salarieId)
      .single();
    return data as { visite_medicale_date: string | null; visite_medicale_prochaine: string | null };
  }

  beforeAll(async () => {
    if (SERVICE) {
      service = createClient(URL, SERVICE, { auth: { persistSession: false } });
    }
    const societes = await queries.listMesSocietes();
    const societe = societes.find((s) => s.code === TEST_SOCIETE_CODE) ?? societes[0];
    if (!societe) throw new Error("Aucune société accessible au compte de test");
    societeId = societe.id;

    const salarie = await queries.createSalarie(societeId, {
      nom: "SUIVI DE TEST",
      prenom: "Parcours",
      poste: "Couvreur",
    });
    salarieId = salarie.id;
  });

  afterAll(async () => {
    if (!salarieId) return;
    await purgerVisitesMedicales(salarieId);
    await queries.deleteSalarie(salarieId);
  });

  it("enregistre une visite, attestation comprise, et la relit", async () => {
    const posee = await ajouterVisiteMedicale(
      salarieId,
      {
        dateVisite: "2026-09-10",
        type: "embauche",
        suivi: "renforce",
        organisme: "APST BTP",
        medecin: "Dr Martin",
        avis: "apte_amenagements",
        reserves: "Pas de port de charge supérieure à 15 kg",
        prochaineVisite: "2028-09-10",
        notes: "",
      },
      attestation("avis d'aptitude — Côte d'Azur.pdf")
    );

    expect(posee.avis).toBe("apte_amenagements");
    expect(posee.reserves).toContain("15 kg");
    /* Le nom d'origine est conservé, le chemin est assaini. */
    expect(posee.fichierNom).toBe("avis d'aptitude — Côte d'Azur.pdf");
    expect(posee.fichierChemin).toMatch(
      new RegExp(`^${societeId}/salaries/${salarieId}/\\d+_`)
    );
    expect(posee.fichierChemin).not.toMatch(/[éèêàçÉ—']/);
    /* La chaîne vide de l'écran ne doit pas arriver telle quelle. */
    expect(posee.notes).toBeNull();

    const relues = await chargerVisitesMedicales([salarieId]);
    expect(relues.map((v) => v.id)).toContain(posee.id);
  });

  it("rend une URL signée qui ouvre vraiment l'attestation", async () => {
    const [v] = await chargerVisitesMedicales([salarieId]);
    const ouvert = await ouvrirAttestationVisite(v);
    expect(ouvert).not.toBeNull();
    expect(ouvert!.mime).toBe("application/pdf");

    const reponse = await fetch(ouvert!.url);
    expect(reponse.ok).toBe(true);
    expect(await reponse.text()).toContain("%PDF-1.4");
  });

  it("tire les deux dates de la fiche salarié", async () => {
    const fiche = await colonnesDeLaFiche();
    expect(fiche.visite_medicale_date).toBe("2026-09-10");
    expect(fiche.visite_medicale_prochaine).toBe("2028-09-10");
  });

  it("refuse que la fiche écrase l'échéance — le geste qui casserait tout", async () => {
    /* C'est exactement ce que fait `saveSalarie()` : il repose la fiche
       entière, ces deux colonnes comprises. La base doit les re-dériver. */
    await queries.updateSalarie(salarieId, {
      visite_medicale_prochaine: "2099-01-01",
      visite_medicale_date: "2099-01-01",
    });
    const fiche = await colonnesDeLaFiche();
    expect(fiche.visite_medicale_prochaine).toBe("2028-09-10");
    expect(fiche.visite_medicale_date).toBe("2026-09-10");
  });

  it("ne rajeunit rien quand on saisit après coup une visite ancienne", async () => {
    await ajouterVisiteMedicale(salarieId, {
      dateVisite: "2019-01-01",
      type: "periodique",
      suivi: "simple",
      prochaineVisite: "2024-01-01",
    });
    const fiche = await colonnesDeLaFiche();
    expect(fiche.visite_medicale_prochaine).toBe("2028-09-10");
  });

  it("remplace l'attestation et efface l'ancienne", async () => {
    const recente = (await chargerVisitesMedicales([salarieId])).find(
      (v) => v.dateVisite === "2026-09-10"
    )!;
    const ancienChemin = recente.fichierChemin!;

    const apres = await majVisiteMedicale(
      recente.id,
      {
        dateVisite: recente.dateVisite,
        type: recente.type,
        suivi: recente.suivi,
        organisme: recente.organisme,
        medecin: recente.medecin,
        avis: "apte",
        reserves: "",
        prochaineVisite: recente.prochaineVisite,
        notes: recente.notes,
      },
      attestation("avis-v2.pdf")
    );

    expect(apres.id).toBe(recente.id);
    expect(apres.avis).toBe("apte");
    expect(apres.reserves).toBeNull();
    expect(apres.fichierChemin).not.toBe(ancienChemin);

    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(ancienChemin, 60);
    expect(data).toBeNull();
  });

  it("refuse une échéance antérieure à la visite", async () => {
    /* La base refuse, pas l'écran : un contrôle qui ne vit que dans le
       navigateur n'en est pas un. */
    await expect(
      ajouterVisiteMedicale(salarieId, {
        dateVisite: "2026-09-10",
        type: "periodique",
        suivi: "simple",
        prochaineVisite: "2026-01-01",
      })
    ).rejects.toThrow();
  });

  it("refuse un avis qui n'existe pas", async () => {
    await expect(
      ajouterVisiteMedicale(salarieId, {
        dateVisite: "2026-09-11",
        type: "periodique",
        suivi: "simple",
        avis: "plutot apte",
      })
    ).rejects.toThrow();
  });

  it("rend les colonnes à NULL quand le registre se vide", async () => {
    const visites = await chargerVisitesMedicales([salarieId]);
    const chemins = visites.map((v) => v.fichierChemin).filter(Boolean) as string[];
    for (const v of visites) await supprimerVisiteMedicale(v);

    expect(await chargerVisitesMedicales([salarieId])).toEqual([]);
    const fiche = await colonnesDeLaFiche();
    expect(fiche.visite_medicale_date).toBeNull();
    expect(fiche.visite_medicale_prochaine).toBeNull();

    for (const chemin of chemins) {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(chemin, 60);
      expect(data).toBeNull();
    }
  });
});

/**
 * La donnée de santé ne se lit pas à la ronde.
 *
 * Un avis d'inaptitude, des réserves médicales : cela suit la fiche salarié,
 * fermée à `rh/modifier`, et non `est_membre` comme l'étaient les autres
 * tables filles jusqu'à 20260918090000. Le test qui garde cette limite vaut à
 * lui seul la suite — c'est celui qui rendrait visible une régression de RLS.
 */
const EN_LOCAL = /127\.0\.0\.1|localhost/.test(URL ?? "");
const suiteRls = AUTH_DISPONIBLE && EN_LOCAL && SERVICE ? describe : describe.skip;

suiteRls("Cloisonnement du suivi médical", () => {
  const MOT_DE_PASSE = "motdepasse-test";
  let salarieId: Uuid;

  async function ouvrirSession(email: string): Promise<SupabaseClient> {
    const client = createClient(URL, CLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.auth.signInWithPassword({ email, password: MOT_DE_PASSE });
    if (error) throw new Error(`Connexion ${email} impossible : ${error.message}`);
    return client;
  }

  beforeAll(async () => {
    const societes = await queries.listMesSocietes();
    const societe = societes.find((s) => s.code === TEST_SOCIETE_CODE) ?? societes[0];
    const salarie = await queries.createSalarie(societe!.id, {
      nom: "CLOISON DE TEST",
      prenom: "Suivi",
    });
    salarieId = salarie.id;
    await ajouterVisiteMedicale(salarieId, {
      dateVisite: "2026-09-10",
      type: "periodique",
      suivi: "simple",
      avis: "inapte_temporaire",
      prochaineVisite: "2031-09-10",
    });
  });

  afterAll(async () => {
    if (salarieId) {
      await purgerVisitesMedicales(salarieId);
      await queries.deleteSalarie(salarieId);
    }
  });

  it("un technicien ne voit aucune visite", async () => {
    const client = await ouvrirSession("tech.a@local");
    const { data } = await client.from("salarie_visites_medicales").select("*");
    expect(data).toEqual([]);
    await client.auth.signOut();
  });

  it("une secrétaire les voit — c'est elle qui tient les dossiers", async () => {
    const client = await ouvrirSession("secretaire@local");
    const { data } = await client
      .from("salarie_visites_medicales")
      .select("*")
      .eq("salarie_id", salarieId);
    expect(data?.length).toBe(1);
    await client.auth.signOut();
  });

  it("un technicien ne voit pas davantage le dossier documentaire", async () => {
    /* La même fermeture s'applique aux six autres tables filles : c'était
       l'écart que 20260918090000 est venu corriger. */
    const client = await ouvrirSession("tech.a@local");
    const { data } = await client.from("salarie_documents").select("*");
    expect(data).toEqual([]);
    await client.auth.signOut();
  });
});
