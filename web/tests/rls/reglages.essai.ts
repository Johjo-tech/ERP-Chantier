/**
 * Réglages de la société (SOC-05, 07, 09, 22, 30 ; PAR-02 à 06) : ce que la
 * base accorde à chaque rôle. Les écritures remettent chaque valeur telle
 * qu'elles l'ont trouvée — d'autres suites lisent les mêmes lignes.
 */
import { afterAll, describe, expect, it } from "vitest";
import { ALPHA, BETA, COMPTES, connecte } from "./cible";

const docsCrees: string[] = [];
const entreesCreees: string[] = [];

afterAll(async () => {
  const admin = await connecte(COMPTES.adminAlpha);
  if (docsCrees.length) await admin.from("documents_legaux").delete().in("id", docsCrees);
  if (entreesCreees.length) await admin.from("referentiels").delete().in("id", entreesCreees);
});

describe("identité légale : `societes` ne s'écrit que par l'administrateur", () => {
  it("l'administrateur modifie la fiche de sa société", async () => {
    const admin = await connecte(COMPTES.adminAlpha);
    const { data: avant } = await admin.from("societes").select("telephone").eq("id", ALPHA).single();
    const { data, error } = await admin.from("societes").update({ telephone: avant?.telephone ?? null }).eq("id", ALPHA).select("id");
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });

  it("secrétaire et conducteur ne la modifient pas (zéro ligne, sans erreur : l'écran doit le détecter)", async () => {
    for (const compte of [COMPTES.secretaireAlpha, COMPTES.conducteurAlpha]) {
      const c = await connecte(compte);
      const { data, error } = await c.from("societes").update({ telephone: "00" }).eq("id", ALPHA).select("id");
      expect(error, compte).toBeNull();
      expect(data ?? [], compte).toEqual([]);
    }
  });

  it("l'administrateur d'ALPHA ne touche pas BETA", async () => {
    const admin = await connecte(COMPTES.adminAlpha);
    const { data } = await admin.from("societes").update({ telephone: "00" }).eq("id", BETA).select("id");
    expect(data ?? []).toEqual([]);
  });
});

describe("réglages de documents : `societe_settings` suit `reglages/modifier`", () => {
  it("l'administrateur réécrit le document à l'identique (fusion, SOC-07)", async () => {
    const admin = await connecte(COMPTES.adminAlpha);
    const { data: avant } = await admin.from("societe_settings").select("infos_entreprise").eq("societe_id", ALPHA).maybeSingle();
    const { error } = await admin
      .from("societe_settings")
      .upsert({ societe_id: ALPHA, infos_entreprise: avant?.infos_entreprise ?? {} }, { onConflict: "societe_id" });
    expect(error).toBeNull();
  });

  it("la secrétaire (réglages : voir) lit mais n'écrit pas", async () => {
    const c = await connecte(COMPTES.secretaireAlpha);
    const lu = await c.from("societe_settings").select("societe_id").eq("societe_id", ALPHA);
    expect(lu.error).toBeNull();
    const { error } = await c.from("societe_settings").upsert({ societe_id: ALPHA, infos_entreprise: {} }, { onConflict: "societe_id" });
    expect(error?.code).toBe("42501");
  });
});

describe("numérotation : `compteurs` suit `reglages/modifier` (PAR-03)", () => {
  it("la secrétaire ne règle aucun compteur", async () => {
    const c = await connecte(COMPTES.secretaireAlpha);
    const { error } = await c.from("compteurs").upsert({ societe_id: ALPHA, type: "sav", annee: 2099, prefixe: "X", valeur: 0 }, { onConflict: "societe_id,type,annee" });
    expect(error?.code).toBe("42501");
  });

  it("l'administrateur relit et réécrit un compteur existant sans le changer", async () => {
    const admin = await connecte(COMPTES.adminAlpha);
    const { data } = await admin.from("compteurs").select("type, annee, prefixe, valeur").eq("societe_id", ALPHA).limit(1);
    const c = data?.[0];
    if (!c) return; // Aucune série servie en local : rien à réécrire.
    const { error } = await admin.from("compteurs").update({ prefixe: c.prefixe, valeur: c.valeur }).eq("societe_id", ALPHA).eq("type", c.type).eq("annee", c.annee);
    expect(error).toBeNull();
  });
});

describe("documents légaux : table et bucket cloisonnés par société (SOC-09, SOC-22)", () => {
  it("l'administrateur dépose une pièce sous `<societe>/…`, BETA ne la lit pas, puis elle est retirée", async () => {
    const admin = await connecte(COMPTES.adminAlpha);
    const chemin = `${ALPHA}/documents-legaux/essai-rls-${Date.now()}.txt`;
    const depot = await admin.storage.from("terrain").upload(chemin, new Blob(["kbis"], { type: "text/plain" }));
    expect(depot.error).toBeNull();

    const beta = await connecte(COMPTES.adminBeta);
    const lecture = await beta.storage.from("terrain").download(chemin);
    expect(lecture.data).toBeNull();

    const { data, error } = await admin
      .from("documents_legaux")
      .insert({ societe_id: ALPHA, nom: "Essai RLS", type: "KBIS", date_validite: "2099-01-01", fichier_chemin: chemin, fichier_nom: "essai.txt", legacy_id: null })
      .select("id")
      .single();
    expect(error).toBeNull();
    if (data) docsCrees.push(data.id);

    const vuParBeta = await beta.from("documents_legaux").select("id").eq("id", data?.id ?? "");
    expect(vuParBeta.data ?? []).toEqual([]);

    const retrait = await admin.storage.from("terrain").remove([chemin]);
    expect(retrait.error).toBeNull();
  });

  it("le rôle lecture n'ajoute pas de document légal", async () => {
    const c = await connecte(COMPTES.lectureAlpha);
    const { error } = await c.from("documents_legaux").insert({ societe_id: ALPHA, nom: "Intrus", legacy_id: null });
    expect(error?.code).toBe("42501");
  });
});

describe("listes de choix et intervenants : écriture par `peut_ecrire`", () => {
  it("l'administrateur ajoute puis retire une entrée de liste", async () => {
    const admin = await connecte(COMPTES.adminAlpha);
    const { data, error } = await admin
      .from("referentiels")
      .insert({ societe_id: ALPHA, domaine: "piece_courante", libelle: `Essai RLS ${Date.now()}`, code: "essai_rls", couleur: null, icone: null, position: 999 })
      .select("id")
      .single();
    expect(error).toBeNull();
    if (data) entreesCreees.push(data.id);
  });

  it("la secrétaire n'écrit ni liste ni fournisseur (réglages : voir seulement)", async () => {
    const c = await connecte(COMPTES.secretaireAlpha);
    const liste = await c.from("referentiels").insert({ societe_id: ALPHA, domaine: "unite", libelle: "Intrus", position: 0 });
    expect(liste.error?.code).toBe("42501");
    const fournisseur = await c.from("fournisseurs").insert({ societe_id: ALPHA, nom: "Intrus", actif: true });
    expect(fournisseur.error?.code).toBe("42501");
  });
});
