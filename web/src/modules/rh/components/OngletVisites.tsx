import { useState } from "react";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDateFr, todayISO } from "@/lib/dates";
import { nomComplet } from "../domain/salarie";
import { avisAptitude, etatVisite, trierVisites, typeVisite, type EtatVisite } from "../domain/visites";
import { useSalariesRh, useSeuilsRh, useVisitesRh } from "../hooks/useRh";
import { EcheanceVisite } from "./BadgeVisite";
import { PastilleRh } from "./communs";
import { SectionVisites } from "./SectionVisites";

const PASTILLE = { inconnue: "manquant", depassee: "expire", bientot: "bientot", aJour: "ok" } as const;
const COULEUR_AVIS = { ok: "text-success", warn: "text-foreground", danger: "text-destructive" } as const;

/**
 * Le registre des visites médicales de la société (RH-07). L'échéance de la
 * dernière visite pilote l'alerte ; le seuil est celui du médical (Réglages ›
 * RH, 45 j par défaut), pas celui des documents.
 */
export function OngletVisites() {
  const salaries = useSalariesRh();
  const visites = useVisitesRh();
  const seuils = useSeuilsRh();
  const [filtre, setFiltre] = useState<EtatVisite | "">("");
  const [ouvert, setOuvert] = useState<string | null>(null);

  if (salaries.isPending || visites.isPending) return <Chargement libelle="Chargement du registre des visites…" />;
  const erreur = salaries.error ?? visites.error;
  if (erreur) return <Erreur erreur={erreur} reessayer={() => void Promise.all([salaries.refetch(), visites.refetch()])} />;

  const aujourdHui = todayISO();
  const lignes = (salaries.data ?? []).map((s) => ({
    s,
    visites: trierVisites((visites.data ?? []).filter((v) => v.salarieId === s.id)),
    etat: etatVisite(s.visiteMedicaleProchaine, aujourdHui, seuils.visiteMedicale).etat,
  }));
  const compte = (e: EtatVisite) => lignes.filter((l) => l.etat === e).length;
  const liste = filtre ? lignes.filter((l) => l.etat === filtre) : lignes;
  const choisi = lignes.find((l) => l.s.id === ouvert) ?? null;
  const filtres: { f: EtatVisite | ""; libelle: string }[] = [
    { f: "", libelle: `Tous (${lignes.length})` },
    { f: "depassee", libelle: `Échéance dépassée (${compte("depassee")})` },
    { f: "bientot", libelle: `À prévoir (${compte("bientot")})` },
    { f: "inconnue", libelle: `Jamais vus (${compte("inconnue")})` },
    { f: "aJour", libelle: `À jour (${compte("aJour")})` },
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Suivi en santé au travail : embauche, périodique, reprise. L'échéance de la dernière visite pilote l'alerte.</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par état du suivi">
        {filtres.map((x) => (
          <Button key={x.f} size="sm" variant={filtre === x.f ? "default" : "outline"} aria-pressed={filtre === x.f} onClick={() => setFiltre(x.f)}>
            {x.libelle}
          </Button>
        ))}
      </div>
      {lignes.length === 0 ? (
        <Vide message="Aucun salarié pour cette société." />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <Tr>
                <Th>Salarié</Th>
                <Th><span className="sr-only">État</span></Th>
                <Th>Dernière visite</Th>
                <Th>Type</Th>
                <Th>Avis</Th>
                <Th>Prochaine</Th>
                <Th>Historique</Th>
                <Th><span className="sr-only">Ouvrir</span></Th>
              </Tr>
            </THead>
            <TBody>
              {liste.length === 0 ? (
                <Tr><Td colSpan={8}>Aucun salarié ne correspond à ce filtre.</Td></Tr>
              ) : (
                liste.map(({ s, visites: vs, etat }) => {
                  const derniere = vs[0] ?? null;
                  const avis = derniere ? avisAptitude(derniere.avis) : null;
                  return (
                    <Tr key={s.id}>
                      <Td><strong>{nomComplet(s)}</strong>{s.poste && <span className="text-xs text-muted-foreground"> · {s.poste}</span>}</Td>
                      <Td className="text-center"><PastilleRh etat={PASTILLE[etat]} /></Td>
                      <Td>{derniere ? formatDateFr(derniere.dateVisite) : "—"}</Td>
                      <Td>{derniere ? typeVisite(derniere.type).libelle : "—"}</Td>
                      <Td className={avis ? `font-semibold ${COULEUR_AVIS[avis.gravite]}` : ""}>{avis ? avis.libelle : "—"}</Td>
                      <Td><EcheanceVisite prochaine={s.visiteMedicaleProchaine} seuil={seuils.visiteMedicale} /></Td>
                      <Td>{vs.length || "—"}</Td>
                      <Td><Button size="sm" variant="outline" onClick={() => setOuvert(ouvert === s.id ? null : s.id)}>{ouvert === s.id ? "Fermer" : "Ouvrir"}</Button></Td>
                    </Tr>
                  );
                })
              )}
            </TBody>
          </Table>
        </div>
      )}
      {choisi && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{nomComplet(choisi.s)} — suivi médical</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setOuvert(null)}>Fermer</Button>
          </CardHeader>
          <CardContent>
            <SectionVisites salarieId={choisi.s.id} visites={choisi.visites} prochaine={choisi.s.visiteMedicaleProchaine} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
