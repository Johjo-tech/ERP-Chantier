import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import { useTitre } from "@/lib/useTitre";
import { erreursParChamp } from "@/lib/validation";
import css from "@/styles/nouveau-mot-de-passe.css?inline";
import { ADAPTATIONS_PAGE_AUTONOME, useFeuilleDeStyle } from "@/styles/useFeuilleDeStyle";
import { definirMotDePasse } from "../api/compte";
import { schemaNouveauMotDePasse } from "../domain/motdepasse";
import { useSession } from "../hooks/useSession";

/** L'ancienne page laissait lire « Mot de passe enregistré » un peu plus d'une seconde. */
const DELAI_REDIRECTION_MS = 1200;

const LIEN_EXPIRE = "Ce lien est expiré ou déjà utilisé. Demandez-en un nouveau depuis la page de connexion.";

type Message = { genre: "erreur" | "succes"; texte: string } | null;

/**
 * Choisir un nouveau mot de passe (AUTH-04), au HTML près la page autonome de
 * l'ancienne application (`src/pages/nouveau-mot-de-passe.html`) et sa feuille
 * copiée telle quelle — y compris la classe `login-card`, que sa feuille ne
 * stylait pas (elle visait `.login-container`) : on reproduit l'écran, défaut
 * compris. Le lien du courriel ouvre cette page avec une session « recovery »,
 * posée par supabase-js ; sans elle, le lien est expiré ou déjà servi.
 */
export function PageNouveauMotDePasse() {
  useFeuilleDeStyle(css + ADAPTATIONS_PAGE_AUTONOME, "feuille-nouveau-mot-de-passe");
  useTitre("Nouveau mot de passe — ERP Chantier");
  const { etat: session } = useSession();
  const navigate = useNavigate();
  const [valeurs, setValeurs] = useState({ motDePasse: "", confirmation: "" });
  const [envoi, setEnvoi] = useState(false);
  const [saisi, setMessage] = useState<Message>(null);
  const sansSession = session.statut !== "chargement" && session.statut !== "connecte";
  const message: Message = saisi ?? (sansSession ? { genre: "erreur", texte: LIEN_EXPIRE } : null);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    const r = schemaNouveauMotDePasse.safeParse(valeurs);
    if (!r.success) {
      setMessage({ genre: "erreur", texte: r.error.issues[0]?.message ?? "Enregistrement impossible." });
      return;
    }
    setEnvoi(true);
    try {
      await definirMotDePasse(r.data.motDePasse);
      setMessage({ genre: "succes", texte: "Mot de passe enregistré. Redirection…" });
      setTimeout(() => void navigate("/", { replace: true }), DELAI_REDIRECTION_MS);
    } catch (err) {
      setMessage({ genre: "erreur", texte: messageErreur(err) });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="login-card">
      <div className="login-header">
        <h1>Nouveau mot de passe</h1>
        <p>Choisissez un mot de passe d'au moins 8 caractères.</p>
      </div>

      <form id="pwdForm" onSubmit={soumettre} noValidate>
        <div className="form-group">
          <label htmlFor="password">Nouveau mot de passe</label>
          <input type="password" id="password" required autoComplete="new-password" placeholder="••••••••" value={valeurs.motDePasse} onChange={(e) => setValeurs((x) => ({ ...x, motDePasse: e.target.value }))} />
        </div>
        <div className="form-group">
          <label htmlFor="confirmation">Confirmation</label>
          <input type="password" id="confirmation" required autoComplete="new-password" placeholder="••••••••" value={valeurs.confirmation} onChange={(e) => setValeurs((x) => ({ ...x, confirmation: e.target.value }))} />
        </div>

        <button type="submit" className="btn-login" id="btnSave" disabled={envoi || sansSession}>
          Enregistrer
        </button>

        <div className={message?.genre === "erreur" ? "error-message show" : "error-message"} id="errorMessage" role="alert">
          {message?.genre === "erreur" ? message.texte : ""}
        </div>
        <div className={message?.genre === "succes" ? "success-message show" : "success-message"} id="successMessage" role="status">
          {message?.genre === "succes" ? message.texte : ""}
        </div>
        <div className={envoi ? "loading show" : "loading"} id="loading">
          Enregistrement…
        </div>
      </form>

      <div style={{ marginTop: "22px", textAlign: "center" }}>
        <Link to="/connexion" style={{ color: "#6B7686", fontSize: "13px" }}>
          Retour à la connexion
        </Link>
      </div>
    </div>
  );
}

/** Le même choix, dans l'application (« Mon compte ») : les composants de base, pas la page autonome. */
export function FormulaireMotDePasse({ apres = "/" }: { apres?: string | null }) {
  const navigate = useNavigate();
  const [valeurs, setValeurs] = useState({ motDePasse: "", confirmation: "" });
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [etat, setEtat] = useState<{ envoi: boolean; erreur: unknown; fait: boolean }>({ envoi: false, erreur: null, fait: false });

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    const r = schemaNouveauMotDePasse.safeParse(valeurs);
    if (!r.success) {
      setErreurs(erreursParChamp(r.error));
      return;
    }
    setErreurs({});
    setEtat({ envoi: true, erreur: null, fait: false });
    try {
      await definirMotDePasse(r.data.motDePasse);
      setEtat({ envoi: false, erreur: null, fait: true });
      setValeurs({ motDePasse: "", confirmation: "" });
      if (apres) void navigate(apres, { replace: true });
    } catch (err) {
      setEtat({ envoi: false, erreur: err, fait: false });
    }
  }

  return (
    <form onSubmit={soumettre} noValidate>
      {etat.erreur !== null && <Alert variant="erreur">{messageErreur(etat.erreur)}</Alert>}
      {etat.fait && <Alert variant="succes">Mot de passe enregistré.</Alert>}
      <div className="field-grid">
        <ChampTexte
          libelle="Nouveau mot de passe"
          type="password"
          valeur={valeurs.motDePasse}
          onChange={(v) => setValeurs((x) => ({ ...x, motDePasse: v }))}
          erreur={erreurs.motDePasse}
          aide="8 caractères minimum."
        />
        <ChampTexte
          libelle="Confirmation"
          type="password"
          valeur={valeurs.confirmation}
          onChange={(v) => setValeurs((x) => ({ ...x, confirmation: v }))}
          erreur={erreurs.confirmation}
        />
      </div>
      <Button type="submit" disabled={etat.envoi}>
        {etat.envoi ? "Enregistrement…" : "Enregistrer le mot de passe"}
      </Button>
    </form>
  );
}
