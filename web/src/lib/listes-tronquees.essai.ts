import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Relecture 4, I1 et I4. Un PostgREST factice qui se comporte comme la
 * production : `max_rows = 1000` (défaut Supabase ; la base locale est à
 * 20 000, d'où l'absence de symptôme en local). Il honore `.range()` et
 * `{ count: "exact" }`, et ignore les filtres : chaque ligne porte les
 * colonnes de toutes les lectures essayées ici.
 */
const MAX_ROWS = 1000;
const TOTAL = 1500;
const lignes = Array.from({ length: TOTAL }, (_, i) => ({
  id: `r${String(i).padStart(5, "0")}`,
  facture_id: `f${i % 700}`,
  date: "2026-01-01",
  montant: 10,
  mode: "virement",
  reference: null,
  // v_devis_totaux
  devis_id: `d${i}`,
  ht: 100,
  ttc: 110,
  // compteurs des chantiers
  chantier_id: `c${i % 3}`,
  // bons à surveiller
  numero_bc: `BC-${i}`,
  client_nom: "OPAC",
  date_fin_travaux: "2026-01-01",
  rappel_date: null,
  statut_workflow: "en_cours",
  // salariés
  nom: `Salarié ${i}`, prenom: null, poste: null, email: null, telephone: null, date_entree: null, date_sortie: null, type_contrat: null,
  carte_btp_numero: null, carte_btp_validite: null, visite_medicale_date: null, visite_medicale_prochaine: null, technicien_id: null,
  salaire_mensuel_net: null, cout_horaire_charge: null, solde_cp_initial: null, date_naissance: null, nationalite: null, sexe: null, actif: true, profile_id: null,
}));

function requete() {
  let debut = 0;
  let fin = Number.POSITIVE_INFINITY;
  let compte = false;
  const q = {
    select: (_c: string, o?: { count?: string }) => {
      compte = o?.count === "exact";
      return q;
    },
    eq: () => q,
    or: () => q,
    not: () => q,
    order: () => q,
    range: (d: number, f: number) => {
      debut = d;
      fin = f;
      return q;
    },
    then: (ok: (r: unknown) => unknown) => {
      const page = lignes.slice(debut, Math.min(fin + 1, debut + MAX_ROWS));
      return Promise.resolve({ data: page, error: null, count: compte ? TOTAL : null }).then(ok);
    },
  };
  return q;
}

vi.mock("@/lib/supabase", () => ({
  supabase: () => ({ from: () => requete() }),
  supabasePropositions: () => ({ from: () => requete() }),
  clientNotifications: () => ({ from: () => requete() }),
}));

// Contrat TRV-10 (lib/lecture.ts) : jamais une liste coupée présentée comme complète.
describe("listes au-delà du plafond du serveur : toutes les lignes, ou un refus", () => {
  beforeEach(() => vi.resetModules());

  it("les règlements de la société (reste dû, déjà réglé, lettrage)", async () => {
    const { reglementsDeLaSociete } = await import("@/modules/facturation/api/factures");
    await expect(reglementsDeLaSociete("s1").then((r) => r.length)).resolves.toBe(TOTAL);
  });

  it("les totaux des devis", async () => {
    const { totauxDesDevis } = await import("@/modules/devis/api/devis");
    await expect(totauxDesDevis("s1").then((r) => r.length)).resolves.toBe(TOTAL);
  });

  it("les compteurs des chantiers (comptes-rendus, devis, factures)", async () => {
    const { compteursChantiers } = await import("@/modules/chantiers/api/chantiers");
    const compte = await compteursChantiers("s1", { devis: true, factures: true });
    const total = [...compte.values()].reduce((n, c) => n + c.comptesRendus, 0);
    expect(total).toBe(TOTAL);
  });

  it("les salariés", async () => {
    const { listerSalaries } = await import("@/modules/rh/api/salaries");
    await expect(listerSalaries("s1", true).then((r) => r.length)).resolves.toBe(TOTAL);
  });

  it("les bons à surveiller de la cloche", async () => {
    const { bonsASurveiller } = await import("@/modules/notifications/api/notifications");
    await expect(bonsASurveiller("s1", "2026-09-25").then((r) => r.length)).resolves.toBe(TOTAL);
  });
});
