import { describe, expect, it } from "vitest";
import { messageLienEnvoye, nomRenseigne, schemaNouveauMotDePasse } from "@/modules/auth-roles/domain/motdepasse";
import {
  invitationEnAttente,
  messageInvitation,
  refusLisible,
  rolePropose,
  ROLES_INVITATION,
  schemaReponseInvitation,
  schemaSaisieInvitation,
  trierMembres,
  verrouAdmin,
  type Invitation,
  type Membre,
} from "./comptes";

const membre = (id: string, role: Membre["role"], actif = true): Membre => ({ id, profileId: `p-${id}`, nom: id, email: `${id}@x.fr`, role, actif, compteActif: true });

describe("dernier administrateur (AUTH-40)", () => {
  it("on ne retire pas son propre rôle d'administrateur", () => {
    const moi = membre("moi", "admin");
    expect(verrouAdmin(moi, "p-moi", [moi, membre("autre", "admin")])).toMatch(/propre rôle/);
  });

  it("le dernier administrateur actif est verrouillé, un second ne l'est pas", () => {
    const seul = membre("seul", "admin");
    expect(verrouAdmin(seul, "p-moi", [seul, membre("t", "technicien")])).toMatch(/au moins un administrateur/);
    expect(verrouAdmin(seul, "p-moi", [seul, membre("b", "admin")])).toBeNull();
    expect(verrouAdmin(membre("t", "technicien"), "p-moi", [])).toBeNull();
  });

  it("les refus du déclencheur (sans accents en base) sont redits en français", () => {
    expect(refusLisible("Une societe doit conserver au moins un administrateur actif")).toBe("Une société doit conserver au moins un administrateur actif.");
    expect(refusLisible("Vous ne pouvez pas retirer votre propre role administrateur")).toMatch(/rôle d'administrateur/);
    expect(refusLisible("autre chose")).toBeNull();
  });

  it("les membres actifs passent devant, puis par nom", () => {
    expect(trierMembres([membre("Zoé", "lecture"), membre("Bob", "admin", false), membre("Alice", "technicien")]).map((m) => m.nom)).toEqual(["Alice", "Zoé", "Bob"]);
  });
});

describe("invitations (AUTH-19, 43, 52)", () => {
  it("rôle proposé : conducteur si une fiche conducteur suit le salarié, sinon technicien", () => {
    expect(rolePropose("s1", [{ salarie_id: "s1" }])).toBe("conducteur");
    expect(rolePropose("s2", [{ salarie_id: "s1" }, { salarie_id: null }])).toBe("technicien");
  });

  it("sous-traitant n'est jamais invitable depuis une fiche salarié", () => {
    expect(ROLES_INVITATION.map((r) => r.role)).toEqual(["technicien", "conducteur", "secretaire", "lecture", "admin"]);
    expect(schemaSaisieInvitation.safeParse({ email: "a@b.fr", role: "sous_traitant" }).success).toBe(false);
    expect(schemaSaisieInvitation.safeParse({ email: "pas une adresse", role: "technicien" }).success).toBe(false);
  });

  it("la seule invitation en attente du salarié", () => {
    const inv = (id: string, statut: Invitation["statut"], salarie_id: string | null): Invitation => ({ id, email: "a@b.fr", role: "technicien", statut, salarie_id, sous_traitant_id: null, invitee_le: null, cree_le: "2026-09-01" });
    expect(invitationEnAttente([inv("1", "annulee", "s"), inv("2", "en_attente", "s"), inv("3", "en_attente", "t")], "s")?.id).toBe("2");
    expect(invitationEnAttente([inv("1", "acceptee", "s")], "s")).toBeNull();
  });

  it("le contrat de la fonction de bord : trois issues, ou un motif", () => {
    expect(schemaReponseInvitation.safeParse({ etat: "rattachee", email: "a@b.fr" }).success).toBe(true);
    expect(schemaReponseInvitation.safeParse({ erreur: "Ce salarié a déjà un compte rattaché." }).success).toBe(true);
    expect(schemaReponseInvitation.safeParse({ etat: "inconnu" }).success).toBe(false);
    expect(messageInvitation("rattachee", "a@b.fr")).toMatch(/sans courriel/);
    expect(messageInvitation("invitee", "a@b.fr")).toBe("Invitation envoyée à a@b.fr.");
  });
});

describe("mot de passe et nom (AUTH-03, 04, 17)", () => {
  it("8 caractères au moins, deux saisies identiques", () => {
    expect(schemaNouveauMotDePasse.safeParse({ motDePasse: "court", confirmation: "court" }).success).toBe(false);
    expect(schemaNouveauMotDePasse.safeParse({ motDePasse: "assez-long", confirmation: "autre-chose" }).error?.issues[0]?.path).toEqual(["confirmation"]);
    expect(schemaNouveauMotDePasse.safeParse({ motDePasse: "assez-long", confirmation: "assez-long" }).success).toBe(true);
  });

  it("le message de réinitialisation est neutre : il ne dit pas si le compte existe", () => {
    expect(messageLienEnvoye("x@y.fr")).toBe("Si un compte existe pour x@y.fr, un lien de réinitialisation vient d'être envoyé.");
  });

  it("un nom qui n'est que la partie gauche de l'adresse n'est pas un nom choisi", () => {
    expect(nomRenseigne("jean.dupont", "jean.dupont@x.fr")).toBe(false);
    expect(nomRenseigne("", "a@x.fr")).toBe(false);
    expect(nomRenseigne("Jean-Pierre", "jp@x.fr")).toBe(true);
  });
});
