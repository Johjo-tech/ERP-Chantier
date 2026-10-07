import { describe, expect, it } from "vitest";
import { anneeIso, dateISO, formatDateFr, jourIso, moisIso, partiesIso } from "./dates";

describe("dateISO", () => {
  it("donne la date de Paris, pas celle d'UTC", () => {
    // 23 h 30 UTC le 24/09 : il est déjà 1 h 30 le 25 à Paris (heure d'été).
    expect(dateISO(new Date("2026-09-24T23:30:00Z"))).toBe("2026-09-25");
    // 23 h 30 UTC le 15/01 : 0 h 30 le 16 à Paris (heure d'hiver).
    expect(dateISO(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-16");
  });
});

describe("formatDateFr", () => {
  it("reprend le format de l'ancien fmtDate", () => {
    expect(formatDateFr("2026-09-24")).toBe("24/09/2026");
    expect(formatDateFr("2026-09-24T10:00:00Z")).toBe("24/09/2026");
    expect(formatDateFr("")).toBe("—");
    expect(formatDateFr(null)).toBe("—");
  });
});

describe("découpes d'une date ISO (TRV-14 : plus de slice(0, 10) anonyme)", () => {
  it("jour, mois, année et parties, d'une date ou d'un horodatage", () => {
    expect(jourIso("2026-09-25T13:49:00+02:00")).toBe("2026-09-25");
    expect(moisIso("2026-09-25")).toBe("2026-09");
    expect(anneeIso("2026-09-25")).toBe(2026);
    expect(partiesIso("2026-09-25T00:00:00Z")).toEqual({ annee: 2026, mois: 9, jour: 25 });
    expect(partiesIso("2026-09")).toMatchObject({ annee: 2026, mois: 9 });
  });
});
