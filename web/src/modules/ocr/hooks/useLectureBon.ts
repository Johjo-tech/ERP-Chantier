import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { extraireBonCommande } from "../api/extraire";

/** La lecture d'un bon, annulable, avec le temps écoulé pour l'affichage. */
export function useLectureBon() {
  const controle = useRef<AbortController | null>(null);
  const [debut, setDebut] = useState<number | null>(null);
  const [ecoule, setEcoule] = useState(0);
  const lecture = useMutation({
    mutationFn: (f: File) => {
      controle.current = new AbortController();
      setDebut(Date.now());
      return extraireBonCommande(f, controle.current.signal);
    },
    onSettled: () => setDebut(null),
  });
  useEffect(() => {
    if (debut === null) return;
    const minuteur = window.setInterval(() => setEcoule(Date.now() - debut), 1000);
    return () => window.clearInterval(minuteur);
  }, [debut]);
  return { lecture, ecoule, annuler: () => controle.current?.abort() };
}
