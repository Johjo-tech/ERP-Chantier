import { Link } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { Card } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatEuros, somme, ZERO } from "@/lib/money";
import { pourcentage } from "../domain/indicateurs";
import type { Bornes } from "../domain/periodes";
import { libelleMois } from "../domain/periodes";
import { lienClient } from "../domain/pilotage";
import { repartition, tableauEquipes, tauxConducteur } from "../domain/statistiques";
import { useCaParEquipe, useParClient, useParConducteur, useParMetier } from "../hooks/useStatistiques";
import { BarreRetard, BarresRepartition } from "./Barres";

const num = "text-right tabular-nums";

/** Par conducteur (`computeStatsParConducteur`), trié par chiffre d'affaires. */
export function StatsConducteurs({ bornes, jour }: { bornes: Bornes; jour: string }) {
  const q = useParConducteur(bornes, jour);
  if (q.isPending) return <Chargement />;
  if (q.isError) return <Erreur erreur={q.error} reessayer={() => void q.refetch()} />;
  if (!q.data.length) return <Vide message="Aucune donnée pour cette période — attribuez un conducteur de travaux à vos bons de commande, devis ou factures." />;
  const lignes = q.data.map((s) => ({ s, t: tauxConducteur(s) }));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><p className="text-sm text-muted-foreground">Devis émis</p><p className="text-2xl font-semibold">{lignes.reduce((n, l) => n + l.s.devis, 0)}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted-foreground">Bons de commande</p><p className="text-2xl font-semibold">{lignes.reduce((n, l) => n + l.s.bons, 0)}</p></Card>
        <Card className="p-4"><p className="text-sm text-muted-foreground">Chiffre d'affaires HT</p><p className="text-2xl font-semibold tabular-nums">{formatEuros(somme(lignes.map((l) => l.s.ht)))}</p></Card>
      </div>
      <Card className="grid gap-6 p-4 lg:grid-cols-2">
        <BarresRepartition titre="Répartition du chiffre d'affaires" lignes={repartition(q.data).map(({ ligne, part }) => ({ libelle: ligne.nom, ht: ligne.ht, part }))} />
        <figure className="flex flex-col gap-2">
          <figcaption className="text-sm font-medium">Bons de commande — dans les temps / en retard</figcaption>
          <ul className="flex flex-col gap-1.5">
            {lignes.filter((l) => l.s.bons > 0).map(({ s, t }) => <BarreRetard key={s.conducteur_id ?? "sans"} libelle={s.nom} dansLesTemps={t.dansLesTemps} retard={s.en_retard} part={t.tauxDansLesTemps} />)}
          </ul>
        </figure>
      </Card>
      <Table>
        <caption className="mb-2 text-left text-xs text-muted-foreground">« En retard » : fin de travaux prévue dépassée sur un bon encore ouvert (ni chiffré, ni facturé, ni terminé). « Devis → facture » : part des devis dont une facture est émise. Travaux supplémentaires : part des bons qui en portent, leur nombre, et leur montant une fois chiffrés.</caption>
        <THead>
          <Tr><Th>Conducteur</Th><Th className="text-right">CA HT</Th><Th className="text-right">Bons</Th><Th className="text-right">Dans les temps</Th><Th className="text-right">En retard</Th><Th className="text-right">Taux de SAV</Th><Th className="text-right">Devis</Th><Th className="text-right">Devis acceptés</Th><Th className="text-right">Devis → facture</Th><Th className="text-right">Travaux suppl.</Th></Tr>
        </THead>
        <TBody>
          {lignes.map(({ s, t }) => (
            <Tr key={s.conducteur_id ?? "sans"}>
              <Td className="font-medium">{s.nom}</Td>
              <Td className={num}>{formatEuros(s.ht)}</Td>
              <Td className={num}>{s.bons}</Td>
              <Td className={num}>{t.tauxDansLesTemps} % ({t.dansLesTemps})</Td>
              <Td className={num}>{t.tauxRetard} % ({s.en_retard})</Td>
              <Td className={num}>{t.tauxSav} % ({s.sav})</Td>
              <Td className={num}>{s.devis}</Td>
              <Td className={num}>{t.tauxDevisAcceptes} % ({s.devis_acceptes})</Td>
              <Td className={num}>{t.tauxDevisTransformes} % ({s.devis_transformes})</Td>
              <Td className={num}>{t.tauxTravaux} % ({s.travaux})<br /><span className="text-xs text-muted-foreground">{formatEuros(s.travaux_ht)}</span></Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

/** Par métier : un bon compte dans chacun de ses métiers ; son chiffre d'affaires, seulement s'il n'en a qu'un. */
export function StatsMetiers({ bornes, jour }: { bornes: Bornes; jour: string }) {
  const q = useParMetier(bornes, jour);
  if (q.isPending) return <Chargement />;
  if (q.isError) return <Erreur erreur={q.error} reessayer={() => void q.refetch()} />;
  if (!q.data.length) return <Vide message="Aucun bon de commande ni facture sur cette période." />;
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <BarresRepartition titre="Chiffre d'affaires par métier" lignes={repartition(q.data).map(({ ligne, part }) => ({ libelle: ligne.metier, ht: ligne.ht, part }))} />
      </Card>
      <Table>
        <caption className="mb-2 text-left text-xs text-muted-foreground">Le chiffre d'affaires d'un bon multi-métiers n'est pas ventilé : il figure sous « Plusieurs métiers ». Une facture sans bon d'origine figure sous « Hors bon de commande ».</caption>
        <THead><Tr><Th>Métier</Th><Th className="text-right">CA HT</Th><Th className="text-right">Bons</Th><Th className="text-right">SAV</Th><Th className="text-right">En retard</Th></Tr></THead>
        <TBody>
          {q.data.map((m) => (
            <Tr key={m.metier}>
              <Td className="font-medium">{m.metier}</Td>
              <Td className={num}>{formatEuros(m.ht)}</Td>
              <Td className={num}>{m.bons}</Td>
              <Td className={num}>{pourcentage(m.sav, m.bons)} % ({m.sav})</Td>
              <Td className={num}>{pourcentage(m.en_retard, m.bons)} % ({m.en_retard})</Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

/** Par client : chiffre d'affaires, restant dû, devis — le dossier de règlements à un clic. */
export function StatsClients({ bornes }: { bornes: Bornes }) {
  const q = useParClient(bornes, null);
  if (q.isPending) return <Chargement />;
  if (q.isError) return <Erreur erreur={q.error} reessayer={() => void q.refetch()} />;
  if (!q.data.length) return <Vide message="Aucune facture ni aucun devis sur cette période." />;
  return (
    <Table>
      <caption className="mb-2 text-left text-xs text-muted-foreground">Restant dû : ce que doivent encore les factures de la période (avoirs non compris).</caption>
      <THead><Tr><Th>Client</Th><Th className="text-right">CA HT</Th><Th className="text-right">Factures</Th><Th className="text-right">Restant dû</Th><Th className="text-right">Devis</Th><Th className="text-right">Devis acceptés</Th></Tr></THead>
      <TBody>
        {q.data.map((c, i) => (
          <Tr key={c.client_id ?? c.client_nom ?? i}>
            <Td className="font-medium"><Link className="underline-offset-4 hover:underline" to={lienClient(c)}>{c.client_nom ?? "Client sans nom"}</Link></Td>
            <Td className={num}>{formatEuros(c.ht)}</Td>
            <Td className={num}>{c.nb_factures}</Td>
            <Td className={num}>{formatEuros(c.du)}</Td>
            <Td className={num}>{c.nb_devis}</Td>
            <Td className={num}>{pourcentage(c.devis_acceptes, c.nb_devis)} % ({c.devis_acceptes})</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}

/** Chiffre d'affaires par équipe et par mois (`renderStatsBinomesHTML`). */
export function StatsEquipes({ bornes }: { bornes: Bornes }) {
  const q = useCaParEquipe(bornes);
  if (q.isPending) return <Chargement />;
  if (q.isError) return <Erreur erreur={q.error} reessayer={() => void q.refetch()} />;
  const t = tableauEquipes(q.data);
  if (!t.equipes.length) return <Vide message="Aucune facture sur cette période." />;
  return (
    <Table>
      <caption className="mb-2 text-left text-xs text-muted-foreground">D'après la date des factures émises, rattachées à l'équipe du bon de commande d'origine.</caption>
      <THead><Tr><Th>Équipe</Th>{t.mois.map((m) => <Th key={m} className="text-right">{libelleMois(m)}</Th>)}<Th className="text-right">Total</Th></Tr></THead>
      <TBody>
        {t.equipes.map((e) => (
          <Tr key={e.nom}>
            <Td className="font-medium">{e.nom}</Td>
            {t.mois.map((m) => <Td key={m} className={num}>{e.parMois.has(m) ? formatEuros(e.parMois.get(m) ?? ZERO) : "—"}</Td>)}
            <Td className={`${num} font-semibold`}>{formatEuros(e.total)}</Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
