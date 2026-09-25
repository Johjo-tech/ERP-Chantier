import type { ModeleDocument } from "../domain/modele";
import { stylesCouleurs } from "./couleurs";

const Lignes = ({ lignes }: { lignes: readonly string[] }) => <>{lignes.map((l) => <span key={l} className="block">{l}</span>)}</>;

/**
 * L'aperçu à l'écran du MÊME modèle que le PDF (ModeleDocument) : ce qu'on
 * voit est ce qui part, mentions et pied compris. Ctrl+P reste possible.
 */
export function ApercuModele({ m }: { m: ModeleDocument }) {
  const couleurs = stylesCouleurs(m);
  return (
    <article aria-label={`${m.titre} ${m.nomFichier}`} className="mx-auto flex max-w-3xl flex-col gap-5 bg-white p-8 text-sm text-black print:p-0">
      {m.brouillon && <p className="text-sm font-semibold text-red-700">BROUILLON — sans valeur de facture tant qu'elle n'est pas émise.</p>}
      <header className="flex justify-between gap-6 border-b-2 pb-3" style={couleurs.filet}>
        <div className="flex gap-3">
          {m.emetteur.logo && <img src={m.emetteur.logo} alt="" className="h-16 w-auto object-contain" />}
          <div>
            <p className="text-lg font-bold">{m.emetteur.nom}</p>
            <p className="text-xs text-gray-600"><Lignes lignes={m.emetteur.coordonnees} /></p>
            <p className="mt-1 text-xs text-gray-600"><Lignes lignes={m.emetteur.fiscal} /></p>
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-bold tracking-wide" style={couleurs.titre}>{m.titre}</h1>
          <dl className="mt-1 grid grid-cols-[auto_auto] justify-end gap-x-3 text-xs">
            {m.meta.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-gray-600">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </header>
      <section className="grid grid-cols-2 gap-4">
        <div className={m.chantier ? "rounded border border-gray-300 p-3" : ""}>
          {m.chantier && (
            <>
              <p className="text-xs font-semibold uppercase text-gray-600">Adresse du chantier</p>
              <Lignes lignes={[...m.chantier.lignes, ...m.chantier.refs.map(([k, v]) => `${k} : ${v}`)]} />
            </>
          )}
        </div>
        <div className="rounded border border-gray-300 p-3">
          <p className="text-xs font-semibold uppercase text-gray-600">Client</p>
          <p className="font-semibold">{m.client.nom}</p>
          <Lignes lignes={m.client.lignes} />
        </div>
      </section>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="text-left" style={couleurs.bandeau}>
            <th className="p-1">Désignation</th>
            <th className="p-1 text-right">Qté</th>
            <th className="p-1 text-center">Unité</th>
            <th className="p-1 text-right">PU HT</th>
            <th className="p-1 text-right">Montant HT</th>
            <th className="p-1 text-right">% TVA</th>
          </tr>
        </thead>
        <tbody>
          {m.lignes.map((l, i) =>
            l.nature === "ligne" ? (
              <tr key={i} className="border-b border-gray-200 align-top">
                <td className="p-1">
                  {l.designation}
                  {l.commentaire && <span className="block text-gray-600">{l.commentaire}</span>}
                </td>
                <td className="p-1 text-right">{l.quantite}</td>
                <td className="p-1 text-center">{l.unite}</td>
                <td className="p-1 text-right">{l.prixUnitaire}</td>
                <td className="p-1 text-right">{l.montant}</td>
                <td className="p-1 text-right">{l.tva}</td>
              </tr>
            ) : l.nature === "chapitre" ? (
              <tr key={i} className="bg-slate-100 font-semibold">
                <td colSpan={4} className="p-1">{l.designation}</td>
                <td colSpan={2} className="p-1 text-right">{l.sousTotal}</td>
              </tr>
            ) : (
              <tr key={i} className="italic text-gray-600">
                <td colSpan={6} className="p-1">{l.designation}</td>
              </tr>
            )
          )}
        </tbody>
      </table>
      <section className="flex justify-between gap-6">
        <div className="text-xs">
          {m.reglement && (
            <>
              <p className="font-semibold">Pour votre règlement</p>
              <Lignes lignes={m.reglement} />
            </>
          )}
        </div>
        <dl aria-label="Totaux du document" className="flex w-72 flex-col gap-1">
          {m.totaux.map((t) => (
            <div key={t.libelle} className={`flex justify-between gap-4 ${t.fort ? "text-base font-semibold" : ""}`} style={t.fort ? couleurs.titre : undefined}>
              <dt>{t.libelle}</dt>
              <dd className="tabular-nums">{t.valeur}</dd>
            </div>
          ))}
        </dl>
      </section>
      {m.signature && <div className="ml-auto h-28 w-72 rounded border border-gray-400 p-2 text-xs">{m.signature}</div>}
      {m.mentions && <p className="text-[10px] text-gray-600">{m.mentions}</p>}
      <footer className="border-t border-gray-200 pt-1 text-center text-[10px] text-gray-500">{m.pied}</footer>
    </article>
  );
}
