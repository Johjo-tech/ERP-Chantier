import { afterEach, describe, expect, it, vi } from "vitest";
import { avecDelai, DELAI_DEMARRAGE_MS, DemarrageImpossible, MESSAGE_DELAI_DEPASSE, verifierMatrice } from "./demarrage";
import { estSessionExpiree } from "./expiration";

afterEach(() => vi.useRealTimers());

describe("délai de démarrage (AUTH-09)", () => {
  it("vaut 15 s, comme l'ancien écran", () => {
    expect(DELAI_DEMARRAGE_MS).toBe(15_000);
  });

  it("une couche de données muette échoue au bout du délai, avec le message qui dit quoi vérifier", async () => {
    vi.useFakeTimers();
    const jamais = new Promise<never>(() => undefined);
    const attente = expect(avecDelai(jamais)).rejects.toThrow(MESSAGE_DELAI_DEPASSE);
    await vi.advanceTimersByTimeAsync(DELAI_DEMARRAGE_MS);
    await attente;
    expect(MESSAGE_DELAI_DEPASSE).toMatch(/La couche de données n'a pas répondu/);
    expect(MESSAGE_DELAI_DEPASSE).toMatch(/VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY/);
  });

  it("rien n'échoue avant le délai ; une réponse à temps passe telle quelle", async () => {
    vi.useFakeTimers();
    let fin: (v: string) => void = () => undefined;
    const lente = new Promise<string>((r) => (fin = r));
    const p = avecDelai(lente);
    await vi.advanceTimersByTimeAsync(DELAI_DEMARRAGE_MS - 1);
    fin("session");
    await expect(p).resolves.toBe("session");
  });
});

describe("matrice des droits (AUTH-33)", () => {
  const ligne = { role: "admin" as const, module: "devis", action: "voir" };

  it("vide : refus de démarrer", () => {
    expect(() => verifierMatrice([], 0)).toThrow(DemarrageImpossible);
    expect(() => verifierMatrice([], null)).toThrow(/Matrice des droits vide/);
  });

  it("tronquée (moins de lignes reçues que la base n'en compte) : refus de démarrer", () => {
    expect(() => verifierMatrice([ligne], 184)).toThrow(/tronquée : 1 lignes reçues sur 184/);
  });

  it("entière : rendue telle quelle", () => {
    expect(verifierMatrice([ligne], 1)).toEqual([ligne]);
  });
});

describe("session expirée (AUTH-10)", () => {
  it("reconnaît PGRST301, un 401 et un jeton refusé", () => {
    expect(estSessionExpiree({ code: "PGRST301", message: "JWT expired" })).toBe(true);
    expect(estSessionExpiree({ code: "PGRST303" })).toBe(true);
    expect(estSessionExpiree({ status: 401, message: "Unauthorized" })).toBe(true);
    expect(estSessionExpiree({ message: "invalid JWT: unable to parse or verify signature" })).toBe(true);
  });

  it("ne confond pas un refus de droit ou une panne avec une expiration", () => {
    expect(estSessionExpiree({ code: "42501", message: "new row violates row-level security policy" })).toBe(false);
    expect(estSessionExpiree({ message: "Failed to fetch" })).toBe(false);
    expect(estSessionExpiree(null)).toBe(false);
    expect(estSessionExpiree("JWT")).toBe(false);
  });
});
