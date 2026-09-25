import { NavLink } from "react-router";
import { cn } from "@/lib/utils";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";

/**
 * Les sous-onglets de Facturation (FAC-01, app.js l. 5155) : Factures,
 * Avoirs, Validation, À facturer, Règlements. Chacun n'apparaît que si le
 * rôle voit ce qu'il montre (bons de commande, règlements). Validation et
 * À facturer sont LES files du menu principal : une seule règle, un seul
 * compteur (relecture 4, B3).
 */
export function OngletsFacturation() {
  const voitBons = usePermission("bons_commande", "voir");
  const voitReglements = usePermission("reglements", "voir");
  const onglets = [
    { chemin: "/factures", libelle: "Factures", fin: true },
    { chemin: "/factures/avoirs", libelle: "Avoirs", fin: true },
    ...(voitBons ? [{ chemin: "/facturation/validation", libelle: "Validation", fin: true }, { chemin: "/facturation/a-facturer", libelle: "À facturer", fin: true }] : []),
    ...(voitReglements ? [{ chemin: "/factures/reglements", libelle: "Règlements", fin: false }] : []),
  ];
  return (
    <nav aria-label="Facturation" className="mb-3 flex flex-wrap gap-1 print:hidden">
      {onglets.map((o) => (
        <NavLink
          key={o.chemin}
          to={o.chemin}
          end={o.fin}
          className={({ isActive }) => cn("rounded-md px-3 py-1.5 text-sm font-medium", isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
        >
          {o.libelle}
        </NavLink>
      ))}
    </nav>
  );
}
