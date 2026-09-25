import { beforeEach, describe, expect, it, vi } from "vitest";
import { messageErreur } from "@/lib/erreurs";

/**
 * Relecture 4, I3 et I5 : les écritures sur une facture venues d'un onglet
 * PÉRIMÉ. Une « base » factice d'une seule facture, qui n'applique un `update`
 * que si TOUS ses filtres (`eq`, `is`) correspondent — comme PostgREST — et
 * rend les lignes touchées.
 */
type Ligne = { id: string; numero: string | null; statut: string; verrouillee: boolean; client_nom?: string };
const base = vi.hoisted(() => ({ facture: null as Ligne | null, lignesEcrites: 0 }));

function requete() {
  const filtres: [string, unknown][] = [];
  let maj: Record<string, unknown> | null = null;
  const correspond = () => !!base.facture && filtres.every(([c, v]) => (base.facture as Record<string, unknown>)[c] === v);
  const resultat = () => {
    if (maj && correspond() && base.facture) {
      base.facture = { ...base.facture, ...maj } as Ligne;
      // Le déclencheur de numérotation, à l'émission.
      if (maj.statut === "impayée" && !base.facture.numero) base.facture.numero = "FA-2026-0043";
      return { data: [{ ...base.facture }], error: null };
    }
    if (maj) return { data: [], error: null };
    return { data: correspond() ? [{ ...base.facture }] : [], error: null };
  };
  const q = {
    update: (v: Record<string, unknown>) => {
      maj = v;
      return q;
    },
    select: () => q,
    eq: (c: string, v: unknown) => {
      filtres.push([c, v]);
      return q;
    },
    is: (c: string, v: unknown) => {
      filtres.push([c, v]);
      return q;
    },
    maybeSingle: () => Promise.resolve({ data: resultat().data[0] ?? null, error: null }),
    then: (ok: (r: unknown) => unknown) => Promise.resolve(resultat()).then(ok),
  };
  return q;
}

vi.mock("@/lib/supabase", () => ({ supabase: () => ({ from: () => requete() }), supabasePropositions: () => ({ from: () => requete() }) }));
vi.mock("@/modules/clients/api/clients", () => ({ identiteDuClient: vi.fn(async () => null) }));
vi.mock("@/modules/documents/api/lignes", () => ({
  synchroniserLignes: vi.fn(async () => {
    base.lignesEcrites += 1;
  }),
}));

const { emettreFacture, modifierBrouillon } = await import("./factures");

beforeEach(() => {
  base.lignesEcrites = 0;
});

describe("« Émettre » depuis un onglet périmé (I3)", () => {
  it("une facture émise puis soldée ailleurs ne repasse PAS « impayée »", async () => {
    base.facture = { id: "f1", numero: "FA-2026-0042", statut: "payée", verrouillee: false };
    const refus = await emettreFacture("f1").catch((e: unknown) => e);
    expect(base.facture.statut).toBe("payée");
    expect(messageErreur(refus)).toBe("Cette facture a été émise entre-temps sous le numéro FA-2026-0042 : rechargez la page.");
  });

  it("un brouillon s'émet normalement", async () => {
    base.facture = { id: "f1", numero: null, statut: "brouillon", verrouillee: false };
    await expect(emettreFacture("f1")).resolves.toBe("FA-2026-0043");
    expect(base.facture.statut).toBe("impayée");
  });
});

describe("« Enregistrer » un brouillon cadenassé depuis un autre onglet (I5)", () => {
  const entete = { client_id: null, client_nom: "OPAC" } as unknown as Parameters<typeof modifierBrouillon>[1];

  it("le cadenas posé ailleurs (PDF envoyé) empêche d'écrire, lignes comprises", async () => {
    base.facture = { id: "f1", numero: null, statut: "brouillon", verrouillee: true, client_nom: "Avant" };
    const refus = await modifierBrouillon("f1", entete, []).catch((e: unknown) => e);
    expect(base.facture.client_nom).toBe("Avant");
    expect(base.lignesEcrites).toBe(0);
    expect(messageErreur(refus)).toMatch(/téléchargée ou envoyée entre-temps \(cadenas\)/);
  });

  it("un brouillon supprimé entre-temps : message dédié, pas « utilisé ailleurs »", async () => {
    base.facture = null;
    const refus = await modifierBrouillon("f1", entete, []).catch((e: unknown) => e);
    expect(base.lignesEcrites).toBe(0);
    expect(messageErreur(refus)).toMatch(/n'existe plus \(supprimé entre-temps\)/);
  });

  it("sans cadenas, l'enregistrement passe", async () => {
    base.facture = { id: "f1", numero: null, statut: "brouillon", verrouillee: false, client_nom: "Avant" };
    await modifierBrouillon("f1", entete, []);
    expect(base.facture.client_nom).toBe("OPAC");
    expect(base.lignesEcrites).toBe(1);
  });
});
