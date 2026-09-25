import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Chargement } from "@/components/etats/Etats";
import { ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { messageErreur } from "@/lib/erreurs";
import { erreursParChamp } from "@/lib/validation";
import { definirMotDePasse } from "../api/compte";
import { schemaNouveauMotDePasse } from "../domain/motdepasse";
import { useSession } from "../hooks/useSession";

/**
 * Choisir un nouveau mot de passe (AUTH-04). Le lien du courriel ouvre cette
 * page avec une session « recovery », posée par supabase-js ; sans elle, le
 * lien est expiré ou déjà servi et il faut en redemander un.
 */
export function PageNouveauMotDePasse() {
  const { etat } = useSession();
  return (
    <main className="flex min-h-full items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Nouveau mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          {etat.statut === "chargement" ? (
            <Chargement />
          ) : etat.statut === "connecte" ? (
            <FormulaireMotDePasse />
          ) : (
            <div className="flex flex-col gap-3">
              <Alert variant="erreur">Ce lien est expiré ou déjà utilisé. Demandez-en un nouveau depuis la page de connexion.</Alert>
              <Button asChild variant="outline">
                <Link to="/connexion">Retour à la connexion</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

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
    <form onSubmit={soumettre} noValidate className="flex flex-col gap-3">
      {etat.erreur !== null && <Alert variant="erreur">{messageErreur(etat.erreur)}</Alert>}
      {etat.fait && <Alert variant="succes">Mot de passe enregistré.</Alert>}
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
      <Button type="submit" disabled={etat.envoi}>
        {etat.envoi ? "Enregistrement…" : "Enregistrer le mot de passe"}
      </Button>
    </form>
  );
}
