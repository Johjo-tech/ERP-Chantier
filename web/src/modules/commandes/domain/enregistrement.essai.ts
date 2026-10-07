import { describe, expect, it } from "vitest";
import { ligneVide } from "@/modules/documents/domain/lignes";
import { lirePreRemplissage, lignesDepuisPreRemplissage, schemaSaisieBon, valeursDepuis } from "./bon";
import { preparerEnregistrement } from "./enregistrement";

const saisie = (surcharges: Record<string, string> = {}) =>
  schemaSaisieBon.parse({ ...valeursDepuis(null, null), client_id: "c1", ...surcharges });

const ligne = (designation: string, prix = "0") => ({ ...ligneVide(10), designation, prix_unitaire: prix });

describe("préparer l'enregistrement d'un bon", () => {
  it("hors brouillon, exige adresse d'intervention et ligne de travaux (BC-30)", () => {
    const p = preparerEnregistrement({ saisie: saisie(), client: { nom: "OPAC" }, mode: "normal", lignes: [ligneVide(10)], brouillon: false, aujourdhui: "2026-09-24" });
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.manques.map((m) => m.code)).toEqual(["adresse_intervention", "ligne_travaux"]);
  });

  it("le brouillon passe sans adresse ni ligne, avec le montant saisi et aucune ligne", () => {
    const p = preparerEnregistrement({ saisie: saisie({ montant: "471,5" }), client: { nom: "OPAC" }, mode: "attente_bc", lignes: [ligneVide(10)], brouillon: true, aujourdhui: "2026-09-24" });
    expect(p).toMatchObject({ ok: true, lignes: [], entete: { montant: 471.5, numero_bc: "En attente de BC", en_attente_bc: true, date_reception: "2026-09-24", conducteur: null } });
    if (p.ok) expect(Object.values(p.entete)).not.toContain("");
  });

  it("le lieu saisi part dans `adresse`, et le téléphone (illisible par la vue) n'est pas envoyé", () => {
    const p = preparerEnregistrement({
      saisie: saisie({ adresse_locataire: "14 rue Garibaldi", ville: "Lyon" }), client: { nom: "OPAC" }, mode: "normal",
      lignes: [ligne("Pose faïence", "43,5")], brouillon: false, aujourdhui: "2026-09-24",
    });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.entete).toMatchObject({ adresse: "14 rue Garibaldi", ville: "Lyon", client_nom: "OPAC", montant: 43.5 });
    expect("telephone_locataire" in p.entete).toBe(false);
    expect("adresse_locataire" in p.entete).toBe(false);
    expect(p.lignes).toHaveLength(1);
  });

  it("un montant global illisible est refusé tant qu'aucune ligne ne fait foi", () => {
    const p = preparerEnregistrement({ saisie: saisie({ montant: "beaucoup" }), client: { nom: "X" }, mode: "normal", lignes: [], brouillon: true, aujourdhui: "2026-09-24" });
    expect(p).toMatchObject({ ok: false, montantIllisible: true });
  });
});

describe("préremplissage par l'état de navigation", () => {
  it("valide la forme, et convertit les lignes en lignes à relire", () => {
    const p = lirePreRemplissage({ prefill: { client_id: "c1", numero_bc: "CMD-9", lignes: [{ designation: "Recherche de fuite", quantite: 1.5, prix_unitaire: "80" }] } });
    expect(p?.numero_bc).toBe("CMD-9");
    expect(valeursDepuis(null, p)).toMatchObject({ client_id: "c1", numero_bc: "CMD-9" });
    expect(lignesDepuisPreRemplissage(p, 10)[0]).toMatchObject({ designation: "Recherche de fuite", quantite: "1,5", prix_unitaire: "80", tva: "10" });
  });

  it("ignore un état qui n'a pas la forme attendue", () => {
    expect(lirePreRemplissage({ prefill: { lignes: "tout" } })).toBeNull();
    expect(lirePreRemplissage(null)).toBeNull();
  });
});
