import { useId, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { messageErreur } from "@/lib/erreurs";
import type { Chantier } from "../domain/chantier";
import { useEnregistrerInfosDiverses } from "../hooks/useChantiers";

/**
 * Informations diverses (codes d'accès, contacts…), enregistrées à la sortie du
 * champ comme dans l'ancienne fiche (app.js l. 13430) — seulement si le texte a
 * changé. Lecture seule sans « chantiers / modifier » (RLS de `chantiers`).
 */
export function BlocInfosDiverses({ chantier, modifiable }: { chantier: Chantier; modifiable: boolean }) {
  const id = useId();
  const [texte, setTexte] = useState(chantier.infos_diverses);
  const enregistrer = useEnregistrerInfosDiverses(chantier.id);
  return (
    <Card>
      <CardHeader>
        <CardTitle><label htmlFor={id}>Informations diverses</label></CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Textarea
          id={id}
          rows={4}
          value={texte}
          readOnly={!modifiable}
          placeholder="Codes d'accès, contacts utiles, remarques, particularités du chantier…"
          onChange={(e) => setTexte(e.target.value)}
          onBlur={() => modifiable && texte !== chantier.infos_diverses && enregistrer.mutate(texte)}
        />
        {enregistrer.isSuccess && <p role="status" className="text-xs text-muted-foreground">Informations enregistrées.</p>}
        {enregistrer.isError && <Alert variant="erreur">{messageErreur(enregistrer.error)}</Alert>}
      </CardContent>
    </Card>
  );
}
