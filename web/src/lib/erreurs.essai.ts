import { describe, expect, it } from "vitest";
import { DemarrageImpossible, MESSAGE_DELAI_DEPASSE } from "@/modules/auth-roles/domain/demarrage";
import { exiger, messageErreur, motifDeLaBase } from "./erreurs";

describe("messageErreur", () => {
  it("traduit un refus RLS", () => {
    expect(messageErreur({ code: "42501", message: "new row violates row-level security policy" })).toBe(
      "Vous n'avez pas le droit de faire cette opération."
    );
  });
  it("laisse passer le message d'un déclencheur métier", () => {
    expect(messageErreur({ code: "P0001", message: "Facture émise : elle est figée." })).toBe(
      "Facture émise : elle est figée."
    );
  });
  it("un refus motivé par la base s'affiche avec son motif, détail d'abord (AUTH-39)", () => {
    const refus = { code: "42501", message: "Seul un administrateur ou secretaire peut generer la facture", details: null, hint: null };
    expect(messageErreur(refus)).toBe("Seul un administrateur ou secretaire peut generer la facture");
    expect(motifDeLaBase({ code: "23514", message: "Contrôle refusé", details: "La facture est déjà émise.", hint: "Établissez un avoir." })).toBe("La facture est déjà émise.");
    expect(motifDeLaBase({ code: "23514", message: "Contrôle refusé", details: null, hint: "Établissez un avoir." })).toBe("Établissez un avoir.");
  });
  it("un message natif anglais de Postgres ne passe jamais, même avec un détail", () => {
    const natif = { code: "23505", message: "duplicate key value violates unique constraint \"x\"", details: "Key (id)=(1) already exists.", hint: null };
    expect(motifDeLaBase(natif)).toBeNull();
    expect(messageErreur(natif)).toBe("Cet enregistrement existe déjà (doublon).");
  });
  it("les refus fabriqués par nos modules api/ gardent leur traduction générique", () => {
    expect(messageErreur({ code: "42501", message: "Suppression refusée" })).toBe("Vous n'avez pas le droit de faire cette opération.");
  });
  it("le délai de démarrage dépassé est montré tel quel (AUTH-09)", () => {
    expect(messageErreur(new DemarrageImpossible(MESSAGE_DELAI_DEPASSE))).toBe(MESSAGE_DELAI_DEPASSE);
  });
  it("ne montre jamais un message technique inconnu", () => {
    expect(messageErreur(new Error("TypeError: x is undefined"))).toMatch(/erreur inattendue/);
  });
  it("reconnaît une panne réseau", () => {
    expect(messageErreur({ message: "TypeError: Failed to fetch" })).toMatch(/injoignable/);
  });
});

describe("exiger", () => {
  it("lève l'erreur ou rend la donnée", () => {
    expect(exiger({ data: [1], error: null })).toEqual([1]);
    expect(() => exiger({ data: null, error: { code: "42501" } })).toThrow();
  });
});
