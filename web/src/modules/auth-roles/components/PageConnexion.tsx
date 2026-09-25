import { useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { messageErreur } from "@/lib/erreurs";
import { demanderReinitialisation } from "../api/compte";
import { seConnecter } from "../api/session";
import { schemaConnexion } from "../domain/connexion";
import { MESSAGES_DECONNEXION } from "../domain/expiration";
import { messageLienEnvoye, schemaDemandeReinitialisation } from "../domain/motdepasse";
import { useSession } from "../hooks/useSession";

export function PageConnexion() {
  const { etat } = useSession();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreurs, setErreurs] = useState<{ email?: string; motDePasse?: string; general?: string }>({});
  const [envoi, setEnvoi] = useState(false);
  const [lienEnvoye, setLienEnvoye] = useState<string | null>(null);

  if (etat.statut === "connecte") return <Navigate to="/" replace />;

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    const r = schemaConnexion.safeParse({ email, motDePasse });
    if (!r.success) {
      const f = r.error.flatten().fieldErrors;
      setErreurs({ email: f.email?.[0], motDePasse: f.motDePasse?.[0] });
      return;
    }
    setErreurs({});
    setEnvoi(true);
    try {
      await seConnecter(r.data.email, r.data.motDePasse);
      await qc.invalidateQueries({ queryKey: ["auth"] });
    } catch (err) {
      setErreurs({ general: messageErreur(err) });
    } finally {
      setEnvoi(false);
    }
  }

  /** AUTH-03 : comme l'ancienne page, l'adresse saisie sert à la demande ; la réponse reste neutre. */
  async function motDePasseOublie() {
    setLienEnvoye(null);
    const r = schemaDemandeReinitialisation.safeParse({ email });
    if (!r.success) {
      setErreurs({ email: r.error.issues[0]?.message ?? "Adresse e-mail invalide." });
      return;
    }
    setErreurs({});
    setEnvoi(true);
    try {
      await demanderReinitialisation(r.data.email);
      setLienEnvoye(messageLienEnvoye(r.data.email));
    } catch (err) {
      console.error("Demande de réinitialisation refusée", err);
      setErreurs({ general: "Envoi impossible. Réessayez dans un instant." });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <main className="flex min-h-full items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>ERP Chantier</CardTitle>
          <p className="text-sm text-muted-foreground">Connectez-vous pour continuer.</p>
          {/* AUTH-05 : la date du jour, et aucune société — on ne sait pas encore chez qui l'on entre. */}
          <p className="text-xs text-muted-foreground">{dateDuJour()}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={soumettre} noValidate className="flex flex-col gap-4">
            {/* AUTH-10 : renvoyé ici par une session expirée, on dit pourquoi — sinon on croit à un bug. */}
            {etat.statut === "anonyme" && etat.motif && !erreurs.general && <Alert>{MESSAGES_DECONNEXION[etat.motif]}</Alert>}
            {erreurs.general && <Alert variant="erreur">{erreurs.general}</Alert>}
            {lienEnvoye && <Alert variant="succes">{lienEnvoye}</Alert>}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Adresse e-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!erreurs.email}
                aria-describedby={erreurs.email ? "email-erreur" : undefined}
              />
              {erreurs.email && (
                <p id="email-erreur" className="text-xs text-destructive">
                  {erreurs.email}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mot-de-passe">Mot de passe</Label>
              <Input
                id="mot-de-passe"
                type="password"
                autoComplete="current-password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                aria-invalid={!!erreurs.motDePasse}
                aria-describedby={erreurs.motDePasse ? "mdp-erreur" : undefined}
              />
              {erreurs.motDePasse && (
                <p id="mdp-erreur" className="text-xs text-destructive">
                  {erreurs.motDePasse}
                </p>
              )}
            </div>
            <Button type="submit" disabled={envoi}>
              {envoi ? "Connexion…" : "Se connecter"}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={envoi} onClick={() => void motDePasseOublie()}>
              Mot de passe oublié ?
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

const formatJour = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", year: "numeric" });

function dateDuJour(): string {
  const d = formatJour.format(new Date());
  return d.charAt(0).toUpperCase() + d.slice(1);
}
