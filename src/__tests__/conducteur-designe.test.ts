/**
 * Le document désigne son conducteur, il ne recopie plus son nom.
 *
 * L'écran Statistiques montrait trois « Paul » : `paUL`, `Paul` et `PAUL`. Ce
 * n'étaient pas trois personnes mais trois graphies, que le regroupement par
 * égalité exacte tenait pour distinctes. Les documents ne gardaient en effet
 * que le NOM du conducteur, recopié à l'écriture — là où un chantier garde
 * l'identifiant de sa fiche.
 *
 * Deux façons d'en arriver là, éprouvées ici l'une après l'autre : une
 * écriture qui contourne le formulaire (script, reprise, suite de tests), et
 * un simple renommage de fiche, qui laissait tous les documents antérieurs sur
 * l'ancienne graphie.
 *
 * Ces règles vivent en base — c'est le seul endroit qu'aucune écriture ne
 * contourne. Elles s'éprouvent donc en base.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as queries from "@/api/queries";
import { supabase } from "@/api/client";
import type { Uuid } from "@/api/types";
import { AUTH_DISPONIBLE, TEST_SOCIETE_CODE } from "./setup";

const suite = AUTH_DISPONIBLE ? describe : describe.skip;

suite("Le conducteur d'un document", () => {
  const aujourdhui = new Date().toISOString().slice(0, 10);
  let societeId: Uuid;
  let ficheId: Uuid;
  const aSupprimer: Uuid[] = [];

  beforeAll(async () => {
    const societe = await queries.getSocieteByCode(TEST_SOCIETE_CODE);
    if (!societe) throw new Error(`Société « ${TEST_SOCIETE_CODE} » introuvable`);
    societeId = societe.id;

    const { data, error } = await supabase
      .from("conducteurs")
      .insert({ societe_id: societeId, nom: "ÉPREUVE Conducteur" })
      .select("id")
      .single();
    if (error) throw error;
    ficheId = data.id as Uuid;
  });

  afterAll(async () => {
    if (aSupprimer.length) {
      await supabase.from("bons_commande").delete().in("id", aSupprimer);
      await supabase.from("conducteurs").delete().in("id", aSupprimer);
    }
    if (ficheId) await supabase.from("conducteurs").delete().eq("id", ficheId);
  });

  /** Un bon minimal, écrit sans passer par l'écran. */
  async function poserUnBon(champs: Record<string, unknown>) {
    const { data, error } = await supabase
      .from("bons_commande")
      .insert({
        societe_id: societeId,
        client_nom: "ÉPREUVE Client",
        date: aujourdhui,
        ...champs,
      })
      .select("id, conducteur, conducteur_id")
      .single();
    if (error) throw error;
    aSupprimer.push(data.id as Uuid);
    return data;
  }

  it("retient la graphie de la fiche, pas celle qu'on lui donne", async () => {
    // C'est exactement ce que faisaient les suites de tests : écrire un nom à
    // la main, sans référence. La base le rattrape et impose sa graphie.
    const bon = await poserUnBon({ conducteur: "  épreuve conducteur  " });

    expect(bon.conducteur).toBe("ÉPREUVE Conducteur");
    expect(bon.conducteur_id).toBe(ficheId);
  });

  it("prend la fiche désignée pour source, même si le nom envoyé diffère", async () => {
    const bon = await poserUnBon({
      conducteur_id: ficheId,
      conducteur: "UN NOM QUI N'EST PAS LE SIEN",
    });

    expect(bon.conducteur).toBe("ÉPREUVE Conducteur");
  });

  it("conserve un nom que le répertoire ne connaît pas", async () => {
    // On ne perd pas une donnée sous prétexte qu'elle n'a pas d'équivalent :
    // un conducteur parti, dont la fiche a été supprimée, reste lisible.
    const bon = await poserUnBon({ conducteur: "SANS FICHE AU RÉPERTOIRE" });

    expect(bon.conducteur).toBe("SANS FICHE AU RÉPERTOIRE");
    expect(bon.conducteur_id).toBeNull();
  });

  it("suit la fiche quand elle est renommée", async () => {
    // Le cœur du défaut : avant, ce bon serait resté sur l'ancienne graphie,
    // et les statistiques auraient compté deux conducteurs au lieu d'un.
    const bon = await poserUnBon({ conducteur_id: ficheId });
    expect(bon.conducteur).toBe("ÉPREUVE Conducteur");

    await supabase
      .from("conducteurs")
      .update({ nom: "ÉPREUVE Renommée" })
      .eq("id", ficheId);

    const { data } = await supabase
      .from("bons_commande")
      .select("conducteur, conducteur_id")
      .eq("id", bon.id)
      .single();

    expect(data?.conducteur).toBe("ÉPREUVE Renommée");
    expect(data?.conducteur_id).toBe(ficheId);
  });

  it("se rattache à un compte utilisateur, et à un seul par société", async () => {
    // Sans ce lien, le tableau de bord du conducteur montrait les validations
    // de toute la société : il ne pouvait pas distinguer ses affaires.
    const { data: moi } = await supabase.from("profiles").select("id").limit(1).single();
    if (!moi) return;

    const { error: pose } = await supabase
      .from("conducteurs")
      .update({ profile_id: moi.id })
      .eq("id", ficheId);
    expect(pose).toBeNull();

    // Deux fiches pour la même personne rendraient « mes bons » ambigu :
    // l'écran en montrerait la moitié sans jamais le dire.
    const { data: doublon, error: refus } = await supabase
      .from("conducteurs")
      .insert({ societe_id: societeId, nom: "ÉPREUVE Doublon", profile_id: moi.id })
      .select("id")
      .maybeSingle();
    if (doublon) aSupprimer.push(doublon.id as Uuid);
    expect(doublon).toBeNull();
    /* Sur le code, et pas seulement sur l'absence de ligne : un refus de RLS
       ferait passer ce test sans que l'unicité existe. 23505 = violation
       d'unicité, et rien d'autre. */
    expect(refus?.code).toBe("23505");

    // La même personne dans une AUTRE société reste légitime.
    const { data: autreSociete } = await supabase
      .from("societes").select("id").neq("id", societeId).limit(1).maybeSingle();
    if (autreSociete) {
      const { data: ailleurs, error: erreurAilleurs } = await supabase
        .from("conducteurs")
        .insert({ societe_id: autreSociete.id, nom: "ÉPREUVE Ailleurs", profile_id: moi.id })
        .select("id")
        .maybeSingle();
      if (ailleurs) {
        aSupprimer.push(ailleurs.id as Uuid);
        expect(erreurAilleurs).toBeNull();
      }
    }

    await supabase.from("conducteurs").update({ profile_id: null }).eq("id", ficheId);
  });

  it("laisse retirer le conducteur sans que son nom reste derrière", async () => {
    const bon = await poserUnBon({ conducteur_id: ficheId });

    await supabase
      .from("bons_commande")
      .update({ conducteur_id: null, conducteur: "" })
      .eq("id", bon.id);

    const { data } = await supabase
      .from("bons_commande")
      .select("conducteur, conducteur_id")
      .eq("id", bon.id)
      .single();

    expect(data?.conducteur_id).toBeNull();
    expect(data?.conducteur ?? "").toBe("");
  });
});
