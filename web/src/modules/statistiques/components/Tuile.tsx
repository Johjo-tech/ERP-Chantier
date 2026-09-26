import { useId, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { Icone, type NomIcone } from "@/components/ui/icones";

export type TonTuile = "neutre" | "succes" | "alerte" | "danger";

/** La classe de ton de l'ancienne tuile (`.stat-card.warn` porte le liseré orange, `.danger` le rouge). */
const CLASSE_TON: Record<TonTuile, string> = { neutre: "", succes: " success", alerte: " warn", danger: " danger" };

export type CouleurIcone = "success" | "info" | "danger" | "accent";

/** Le fond et l'encre du pictogramme (`tuileDashboard` de app.js). */
const PASTILLE: Record<CouleurIcone, { background: string; color: string }> = {
  success: { background: "var(--success-soft)", color: "var(--success)" },
  info: { background: "var(--info-soft)", color: "var(--info)" },
  danger: { background: "var(--danger-soft)", color: "var(--danger)" },
  accent: { background: "var(--accent-soft)", color: "var(--accent-2)" },
};

/** Sans couleur imposée, la pastille suit le ton, comme dans l'ancien `tuileDashboard`. */
const COULEUR_DU_TON: Record<TonTuile, CouleurIcone> = { neutre: "info", succes: "info", alerte: "accent", danger: "danger" };

/**
 * Une tuile du tableau de bord (`.stat-card`, `tuileDashboard`) : un chiffre
 * qui appelle le clic OUVRE l'écran qu'il résume. Le ton ne porte jamais seul
 * le sens : le libellé dit ce qui est compté.
 */
export function Tuile({
  libelle,
  valeur,
  sous,
  ton = "neutre",
  vers,
  titre,
  icone,
  couleurIcone,
  argent = false,
}: {
  libelle: string;
  valeur: ReactNode;
  sous?: ReactNode;
  ton?: TonTuile;
  vers: string;
  titre?: string;
  icone: NomIcone;
  couleurIcone?: CouleurIcone;
  /** Un montant, écrit plus petit qu'un compte (`.stat-num-money`). */
  argent?: boolean;
}) {
  return (
    <Link to={vers} title={titre ?? libelle} className={`stat-card${CLASSE_TON[ton]} cliquable`}>
      <div className="stat-card-top">
        <span className="stat-icon" style={PASTILLE[couleurIcone ?? COULEUR_DU_TON[ton]]}>
          <Icone nom={icone} />
        </span>
      </div>
      <div className="stat-label">{libelle}</div>
      <div className={argent ? "stat-num stat-num-money" : "stat-num"}>{valeur}</div>
      {sous && <div className="stat-subamount">{sous}</div>}
    </Link>
  );
}

/**
 * Une ligne de « À traiter » (`.traiter-row`) : n'apparaît que si elle compte
 * quelque chose. Son pictogramme sur sa pastille, le compte sur sa bulle.
 */
export function LigneATraiter({
  libelle,
  precision,
  nombre,
  vers,
  picto,
  fond,
  teinte,
}: {
  libelle: ReactNode;
  precision?: string;
  nombre: number;
  vers: string;
  picto: string;
  fond: string;
  /** La couleur de la bulle du compte, quand ce n'est pas l'accent (rouge d'un SAV, gris d'une attente). */
  teinte?: string;
}) {
  if (!nombre) return null;
  return (
    <Link to={vers} className="traiter-row">
      <span className="traiter-ico" style={{ background: fond }} aria-hidden="true">
        {picto}
      </span>
      <span className="traiter-label">
        {libelle}
        {precision && <small style={{ display: "block", color: "var(--text-dim)", fontWeight: 400 }}>{precision}</small>}
      </span>
      <span className="traiter-count" style={teinte ? { background: teinte } : undefined}>
        {nombre}
      </span>
      <span className="traiter-chev" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}

/**
 * Un bloc titré du tableau de bord : la ligne de titre (`.section-title-row`,
 * titre en petites capitales grises) et ce qu'elle coiffe. Le titre nomme la
 * région pour les lecteurs d'écran ; `compte` pose la bulle orange à côté.
 */
export function Section({ titre, compte, aDroite, style, children }: { titre: ReactNode; compte?: number; aDroite?: ReactNode; style?: CSSProperties; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <div className="section-title-row" style={style}>
        <span className="section-title" id={id} style={{ margin: 0 }}>
          {titre}
          {compte ? (
            <>
              {" "}
              <span className="dossier-badge" style={{ marginLeft: "6px" }}>
                {compte}
              </span>
            </>
          ) : null}
        </span>
        {aDroite}
      </div>
      {children}
    </section>
  );
}

/** L'en-tête commun (`enteteDashboard`) : salutation, sous-titre, date du jour en toutes lettres. */
export function EnTeteTableau({ titre, sousTitre, date }: { titre: string; sousTitre: string; date: string }) {
  return (
    <div className="dash-greetrow">
      <div>
        <h1 className="dash-greeting">{titre}</h1>
        <div className="dash-subtitle">{sousTitre}</div>
      </div>
      <div className="dash-date-pill">{date}</div>
    </div>
  );
}
