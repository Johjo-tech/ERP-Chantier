import { useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { BandeauSimulation } from "@/modules/auth-roles/components/BandeauSimulation";
import { MenuUtilisateur } from "@/modules/auth-roles/components/MenuUtilisateur";
import { peut } from "@/modules/auth-roles/domain/permissions";
import { RepliOngletContexte, useRepliOnglet } from "@/modules/auth-roles/hooks/RepliOnglet";
import { useSession } from "@/modules/auth-roles/hooks/useSession";
import { SelecteurSociete } from "@/modules/societes/components/SelecteurSociete";
import { ThemeSociete } from "@/modules/societes/components/ThemeSociete";
import { fonctionnaliteOuverte } from "@/modules/societes/domain/abonnement";
import { CentreNotifications } from "@/modules/notifications/components/CentreNotifications";
import { definirModeDiscret, useModeDiscret } from "@/lib/modeDiscret";
import { cn } from "@/lib/utils";
import { ecrireMenuEpingle, lireMenuEpingle, replieAutomatiquement } from "./menu";
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
  const { pathname } = useLocation();
  const [epingle, setEpingle] = useState(lireMenuEpingle);
  // Le planning reprend la largeur du menu, sauf s'il est épinglé (TRV-11) ; un geste manuel vaut
  // jusqu'au prochain changement d'écran — l'état se recalcule alors, sans effet.
  const cleMenu = `${pathname}|${epingle}`;
  const [geste, setGeste] = useState<{ cle: string; replie: boolean } | null>(null);
  const replie = geste?.cle === cleMenu ? geste.replie : replieAutomatiquement(pathname, epingle);
  const discret = useModeDiscret();
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
              menuOuvert ? "translate-x-0" : "-translate-x-full max-md:invisible",
              replie && "md:hidden"
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
            <div className="flex flex-col gap-1 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={epingle}
                  onChange={(e) => {
                    setEpingle(e.target.checked);
                    ecrireMenuEpingle(e.target.checked);
                  }}
                />
                Garder le menu ouvert
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={discret} onChange={(e) => definirModeDiscret(e.target.checked)} />
                Mode discret (montants masqués)
              </label>
            </div>
            <MenuUtilisateur />
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center gap-2 border-b border-border p-2 print:hidden">
              <Button variant="ghost" size="sm" className="md:hidden" aria-expanded={menuOuvert} onClick={() => setMenuOuvert((o) => !o)}>
                Menu
              </Button>
              <Button variant="ghost" size="sm" className="max-md:hidden" aria-expanded={!replie} onClick={() => setGeste({ cle: cleMenu, replie: !replie })}>
                {replie ? "Afficher le menu" : "Replier le menu"}
              </Button>
              <span className="truncate font-semibold md:hidden">{societeActive.nom}</span>
              <div className="ml-auto flex items-center gap-1">
                {discret && <span className="text-xs text-muted-foreground">Mode discret</span>}
                <CentreNotifications />
              </div>
            </header>
            <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6 print:overflow-visible print:p-0">
              {/* Changer de société remonte l'écran : aucun état local ne survit d'une société à l'autre.
                  Le mode discret, lui, NE remonte rien : on le bascule en pleine saisie quand un client
                  arrive. Chaque composant qui affiche un montant s'y abonne (`useModeDiscret`) et se
                  redessine seul (D-R4-01, garde-fou dans `modeDiscret.essai.ts`). */}
              <Outlet key={societeActive.id} />
            </main>
          </div>
        </div>
      </div>
    </RepliOngletContexte.Provider>
  );
}
