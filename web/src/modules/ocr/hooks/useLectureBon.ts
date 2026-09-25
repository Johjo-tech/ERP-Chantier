import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { extraireBonCommande } from "../api/extraire";
import { preparerDocument } from "../api/preparer";
import type { EtapeLecture } from "../domain/lecture";

const RAFRAICHISSEMENT_MS = 1000;

/**
 * La lecture d'un bon, annulable, avec son étape et le temps écoulé. Le
 * chronomètre ne re-rend que chaque seconde ; le dernier fichier est gardé
 * pour « Réessayer » sans le redemander.
 */
export function useLectureBon() {
  const controle = useRef<AbortController | null>(null);
  const [debut, setDebut] = useState<number | null>(null);
  const [ecoule, setEcoule] = useState(0);
  const [etape, setEtape] = useState<EtapeLecture>("preparation");
  const [dernier, setDernier] = useState<File | null>(null);
  const lecture = useMutation({
    mutationFn: async (f: File) => {
      controle.current = new AbortController();
      setDernier(f);
      setDebut(Date.now());
      setEcoule(0);
      setEtape("preparation");
      const pret = await preparerDocument(f);
      return extraireBonCommande(pret, controle.current.signal, setEtape);
    },
    onSettled: () => setDebut(null),
  });
  useEffect(() => {
    if (debut === null) return;
    const minuteur = window.setInterval(() => setEcoule(Date.now() - debut), RAFRAICHISSEMENT_MS);
    return () => window.clearInterval(minuteur);
  }, [debut]);
  return {
    lecture,
    ecoule,
    etape,
    annuler: () => controle.current?.abort(),
    reessayer: () => dernier && lecture.mutate(dernier),
  };
}
