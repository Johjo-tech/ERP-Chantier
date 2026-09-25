import { useState, type FormEvent } from "react";
import { EnTetePage } from "@/components/page/EnTetePage";
import { ChampTexte } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { messageErreur } from "@/lib/erreurs";
import { nomRenseigne, schemaMonNom } from "../domain/motdepasse";
import { useRenommerMonCompte } from "../hooks/useMonCompte";
import { useSession } from "../hooks/useSession";
import { FormulaireMotDePasse } from "./PageNouveauMotDePasse";

/**
 * Mon compte (AUTH-17) : le nom affiché et le mot de passe. Ouvert à TOUS les
 * rôles — le nom appartient à la personne, pas à la société.
 */
export function PageMonCompte() {
  const { etat } = useSession();
  if (etat.statut !== "connecte") return null;
  const { utilisateur } = etat.session;
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <EnTetePage titre="Mon compte" />
      <MonNom id={utilisateur.id} nom={utilisateur.nom} email={utilisateur.email} />
      <Card>
        <CardHeader>
          <CardTitle>Mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          <FormulaireMotDePasse apres={null} />
        </CardContent>
      </Card>
    </div>
  );
}

function MonNom({ id, nom, email }: { id: string; nom: string; email: string }) {
  const [valeur, setValeur] = useState(nomRenseigne(nom, email) ? nom : "");
  const [erreur, setErreur] = useState<string | undefined>();
  const renommer = useRenommerMonCompte(id);

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const r = schemaMonNom.safeParse({ nom: valeur });
    if (!r.success) return setErreur(r.error.issues[0]?.message);
    setErreur(undefined);
    renommer.mutate(r.data.nom);
  }

  return (
    <form onSubmit={soumettre} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Mon nom</CardTitle>
          <p className="text-sm text-muted-foreground">
            C'est ce nom qui s'affiche dans le menu et dans les validations.
            {!nomRenseigne(nom, email) && " Tant qu'il n'est pas renseigné, l'application se rabat sur votre adresse e-mail."}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <ChampTexte libelle="Nom affiché" valeur={valeur} onChange={setValeur} erreur={erreur} placeholder="Ex : Johan" />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="adresse-connexion">Adresse de connexion</Label>
            <Input id="adresse-connexion" value={email} disabled aria-describedby="adresse-aide" />
            <p id="adresse-aide" className="text-xs text-muted-foreground">Votre adresse ne se change pas ici.</p>
          </div>
          {renommer.isError && <Alert variant="erreur">{messageErreur(renommer.error)}</Alert>}
          {renommer.isSuccess && <Alert variant="succes">Nom enregistré.</Alert>}
          <div>
            <Button type="submit" disabled={renommer.isPending}>{renommer.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
