/**
 * Prévenir quand l'onglet tourne sur une version que le serveur ne sert plus.
 *
 * On relit la page d'accueil telle que le serveur la sert maintenant, et on
 * compare son marqueur de version à celui de la page ouverte. S'ils diffèrent,
 * un bandeau propose de recharger — sans jamais le faire d'autorité : une
 * saisie en cours serait perdue, et c'est pire qu'un onglet en retard.
 */
import { versionChangee, versionDuHtml } from "@/api/regles-version";

/** Assez souvent pour qu'un onglet laissé ouvert la journée l'apprenne. */
const INTERVALLE_VERIFICATION_MS = 5 * 60_000;

const ID_BANDEAU = "bandeau-nouvelle-version";

function versionDeLaPage(): string | null {
  return document.querySelector<HTMLMetaElement>('meta[name="version-construite"]')?.content ?? null;
}

async function versionServie(): Promise<string | null> {
  const reponse = await fetch("/", { cache: "no-store", credentials: "same-origin" });
  if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
  return versionDuHtml(await reponse.text());
}

function afficherBandeau(): void {
  if (document.getElementById(ID_BANDEAU)) return;
  const bandeau = document.createElement("div");
  bandeau.id = ID_BANDEAU;
  bandeau.setAttribute("role", "status");
  bandeau.style.cssText =
    "position:fixed; left:50%; bottom:18px; transform:translateX(-50%); z-index:10000;" +
    "display:flex; gap:12px; align-items:center; padding:10px 14px; border-radius:10px;" +
    "background:var(--surface, #fff); color:var(--text, #1F2937); border:1px solid var(--accent, #E8590C);" +
    "box-shadow:0 6px 24px rgba(0,0,0,.15); font:13.5px/1.4 system-ui, sans-serif;";
  const texte = document.createElement("span");
  texte.textContent = "Une nouvelle version de l'application est disponible.";
  const bouton = document.createElement("button");
  bouton.type = "button";
  bouton.className = "btn small primary";
  bouton.textContent = "Recharger";
  bouton.addEventListener("click", () => location.reload());
  bandeau.append(texte, bouton);
  document.body.appendChild(bandeau);
}

/** Lance la surveillance. À appeler une fois, une fois l'application démarrée. */
export function surveillerVersion(): void {
  const actuelle = versionDeLaPage();
  let minuterie: number | undefined;

  const verifier = async () => {
    try {
      if (!versionChangee(actuelle, await versionServie())) return;
      afficherBandeau();
      // Prévenu une fois suffit : inutile de continuer à interroger le serveur.
      window.clearInterval(minuterie);
      document.removeEventListener("visibilitychange", auRetour);
    } catch (e) {
      // Hors ligne, serveur indisponible : on réessaiera au prochain passage.
      console.warn("Vérification de version impossible", e);
    }
  };
  const auRetour = () => {
    if (document.visibilityState === "visible") void verifier();
  };

  minuterie = window.setInterval(verifier, INTERVALLE_VERIFICATION_MS);
  document.addEventListener("visibilitychange", auRetour);
}
