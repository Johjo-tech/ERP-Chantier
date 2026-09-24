import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatEuros, formatTaux, montant } from "@/lib/money";
import { libelleType } from "../domain/article";
import { libelleEncodage, type LectureFichier } from "../domain/import";
import { useCodesExistants } from "../hooks/useArticles";

/** Ce qu'on montre d'un fichier avant d'écrire : assez pour juger, pas mille lignes. */
const APERCU = { articles: 20, rejets: 8, signalements: 6 } as const;

interface Props {
  nom: string;
  lecture: LectureFichier;
  enCours: boolean;
  onImporter: () => void;
  onRapport: () => void;
}

function Chiffre({ valeur, libelle }: { valeur: number | string; libelle: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums">{valeur}</div>
      <div className="text-xs text-muted-foreground">{libelle}</div>
    </div>
  );
}

function Liste({ titre, lignes, reste }: { titre: string; lignes: string[]; reste: number }) {
  return (
    <>
      <p className="font-semibold">{titre}</p>
      <ul className="list-disc pl-5">{lignes.map((l) => <li key={l}>{l}</li>)}</ul>
      {reste > 0 && <p className="mt-1 text-xs">…et {reste} autre(s), dans le rapport.</p>}
    </>
  );
}

export function ApercuImport({ nom, lecture, enCours, onImporter, onRapport }: Props) {
  const existants = useCodesExistants(lecture.articles.map((a) => a.code));
  const aMettreAJour = existants.data ? lecture.articles.filter((a) => existants.data.has(a.code)).length : null;
  const n = lecture.articles.length;
  const { rejets, signalements } = lecture;

  return (
    <section aria-label={`Aperçu de ${nom}`} className="flex flex-col gap-4">
      <p className="text-sm">
        <span className="font-medium">{nom}</span> — encodage constaté : <span className="font-medium">{libelleEncodage(lecture.encodage)}</span>
      </p>
      <div className="flex flex-wrap gap-6">
        <Chiffre valeur={n} libelle="article(s) lu(s)" />
        <Chiffre valeur={aMettreAJour === null ? "…" : n - aMettreAJour} libelle="à créer" />
        <Chiffre valeur={aMettreAJour ?? "…"} libelle="à mettre à jour" />
        <Chiffre valeur={rejets.length} libelle="rejeté(s)" />
        <Chiffre valeur={signalements.length} libelle="signalé(s)" />
      </div>
      {rejets.length > 0 && (
        <Alert variant="erreur">
          <Liste titre="Lignes écartées" lignes={rejets.slice(0, APERCU.rejets).map((r) => `Ligne ${r.ligne} — ${r.motif}`)} reste={rejets.length - APERCU.rejets} />
        </Alert>
      )}
      {signalements.length > 0 && (
        <Alert>
          <Liste
            titre="Décidé à la place du fichier"
            lignes={signalements.slice(0, APERCU.signalements).map((s) => `Ligne ${s.ligne}${s.code ? ` (${s.code})` : ""} — ${s.motif}`)}
            reste={signalements.length - APERCU.signalements}
          />
        </Alert>
      )}
      {n > 0 && (
        <Table aria-label={`Les ${Math.min(n, APERCU.articles)} premiers articles lus`}>
          <THead>
            <Tr><Th>Code</Th><Th>Désignation</Th><Th>Type</Th><Th>Unité</Th><Th className="text-right">Prix HT</Th><Th className="text-right">TVA</Th></Tr>
          </THead>
          <TBody>
            {lecture.articles.slice(0, APERCU.articles).map((a) => (
              <Tr key={a.code}>
                <Td className="font-mono text-xs">{a.code}</Td>
                <Td>{a.designation}{!a.actif && <span className="ml-2 text-xs text-muted-foreground">(retiré)</span>}</Td>
                <Td>{libelleType(a.type_article)}</Td>
                <Td>{a.unite ?? "—"}</Td>
                <Td className="text-right tabular-nums">{formatEuros(montant(a.prix_unitaire))}</Td>
                <Td className="text-right tabular-nums">{formatTaux(montant(a.tva))}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      <div className="flex flex-wrap gap-2">
        <Button disabled={n === 0 || enCours} onClick={onImporter}>
          {enCours ? "Import en cours…" : `Importer ${n} article${n > 1 ? "s" : ""}`}
        </Button>
        {(rejets.length > 0 || signalements.length > 0) && <Button variant="outline" onClick={onRapport}>Télécharger le rapport</Button>}
      </div>
    </section>
  );
}
