import { useRef, useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { messageErreur } from "@/lib/erreurs";
import { useTitre } from "@/lib/useTitre";
import css from "@/styles/connexion.css?inline";
import { ADAPTATIONS_PAGE_AUTONOME, useFeuilleDeStyle } from "@/styles/useFeuilleDeStyle";
import { demanderReinitialisation } from "../api/compte";
import { seConnecter } from "../api/session";
import { MESSAGES_DECONNEXION } from "../domain/expiration";
import { messageLienEnvoye, schemaDemandeReinitialisation } from "../domain/motdepasse";
import { useSession } from "../hooks/useSession";

type Message = { genre: "erreur" | "succes"; texte: string } | null;

/**
 * La page de connexion, au HTML près celle de l'ancienne application
 * (`src/pages/login.html`) : la feuille de plan, la façade qui se trace, le
 * cartouche daté — et sa feuille de style, copiée telle quelle
 * (`styles/connexion.css`), posée le temps de la page.
 */
export function PageConnexion() {
  useFeuilleDeStyle(css + ADAPTATIONS_PAGE_AUTONOME, "feuille-connexion");
  useTitre("ERP Chantier - Connexion");
  const { etat } = useSession();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const champEmail = useRef<HTMLInputElement>(null);
  const [envoi, setEnvoi] = useState(false);
  const [oubliEnCours, setOubliEnCours] = useState(false);
  // AUTH-10 : renvoyé ici par une session expirée, on dit pourquoi — sinon on croit à un bug.
  const motif = etat.statut === "anonyme" && etat.motif ? MESSAGES_DECONNEXION[etat.motif] : null;
  const [saisi, setMessage] = useState<Message>(null);
  const message: Message = saisi ?? (motif ? { genre: "erreur", texte: motif } : null);

  if (etat.statut === "connecte") return <Navigate to="/" replace />;

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    const adresse = email.trim();
    if (!adresse || !motDePasse) {
      setMessage({ genre: "erreur", texte: "Veuillez remplir tous les champs" });
      return;
    }
    setEnvoi(true);
    setMessage(null);
    try {
      await seConnecter(adresse, motDePasse);
      await qc.invalidateQueries({ queryKey: ["auth"] });
    } catch (err) {
      setMessage({ genre: "erreur", texte: messageErreur(err) });
    } finally {
      setEnvoi(false);
    }
  }

  /** AUTH-03 : l'adresse saisie sert à la demande ; la réponse reste neutre. */
  async function motDePasseOublie() {
    const r = schemaDemandeReinitialisation.safeParse({ email });
    if (!r.success) {
      setMessage({ genre: "erreur", texte: email.trim() ? (r.error.issues[0]?.message ?? "Adresse e-mail invalide.") : "Saisissez votre email, puis cliquez à nouveau." });
      champEmail.current?.focus();
      return;
    }
    setOubliEnCours(true);
    try {
      await demanderReinitialisation(r.data.email);
      setMessage({ genre: "succes", texte: messageLienEnvoye(r.data.email) });
    } catch (err) {
      console.error("Demande de réinitialisation refusée", err);
      setMessage({ genre: "erreur", texte: "Envoi impossible. Réessayez dans un instant." });
    } finally {
      setOubliEnCours(false);
    }
  }

  return (
    <>
      <div className="calque" />
      <Facade />
      <main className="feuille">
        <div className="login-header">
          <span className="sceau" aria-hidden="true">&#9630;</span>
          <div>
            <h1>ERP Chantier</h1>
            <p>Devis &middot; Chantiers &middot; Facturation</p>
          </div>
        </div>

        <form id="loginForm" onSubmit={soumettre} noValidate>
          <div className="form-group">
            <label htmlFor="email">Identifiant</label>
            <input ref={champEmail} type="email" id="email" name="email" placeholder="votre@email.com" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="form-group">
            <label htmlFor="password">Mot de passe</label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-login" id="btnLogin" disabled={envoi}>
            Entrer
          </button>

          <div className={message?.genre === "erreur" ? "error-message show" : "error-message"} id="errorMessage" role="alert">
            {message?.genre === "erreur" ? message.texte : ""}
          </div>
          <div className={message?.genre === "succes" ? "success-message show" : "success-message"} id="successMessage" role="status">
            {message?.genre === "succes" ? message.texte : ""}
          </div>
          <div className={envoi ? "loading show" : "loading"} id="loading">
            Connexion en cours...
          </div>
        </form>

        <div className="oubli">
          <button type="button" id="btnForgot" disabled={oubliEnCours} onClick={() => void motDePasseOublie()}>
            Mot de passe oubli&eacute; ?
          </button>
        </div>
      </main>

      {/* Pas de société sur ce cartouche (AUTH-05) : à cet instant on ne sait pas encore chez qui l'on entre. */}
      <div className="cartouche" aria-hidden="true">
        <div>&Eacute;CHELLE</div>
        <div>1:1</div>
        <div>INDICE</div>
        <div>C</div>
        <div>DATE</div>
        <div id="cartoucheDate">{dateDuCartouche()}</div>
      </div>
    </>
  );
}

/** Une coupe de façade, qui se trace toute seule au fond (le dessin de l'ancienne page, recopié). */
function Facade() {
  return (
    <svg className="dessin" viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true" dangerouslySetInnerHTML={{ __html: TRACE_FACADE }} />
  );
}

const TRACE_FACADE = `
    <path class="t" style="--l:960"  d="M120 640 L1080 640" stroke-width="1.7"/>
    <path class="t" style="--l:1500; animation-delay:-1.6s" d="M200 640 L200 330 L600 150 L1000 330 L1000 640"/>
    <path class="t" style="--l:800;  animation-delay:-3s"   d="M200 330 L1000 330"/>
    <path class="t" style="--l:380;  animation-delay:-4.2s" d="M300 640 L300 490 L380 490 L380 640"/>
    <path class="t" style="--l:560;  animation-delay:-5.2s" d="M700 420 L860 420 L860 540 L700 540 Z"/>
    <path class="t" style="--l:280;  animation-delay:-6s"   d="M780 420 L780 540 M700 480 L860 480"/>
    <path class="t" style="--l:870;  animation-delay:-7s"   d="M200 700 L1000 700 M200 690 L200 710 M1000 690 L1000 710 M192 708 L208 692 M992 708 L1008 692"/>
    <text style="animation-delay:-7s"   x="558" y="694">8 400</text>
    <text style="animation-delay:-5.2s" x="874" y="414">ALLÈGE 0,90</text>
  `;

/** « 25.09.26 » : le jour, comme une feuille qu'on vient de sortir — à l'heure de Paris. */
const formatCartouche = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "2-digit" });

function dateDuCartouche(): string {
  return formatCartouche.format(new Date()).replace(/\//g, ".");
}

