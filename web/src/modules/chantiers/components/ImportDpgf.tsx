import { useEffect, useId, useState } from "react";
import { Modale, PiedModale } from "@/components/ui/modale";
import { messageErreur } from "@/lib/erreurs";
import { afficherToast } from "@/lib/toast";
import type { LigneDpgfBase } from "../api/dpgf";
import { devinerLignesAIgnorer, lignesDepuisCorrespondance, nombreDeColonnes, rolesPour, type RoleColonne } from "../domain/import-dpgf";
import { lireFichierDpgf, type FichierDpgfLu } from "../fichiers/lecture-dpgf";
import { useImporterDpgf } from "../hooks/useChantiers";
import { BULLE_CONSIGNE_MS, BULLE_FUGACE_MS } from "./durees";

const LIBELLES: Record<RoleColonne, string> = { designation: "Désignation", qte: "Quantité", prix: "Prix Unitaire", ignore: "Ignorer" };
const ORDRE: readonly RoleColonne[] = ["designation", "qte", "prix", "ignore"];
const APERCU = 8;

interface Props {
  chantierId: string;
  fichier: File;
  lignes: readonly LigneDpgfBase[];
  figees: ReadonlySet<string>;
  fermer: () => void;
}

/**
 * « Importer le DPGF — indiquez les colonnes » (CHA-08), la modale de l'ancien
 * (`#dpgfMappingModal`) : feuille, lignes à ignorer, rôle de chaque colonne,
 * aperçu. Les rôles sont devinés comme l'ancien, puis corrigeables. Les lignes
 * partent en base à la confirmation — l'ancien attendait « Enregistrer les
 * lignes » (D-CHA-07) — et les lignes figées restent.
 */
export function ImportDpgf({ chantierId, fichier, lignes, figees, fermer }: Props) {
  const idIgnorer = useId();
  const idFeuille = useId();
  const [lu, setLu] = useState<FichierDpgfLu | null>(null);
  const [feuille, setFeuille] = useState("");
  const [aIgnorer, setAIgnorer] = useState("0");
  const [roles, setRoles] = useState<RoleColonne[]>([]);
  const importer = useImporterDpgf(chantierId);

  function choisirFeuille(l: FichierDpgfLu, nom: string) {
    const rangees = l.feuilles[nom] ?? [];
    const n = devinerLignesAIgnorer(rangees);
    setFeuille(nom);
    setAIgnorer(String(n));
    setRoles(rolesPour(rangees, n));
  }

  useEffect(() => {
    let actif = true;
    afficherToast("Lecture du fichier…", "success", BULLE_FUGACE_MS);
    lireFichierDpgf(fichier).then(
      (l) => {
        if (!actif) return;
        if (!l.noms.length) {
          afficherToast("Ce fichier semble vide.");
          return fermer();
        }
        setLu(l);
        choisirFeuille(l, l.courante);
      },
      (e: unknown) => {
        if (!actif) return;
        console.error("DPGF illisible :", e);
        afficherToast("Impossible de lire ce fichier. Formats acceptés : Excel (.xlsx, .xls) ou CSV.");
        fermer();
      }
    );
    return () => {
      actif = false;
    };
    // `fermer` change à chaque rendu du parent : seul le fichier relance la lecture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fichier]);

  if (!lu) return null;
  const rangees = lu.feuilles[feuille] ?? [];
  const n = Math.max(0, Number.parseInt(aIgnorer, 10) || 0);
  const nbColonnes = nombreDeColonnes(rangees);

  function changerIgnorees(v: string) {
    setAIgnorer(v);
    setRoles(rolesPour(rangees, Math.max(0, Number.parseInt(v, 10) || 0)));
  }

  function confirmer() {
    const r = lignesDepuisCorrespondance(rangees, n, roles);
    if (!r.ok) return afficherToast(r.motif);
    const aRemplacer = lignes.filter((l) => !figees.has(l.id)).map((l) => l.id);
    const suivante = lignes.reduce((max, l) => (figees.has(l.id) ? Math.max(max, l.position) : max), -1) + 1;
    importer.mutate(
      { lignes: r.lignes, aRemplacer, positionSuivante: suivante },
      {
        onSuccess: () => {
          fermer();
          afficherToast(`${r.lignes.length} ligne(s) importée(s).`, "success", BULLE_CONSIGNE_MS);
        },
        onError: (err) => afficherToast(messageErreur(err)),
      }
    );
  }

  return (
    <Modale titre="Importer le DPGF — indiquez les colonnes" onFermer={fermer} largeurMax="920px">
      <p className="card-sub">
        Pour chaque colonne de votre fichier, indiquez ce qu'elle représente. Ajustez le nombre de lignes à ignorer si le tableau ne commence pas tout en haut.
      </p>
      {lu.noms.length > 1 && (
        <div className="field" style={{ maxWidth: "320px", marginBottom: "10px" }}>
          <label htmlFor={idFeuille}>Feuille du classeur</label>
          <select id={idFeuille} value={feuille} onChange={(e) => choisirFeuille(lu, e.target.value)}>
            {lu.noms.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field" style={{ maxWidth: "280px", marginBottom: "10px" }}>
        <label htmlFor={idIgnorer}>Ignorer les premières lignes (titres, en-têtes de document…)</label>
        <input type="number" id={idIgnorer} min={0} value={aIgnorer} onChange={(e) => changerIgnorees(e.target.value)} />
      </div>
      <div style={{ overflow: "auto", maxHeight: "50vh", border: "1px solid var(--border)", borderRadius: "8px" }}>
        <table className="lignes-table" style={{ minWidth: "600px" }}>
          <thead>
            <tr>
              {Array.from({ length: nbColonnes }, (_, c) => (
                <th key={c}>
                  <select
                    aria-label={`Rôle de la colonne ${c + 1}`}
                    style={{ fontSize: "11px", padding: "3px" }}
                    value={roles[c] ?? "ignore"}
                    onChange={(e) => setRoles(roles.map((r, i) => (i === c ? (e.target.value as RoleColonne) : r)))}
                  >
                    {ORDRE.map((r) => (
                      <option key={r} value={r}>
                        {LIBELLES[r]}
                      </option>
                    ))}
                  </select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rangees.slice(n, n + APERCU).map((r, i) => (
              <tr key={i}>
                {Array.from({ length: nbColonnes }, (_, c) => (
                  <td key={c} style={{ fontSize: "12px" }}>
                    {String(r[c] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PiedModale>
        <button type="button" className="btn primary" onClick={confirmer} disabled={importer.isPending}>
          Importer ces lignes
        </button>
        <button type="button" className="btn ghost" onClick={fermer}>
          Annuler
        </button>
      </PiedModale>
    </Modale>
  );
}
