/**
 * Ce qui fige un bon de commande (port de `regles-verrouillage.ts#verrouBonCommande`, BC-45).
 *
 * Le critère est la facture ÉMISE (numérotée), pas l'état du circuit :
 * `bc_generer_facture` fait naître un brouillon, et tant qu'il n'a pas de
 * numéro rien n'est parti chez le client — corriger le bon reste légitime.
 * La base oppose le même refus (déclencheur `bon_commande_facture_fige`).
 */
export interface VerrouBon {
  code: "bon_facture";
  libelle: string;
  reversible: false;
}

export function verrouBonCommande(facturesLiees: readonly { numero?: string | null }[]): VerrouBon | null {
  const emises = facturesLiees.map((f) => (f.numero ?? "").trim()).filter(Boolean);
  if (!emises.length) return null;
  return {
    code: "bon_facture",
    libelle:
      `Ce bon de commande est facturé (${emises.join(", ")}) : son contenu ne peut plus changer sans faire mentir la facture. ` +
      "Une correction passe par un avoir sur la facture.",
    reversible: false,
  };
}
