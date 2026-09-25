import { useState } from "react";
import { Navigate, NavLink, Outlet } from "react-router";
import { Button } from "@/components/ui/button";
import { BandeauSimulation } from "@/modules/auth-roles/components/BandeauSimulation";
import { MenuUtilisateur } from "@/modules/auth-roles/components/MenuUtilisateur";
import { peut } from "@/modules/auth-roles/domain/permissions";
import { RepliOngletContexte, useRepliOnglet } from "@/modules/auth-roles/hooks/RepliOnglet";
import { useSession } from "@/modules/auth-roles/hooks/useSession";
import { SelecteurSociete } from "@/modules/societes/components/SelecteurSociete";
import { ThemeSociete } from "@/modules/societes/components/ThemeSociete";
import { fonctionnaliteOuverte } from "@/modules/societes/domain/abonnement";
import { cn } from "@/lib/utils";
import { NAVIGATION } from "./navigation";
import { PageSansSociete } from "./PageSansSociete";

export function Layout() {
  const { etat, societeActive, roleEffectif } = useSession();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const entrees =
    etat.statut === "connecte" && societeActive
      ? NAVIGATION.filter(
          (e) =>
            peut(etat.session.matrice, roleEffectif, e.module, "voir") &&
            (!e.fonctionnalite || fonctionnaliteOuverte(e.fonctionnalite, societeActive.niveauAbonnement))
        )
      : [];
  const repli = useRepliOnglet(`${societeActive?.id}|${roleEffectif}`, entrees[0]?.chemin ?? null);
  if (etat.statut !== "connecte") return null;
  // Un compte sans société mais avec un accès client travaille dans l'espace client.
  if (!societeActive) return etat.session.accesClients.length ? <Navigate to="/espace-client" replace /> : <PageSansSociete />;

  return (
    <RepliOngletContexte.Provider value={repli}>
      <div className="flex h-full flex-col">
        <BandeauSimulation />
        <ThemeSociete key={societeActive.id} />
        <div className="flex min-h-0 flex-1">
          <aside
            className={cn(
              "fixed inset-y-0 left-0 z-20 flex w-60 flex-col gap-4 border-r border-border bg-card p-3 transition-transform md:static md:translate-x-0 print:hidden",
              // Fermé sur mobile, le menu sort AUSSI de l'ordre de tabulation (invisible), pas seulement de l'écran.
              menuOuvert ? "translate-x-0" : "-translate-x-full max-md:invisible"
            )}
            onKeyDown={(e) => {
              if (e.key === "Escape") setMenuOuvert(false);
            }}
          >
            <SelecteurSociete />
            <nav aria-label="Menu principal" className="flex flex-1 flex-col gap-0.5">
              {entrees.map((e) => (
                <NavLink
                  key={e.chemin}
                  to={e.chemin}
                  end={e.chemin === "/"}
                  onClick={() => setMenuOuvert(false)}
                  className={({ isActive }) =>
                    cn(
                      "rounded-md px-3 py-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive && "bg-primary/10 font-medium text-primary"
                    )
                  }
                >
                  {e.libelle}
                </NavLink>
              ))}
            </nav>
            <MenuUtilisateur />
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center gap-2 border-b border-border p-2 md:hidden print:hidden">
              <Button variant="ghost" size="sm" aria-expanded={menuOuvert} onClick={() => setMenuOuvert((o) => !o)}>
                Menu
              </Button>
              <span className="truncate font-semibold">{societeActive.nom}</span>
            </header>
            <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6 print:overflow-visible print:p-0">
              {/* Changer de société remonte l'écran : aucun état local ne survit d'une société à l'autre. */}
              <Outlet key={societeActive.id} />
            </main>
          </div>
        </div>
      </div>
    </RepliOngletContexte.Provider>
  );
}
