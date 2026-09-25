import type { ReactNode } from "react";
import { formatDateFr } from "@/lib/dates";
import { formatEuros, formatTaux, montant } from "@/lib/money";
import type { LigneEdition } from "../domain/lignes";
import { montantLigneHt } from "../domain/totaux";
import { BlocTotaux } from "./BlocTotaux";

interface Partie {
  nom: string;
  lignes: (string | null | undefined)[];
}

interface Props {
  titre: string;
  numero: string;
  date: string;
  emetteur: Partie;
  destinataire: Partie;
  meta?: { libelle: string; valeur: string }[];
  lignes: LigneEdition[];
  remise: string;
  deductions?: { acomptes: unknown; retenuePct: unknown };
  signe?: 1 | -1;
  pied?: ReactNode;
}

const texte = (lignes: Partie["lignes"]) => lignes.filter(Boolean).map((l) => <span key={l} className="block">{l}</span>);

/** Un document commercial mis en page pour l'impression (Ctrl+P → PDF). */
export function DocumentImprimable({ titre, numero, date, emetteur, destinataire, meta = [], lignes, remise, deductions, signe = 1, pied }: Props) {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 bg-white p-8 text-sm text-black print:p-0">
      <header className="flex justify-between gap-6">
        <div>
          <p className="text-lg font-bold">{emetteur.nom}</p>
          <p className="text-xs">{texte(emetteur.lignes)}</p>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-bold tracking-wide" style={{ color: "var(--color-primary, #182233)" }}>{titre}</h1>
          <p>N° {numero}</p>
          <p>Du {formatDateFr(date)}</p>
          {meta.map((m) => (
            <p key={m.libelle}>
              {m.libelle} {m.valeur}
            </p>
          ))}
        </div>
      </header>
      <section className="ml-auto w-72 rounded border border-gray-300 p-3">
        <p className="font-semibold">{destinataire.nom}</p>
        <p>{texte(destinataire.lignes)}</p>
      </section>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b-2 border-black text-left" style={{ borderColor: "var(--color-accent-societe, #000000)" }}>
            <th className="py-1">Désignation</th>
            <th className="py-1 text-right">Qté</th>
            <th className="py-1 text-right">PU HT</th>
            <th className="py-1 text-right">TVA</th>
            <th className="py-1 text-right">Total HT</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) =>
            l.type === "ligne" ? (
              <tr key={l.cle} className="border-b border-gray-200 align-top">
                <td className="py-1">
                  {l.designation}
                  {l.commentaire && <span className="block text-gray-600">{l.commentaire}</span>}
                </td>
                <td className="py-1 text-right">
                  {l.quantite} {l.unite}
                </td>
                <td className="py-1 text-right">{formatEuros(montant(l.prix_unitaire))}</td>
                {/* « 5,5 % » et non « 5.5% » : défaut DEV-52 de l'ancien PDF. */}
                <td className="py-1 text-right">{formatTaux(montant(l.tva))}</td>
                <td className="py-1 text-right">{formatEuros(montantLigneHt(l))}</td>
              </tr>
            ) : (
              <tr key={l.cle} className={l.type === "chapitre" ? "font-semibold" : "italic text-gray-600"}>
                <td colSpan={5} className="pt-3">{l.designation}</td>
              </tr>
            )
          )}
        </tbody>
      </table>
      <BlocTotaux lignes={lignes} remise={remise} deductions={deductions} signe={signe} />
      {pied}
    </article>
  );
}
