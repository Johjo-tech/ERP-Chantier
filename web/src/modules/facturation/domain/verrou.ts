/**
 * Ce qui fige une facture (port de `src/api/regles-verrouillage.ts`).
 *
 * Émise (numéro présent) : définitif, art. L441-9 — la base le garantit aussi
 * (déclencheurs factures_entete_figee et lignes figées). Téléchargée ou
 * envoyée (`verrouillee`) : cadenas réversible contre la modification par mégarde.
 */
export type CodeVerrou = "emise" | "telechargee";

export interface Verrou {
  code: CodeVerrou;
  libelle: string;
  reversible: boolean;
}

export function verrouFacture(f: { numero: string | null; type_document: string; verrouillee: boolean }): Verrou | null {
  const numero = (f.numero ?? "").trim();
  // Égalité stricte, comme estAvoirDocument : le texte du verrou suit le type exact.
  const avoir = f.type_document.trim() === "avoir";
  if (numero) {
    return {
      code: "emise",
      libelle: `${avoir ? "L'avoir" : "La facture"} ${numero} est émis${avoir ? "" : "e"} : son contenu est définitif (art. L441-9).${avoir ? "" : " Une correction passe par un avoir."}`,
      reversible: false,
    };
  }
  if (f.verrouillee) {
    return {
      code: "telechargee",
      libelle: "Cette facture a déjà été téléchargée ou envoyée — elle est verrouillée pour éviter une modification accidentelle.",
      reversible: true,
    };
  }
  return null;
}
