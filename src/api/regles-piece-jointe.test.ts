import { describe, expect, it } from "vitest";
import { verifierDepotLecture } from "./regles-piece-jointe";

describe("verifierDepotLecture", () => {
  it("accepte un PDF déposé", () => {
    expect(verifierDepotLecture([{ nom: "bon.pdf", type: "application/pdf" }])).toEqual({ ok: true });
  });

  it("accepte une photo d'iPhone, que la préparation convertira", () => {
    expect(verifierDepotLecture([{ nom: "IMG_0412.HEIC", type: "" }])).toEqual({ ok: true });
  });

  it("reconnaît le type par l'extension quand le navigateur ne l'annonce pas", () => {
    expect(verifierDepotLecture([{ nom: "devis.jpeg", type: "" }])).toEqual({ ok: true });
  });

  it("refuse un document Word", () => {
    const verdict = verifierDepotLecture([
      { nom: "devis.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    ]);
    expect(verdict.ok).toBe(false);
  });

  it("refuse plusieurs fichiers plutôt que d'en choisir un en silence", () => {
    const verdict = verifierDepotLecture([
      { nom: "a.pdf", type: "application/pdf" },
      { nom: "b.pdf", type: "application/pdf" },
    ]);
    expect(verdict).toEqual({ ok: false, motif: expect.stringMatching(/un seul/i) });
  });

  it("refuse un dépôt sans fichier — un lien ou du texte glissé", () => {
    expect(verifierDepotLecture([]).ok).toBe(false);
  });
});
