import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELAI_INACTIVITE_MS, PAS_VERIFICATION_MS } from "../domain/inactivite";
import { CLE_DERNIER_GESTE, useDeconnexionInactivite } from "./useDeconnexionInactivite";

/** D-AUTH-SEC-01 : une heure sans geste déconnecte ; un geste, même dans un autre onglet, repousse l'échéance. */
describe("déconnexion après une heure d'inactivité", () => {
  const MINUTE = 60_000;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-29T08:00:00Z"));
    window.localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  it("sans aucun geste, déconnecte au bout d'une heure, pas avant", () => {
    const surInactivite = vi.fn();
    renderHook(() => useDeconnexionInactivite(true, surInactivite));
    act(() => vi.advanceTimersByTime(DELAI_INACTIVITE_MS - MINUTE));
    expect(surInactivite).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(PAS_VERIFICATION_MS));
    expect(surInactivite).toHaveBeenCalledTimes(1);
  });

  it("un geste repousse l'échéance d'une heure", () => {
    const surInactivite = vi.fn();
    renderHook(() => useDeconnexionInactivite(true, surInactivite));
    act(() => vi.advanceTimersByTime(50 * MINUTE));
    act(() => void window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" })));
    act(() => vi.advanceTimersByTime(50 * MINUTE));
    expect(surInactivite).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(11 * MINUTE));
    expect(surInactivite).toHaveBeenCalledTimes(1);
  });

  it("un geste dans un autre onglet (stockage partagé) garde celui-ci ouvert", () => {
    const surInactivite = vi.fn();
    renderHook(() => useDeconnexionInactivite(true, surInactivite));
    act(() => vi.advanceTimersByTime(55 * MINUTE));
    window.localStorage.setItem(CLE_DERNIER_GESTE, String(Date.now()));
    act(() => vi.advanceTimersByTime(30 * MINUTE));
    expect(surInactivite).not.toHaveBeenCalled();
  });

  it("à l'ouverture, un dernier geste vieux de plus d'une heure déconnecte aussitôt", () => {
    window.localStorage.setItem(CLE_DERNIER_GESTE, String(Date.now() - DELAI_INACTIVITE_MS - MINUTE));
    const surInactivite = vi.fn();
    renderHook(() => useDeconnexionInactivite(true, surInactivite));
    expect(surInactivite).toHaveBeenCalledTimes(1);
  });

  it("anonyme : rien ne se déclenche", () => {
    window.localStorage.setItem(CLE_DERNIER_GESTE, String(Date.now() - 2 * DELAI_INACTIVITE_MS));
    const surInactivite = vi.fn();
    renderHook(() => useDeconnexionInactivite(false, surInactivite));
    act(() => vi.advanceTimersByTime(2 * DELAI_INACTIVITE_MS));
    expect(surInactivite).not.toHaveBeenCalled();
  });
});
