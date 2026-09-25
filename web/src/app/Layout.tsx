import { useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router";
import { Icone } from "@/components/ui/icones";
import { ToastBox } from "@/components/ui/toast";
import { afficherToast } from "@/lib/toast";
import { BandeauSimulation } from "@/modules/auth-roles/components/BandeauSimulation";
import { MenuUtilisateur } from "@/modules/auth-roles/components/MenuUtilisateur";
import { peut } from "@/modules/auth-roles/domain/permissions";
import { RepliOngletContexte, useRepliOnglet } from "@/modules/auth-roles/hooks/RepliOnglet";
import { useSession } from "@/modules/auth-roles/hooks/useSession";
import { CentreNotifications } from "@/modules/notifications/components/CentreNotifications";
import { SelecteurSociete } from "@/modules/societes/components/SelecteurSociete";
import { ThemeSociete } from "@/modules/societes/components/ThemeSociete";
import { fonctionnaliteOuverte } from "@/modules/societes/domain/abonnement";
import { BandeauEchecLecture } from "./BandeauEchecLecture";
import { useEchecsDeLecture } from "./cadre/echecs";
import { InterrupteurDiscret } from "./cadre/InterrupteurDiscret";
import { useClassesDuCorps, useMenuDeroulant } from "./cadre/useCadre";
import { ecrireMenuEpingle, estEcranLarge, lireMenuEpingle, ouvreUnFormulaire } from "./menu";
import { entreeActive, NAVIGATION, NAVIGATION_MOBILE, type EntreeNavigation } from "./navigation";
import { PageSansSociete } from "./PageSansSociete";

/** L'ancien écran annonçait la bascule deux secondes. */
const DUREE_ANNONCE_MS = 2000;

/**
 * Le cadre de l'application, au HTML près celui de l'ancien écran
 * (`index.html` l. 1731-1813) : le bouton ☰, le menu latéral `#sidebar`, la
 * barre du haut large `#deskTopStrip` et celle du téléphone `#topbar`, le
 * contenu `#content`, la barre du bas `#bottomnav`. L'ancienne feuille
 * (`styles/ancien.css`) fait le reste ; les classes de <body> pilotent le
 * menu replié comme avant.
 */
export function Layout() {
  const { etat, societeActive, roleEffectif } = useSession();
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
  const menus = useMenuDeroulant();
  const menu = useEtatMenu(pathname);
  const planning = estEcranLarge(pathname);
  const bandeaux = useNombreDeBandeaux();

  useClassesDuCorps({
    "sidebar-collapsed": menu.replie,
    "sidebar-forced": menu.force,
    "is-planning-view": planning,
    "role-technicien": roleEffectif === "technicien",
    "has-no-storage-banner": bandeaux > 0,
    "has-deux-bandeaux": bandeaux > 1,
  });

  if (etat.statut !== "connecte") return null;
  // Un compte sans société mais avec un accès client travaille dans l'espace client.
  if (!societeActive) return etat.session.accesClients.length ? <Navigate to="/espace-client" replace /> : <PageSansSociete />;

  const actif = entreeActive(entrees, pathname);
  const menuVisible = planning ? menu.force : !menu.replie;
  const ouvrir = (id: string) => menus.ouvrir(id);

  return (
    <RepliOngletContexte.Provider value={repli}>
      <ThemeSociete key={societeActive.id} />
      <BandeauSimulation />
      <BandeauEchecLecture />
      <div id="app">
        <button
          type="button"
          className="planning-menu-toggle"
          onClick={() => menu.basculer(planning)}
          title="Afficher/masquer le menu"
          aria-label={menuVisible ? "Replier le menu" : "Afficher le menu"}
          aria-expanded={menuVisible}
          aria-controls="sidebar"
        >
          ☰
        </button>
        <aside id="sidebar">
          <MenuUtilisateur place="Desktop" ouvert={menus.estOuvert("utilisateur-bureau")} ouvrir={ouvrir("utilisateur-bureau")} fermer={menus.fermer} />
          <nav className="nav-items" id="navDesktop" aria-label="Menu principal">
            {entrees.map((e) => (
              <EntreeMenu key={e.chemin} entree={e} active={e === actif} />
            ))}
          </nav>
          <label className="sidebar-pin" title="Le menu ne se refermera plus tout seul à l'ouverture d'un formulaire">
            <span className="ghost-toggle">
              <input type="checkbox" id="menuEpingleToggle" checked={menu.epingle} onChange={(e) => menu.epingler(e.target.checked)} />
              <span className="ghost-toggle-slider" />
            </span>
            <span>Garder le menu ouvert</span>
          </label>
          <div className="sidebar-foot" id="sidebarFoot">
            Données partagées avec toute personne ayant ce lien.
          </div>
        </aside>
        <div id="main">
          <div id="deskTopStrip">
            <CentreNotifications place="Desktop" />
            <InterrupteurDiscret place="Desktop" />
            <SelecteurSociete place="Desktop" ouvert={menus.estOuvert("societe-bureau")} ouvrir={ouvrir("societe-bureau")} fermer={menus.fermer} />
          </div>
          <div id="topbar">
            <MenuUtilisateur place="Mobile" ouvert={menus.estOuvert("utilisateur-mobile")} ouvrir={ouvrir("utilisateur-mobile")} fermer={menus.fermer} />
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CentreNotifications place="Mobile" />
              <InterrupteurDiscret place="Mobile" />
              <SelecteurSociete place="Mobile" ouvert={menus.estOuvert("societe-mobile")} ouvrir={ouvrir("societe-mobile")} fermer={menus.fermer} />
            </div>
          </div>
          <main id="content" className={planning ? "content-wide is-planning" : "content-wide"}>
            {/* Changer de société remonte l'écran : aucun état local ne survit d'une société à l'autre.
                Le mode discret, lui, NE remonte rien : on le bascule en pleine saisie quand un client
                arrive. Chaque composant qui affiche un montant s'y abonne (`useModeDiscret`) et se
                redessine seul (D-R4-01, garde-fou dans `modeDiscret.essai.ts`). */}
            <Outlet key={societeActive.id} />
          </main>
        </div>
        <BarreDuBas pathname={pathname} />
      </div>
      <ToastBox />
    </RepliOngletContexte.Provider>
  );
}

function EntreeMenu({ entree, active }: { entree: EntreeNavigation; active: boolean }) {
  return (
    <NavLink to={entree.chemin} className={active ? "nav-item active" : "nav-item"} aria-current={active ? "page" : undefined}>
      <Icone nom={entree.icone} />
      <span>{entree.libelle}</span>
    </NavLink>
  );
}

/** La barre du bas, sur téléphone : le premier mot du libellé seulement, comme l'ancien. */
function BarreDuBas({ pathname }: { pathname: string }) {
  const actif = (chemin: string) =>
    chemin === "/plus" ? pathname.startsWith("/plus") || pathname.startsWith("/reglages") : chemin === "/" ? pathname === "/" : pathname === chemin || pathname.startsWith(`${chemin}/`);
  return (
    <nav id="bottomnav" aria-label="Navigation mobile">
      {NAVIGATION_MOBILE.map((n) => (
        <NavLink key={n.chemin} to={n.chemin} className={actif(n.chemin) ? "nav-item active" : "nav-item"}>
          <Icone nom={n.icone} />
          <span>{n.libelle.split(" ")[0]}</span>
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * Le menu replié ou non (`sidebar-collapsed`), et forcé sur le planning
 * (`sidebar-forced`) — la mécanique de l'ancien écran :
 *  - au démarrage, replié, sauf s'il est épinglé ;
 *  - ☰ l'ouvre et le ferme (sur le planning, il force son affichage) ;
 *  - ouvrir un formulaire le referme, sauf s'il est épinglé (`openForm`) ;
 *  - quitter le planning oublie le forçage, sauf épinglé.
 */
function useEtatMenu(pathname: string) {
  const [etat, setEtat] = useState(() => {
    const epingle = lireMenuEpingle();
    return { epingle, replie: !epingle, force: epingle, chemin: pathname };
  });
  // Ajusté pendant le rendu, et non dans un effet : le premier dessin de la nouvelle page est déjà le bon.
  if (etat.chemin !== pathname) {
    const replie = etat.replie || (!etat.epingle && ouvreUnFormulaire(pathname));
    const force = etat.force && (etat.epingle || estEcranLarge(pathname));
    setEtat({ ...etat, replie, force, chemin: pathname });
  }
  return {
    ...etat,
    basculer: (planning: boolean) => setEtat((e) => (planning ? { ...e, force: !e.force } : { ...e, replie: !e.replie })),
    epingler: (epingle: boolean) => {
      ecrireMenuEpingle(epingle);
      setEtat((e) => (epingle ? { ...e, epingle, replie: false, force: true } : { ...e, epingle }));
      afficherToast(epingle ? "Le menu reste ouvert." : "Le menu se repliera à nouveau.", "success", DUREE_ANNONCE_MS);
    },
  };
}

/** Combien de bandeaux sont posés en haut de page : l'ancienne feuille décale l'écran d'autant. */
function useNombreDeBandeaux(): number {
  const { roleSimule } = useSession();
  const echecs = useEchecsDeLecture();
  return (roleSimule ? 1 : 0) + (echecs ? 1 : 0);
}

