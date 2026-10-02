import { useState } from "react";
import type { z } from "zod";
import { erreursParChamp } from "./validation";

/**
 * L'état d'un formulaire : valeurs texte, erreurs par champ, validation Zod.
 * Les valeurs restent des chaînes (ce que rend un `<input>`) ; c'est le schéma
 * qui les convertit et les contrôle, au seul moment de l'envoi.
 */
export function useFormulaire<V extends Record<string, string>>(initiales: V) {
  const [valeurs, setValeurs] = useState<V>(initiales);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  function changer<K extends keyof V>(champ: K, valeur: string) {
    setValeurs((v) => ({ ...v, [champ]: valeur }));
    if (erreurs[champ as string]) {
      setErreurs(({ [champ as string]: _retiree, ...reste }) => reste);
    }
  }

  function valider<S extends z.ZodType>(schema: S): z.infer<S> | null {
    const r = schema.safeParse(valeurs);
    if (r.success) {
      setErreurs({});
      return r.data;
    }
    setErreurs(erreursParChamp(r.error));
    return null;
  }

  return { valeurs, erreurs, changer, valider, reinitialiser: setValeurs };
}
