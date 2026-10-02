import type { ReactNode } from "react";
import { Link } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDateFr } from "@/lib/dates";
import { montant } from "@/lib/money";
import { formatEurosEcran, useModeDiscret } from "@/lib/modeDiscret";
import { estAvoir } from "@/modules/documents/domain/totaux";
import { useDocumentsClient } from "../hooks/useEspaceClient";

function Section<T>({ titre, requete, vide, rendu }: { titre: string; requete: { isPending: boolean; isError: boolean; error: unknown; data?: T[]; refetch: () => unknown }; vide: string; rendu: (d: T[]) => ReactNode }) {
  useModeDiscret();
  return (
    <Card>
      <CardHeader><CardTitle>{titre}</CardTitle></CardHeader>
      <CardContent>
        {requete.isPending && <Chargement />}
        {requete.isError && <Erreur erreur={requete.error} reessayer={() => void requete.refetch()} />}
        {requete.data && (requete.data.length === 0 ? <Vide message={vide} /> : rendu(requete.data))}
      </CardContent>
    </Card>
  );
}

/** Ce qu'un client consulte : ses chantiers, ses devis envoyés, ses factures émises et ce qu'il en doit. */
export function PageEspaceClient() {
  useModeDiscret();
  const { chantiers, devis, factures, soldes } = useDocumentsClient();
  const soldeDe = new Map((soldes.data ?? []).map((s) => [s.facture_id, s]));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Vos documents</h1>
        <Link className="text-sm font-medium text-primary hover:underline" to="/espace-client/bons">Suivi de vos bons de commande</Link>
      </div>
      <Section titre="Vos chantiers" requete={chantiers} vide="Aucun chantier." rendu={(liste) => (
        <ul className="divide-y divide-border text-sm">
          {liste.map((c) => (
            <li key={c.id} className="py-2">
              <strong>{c.nom}</strong> — {[c.adresse, c.code_postal, c.ville].filter(Boolean).join(" ")}
              <span className="block text-muted-foreground">{formatDateFr(c.date_debut)} → {formatDateFr(c.date_fin)}</span>
            </li>
          ))}
        </ul>
      )} />
      <Section titre="Vos devis" requete={devis} vide="Aucun devis." rendu={(liste) => (
        <Table>
          <THead><Tr><Th>N°</Th><Th>Date</Th><Th className="text-right">TTC</Th></Tr></THead>
          <TBody>
            {liste.map((d) => (
              <Tr key={d.id}>
                <Td><Link className="text-primary hover:underline" to={`/espace-client/devis/${d.id}`}>{d.numero}</Link></Td>
                <Td>{formatDateFr(d.date)}</Td>
                <Td className="text-right tabular-nums">{formatEurosEcran(montant(d.ttc))}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )} />
      <Section titre="Vos factures" requete={factures} vide="Aucune facture." rendu={(liste) => (
        <Table>
          <THead><Tr><Th>N°</Th><Th>Date</Th><Th>Échéance</Th><Th className="text-right">TTC</Th><Th className="text-right">Reste dû</Th></Tr></THead>
          <TBody>
            {liste.map((f) => (
              <Tr key={f.id}>
                <Td><Link className="text-primary hover:underline" to={`/espace-client/factures/${f.id}`}>{f.numero}</Link></Td>
                <Td>{formatDateFr(f.date)}</Td>
                <Td>{formatDateFr(f.echeance)}</Td>
                <Td className="text-right tabular-nums">{formatEurosEcran(estAvoir(f.type_document) ? montant(f.ttc).neg() : montant(f.ttc))}</Td>
                <Td className="text-right tabular-nums">
                  {/* Un avoir n'est pas une dette : son reste est un crédit, on ne le présente pas comme dû. */}
                  {estAvoir(f.type_document) ? "—" : soldeDe.has(f.id) ? formatEurosEcran(montant(soldeDe.get(f.id)?.reste ?? 0)) : "…"}
                  {soldeDe.get(f.id)?.en_retard && <span className="block text-xs font-semibold text-destructive">En retard</span>}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )} />
    </div>
  );
}
