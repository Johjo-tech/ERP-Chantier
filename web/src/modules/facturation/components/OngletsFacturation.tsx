import { Onglets } from "@/components/ui/onglets";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";

/** Les files du circuit : une seule adresse chacune, que le tableau de bord et les notifications ouvrent aussi. */
export const FILE_VALIDATION = "/facturation/validation";
export const FILE_A_FACTURER = "/facturation/a-facturer";

/**
 * Les sous-onglets de Facturation (FAC-01, `renderFactures`, app.js l. 5155) :
 * Factures, Avoirs, Validation, À facturer, Règlements — centrés, comme
 * l'ancien. Chacun n'apparaît que si le rôle voit ce qu'il montre (bons de
 * commande, règlements). Validation et À facturer n'ont pas d'entrée au menu
 * principal : l'ancien les rangeait ici, et c'est la seule file de chacune
 * (relecture 4, B3).
 */
export function OngletsFacturation() {
  const voitBons = usePermission("bons_commande", "voir");
  const voitReglements = usePermission("reglements", "voir");
  return (
    <Onglets
      libelle="Facturation"
      centre
      onglets={[
        { chemin: "/factures", libelle: "Factures" },
        { chemin: "/factures/avoirs", libelle: "Avoirs" },
        ...(voitBons ? [{ chemin: FILE_VALIDATION, libelle: "Validation" }, { chemin: FILE_A_FACTURER, libelle: "À facturer" }] : []),
        ...(voitReglements ? [{ chemin: "/factures/reglements", libelle: "Règlements", exact: false }] : []),
      ]}
    />
  );
}
