import { useState } from "react";
import { useSearchParams } from "react-router";
import { Chargement, Erreur, Vide } from "@/components/etats/Etats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { todayISO } from "@/lib/dates";
import { conformiteRh, filtrerDossiers, resumeDossier, type FiltreDossiers } from "../domain/conformite";
import { pastilleDocument, TYPES_DOCUMENT_RH } from "../domain/documents";
import { etatVisite } from "../domain/visites";
import { nomComplet } from "../domain/salarie";
import { useDocumentsRh, useSalariesRh, useSeuilsRh, useVisitesRh } from "../hooks/useRh";
import { PastilleRh } from "./communs";
import { SectionDossier } from "./SectionDossier";

const OBLIGATOIRES = TYPES_DOCUMENT_RH.filter((t) => t.obligatoire);
const PASTILLE_VISITE = { inconnue: "manquant", depassee: "expire", bientot: "bientot", aJour: "ok" } as const;

/**
 * Le tableau de conformité (RH-04, RH-09) : une ligne par salarié, une colonne
 * par pièce obligatoire, la colonne 🩺 venant du registre des visites. Il
 * attend les DEUX sources : afficher « manquant » avant la lecture mentirait.
 */
export function OngletDocuments({ salarieOuvert }: { salarieOuvert: string | null }) {
  const salaries = useSalariesRh();
  const documents = useDocumentsRh();
  const visites = useVisitesRh();
  const seuils = useSeuilsRh();
  const [filtre, setFiltre] = useState<FiltreDossiers>("");
  const [, setParams] = useSearchParams();

  if (salaries.isPending || documents.isPending || visites.isPending) return <Chargement libelle="Chargement des dossiers documentaires…" />;
  const erreur = salaries.error ?? documents.error ?? visites.error;
  if (erreur) return <Erreur erreur={erreur} reessayer={() => void Promise.all([salaries.refetch(), documents.refetch(), visites.refetch()])} />;

  const aujourdHui = todayISO();
  const lignes = (salaries.data ?? []).map((s) => {
    const docs = (documents.data ?? []).filter((d) => d.salarieId === s.id);
    return { s, docs, bilan: conformiteRh(docs, s.visiteMedicaleProchaine, aujourdHui, seuils) };
  });
  const liste = filtrerDossiers(lignes, filtre);
  const ouvert = lignes.find((l) => l.s.id === salarieOuvert) ?? null;
  const basculer = (id: string) => setParams(id === salarieOuvert ? { vue: "documents" } : { vue: "documents", salarie: id });
  const filtres: { f: FiltreDossiers; libelle: string }[] = [
    { f: "", libelle: `Tous (${lignes.length})` },
    { f: "incomplets", libelle: `Dossiers incomplets (${lignes.filter((l) => !l.bilan.complet).length})` },
    { f: "expires", libelle: `Documents expirés (${lignes.reduce((n, l) => n + l.bilan.expires.length, 0)})` },
    { f: "bientot", libelle: `Expirent bientôt (${lignes.reduce((n, l) => n + l.bilan.bientot.length, 0)})` },
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Contrat, DPAE, carte BTP, identité, RIB : les pièces que l'inspection du travail peut demander. Les fichiers sont rangés dans un espace privé, cloisonné par société. La colonne 🩺 vient du registre des visites médicales.</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les dossiers">
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
                {OBLIGATOIRES.map((t) => (
                  <Th key={t.code} title={t.libelle}>{t.icone} {t.libelle}</Th>
                ))}
                <Th title="Visite médicale — vient du registre, pas du dossier">🩺 Visite médicale</Th>
                <Th>Autres</Th>
                <Th>Dossier</Th>
                <Th><span className="sr-only">Ouvrir</span></Th>
              </Tr>
            </THead>
            <TBody>
              {liste.length === 0 ? (
                <Tr><Td colSpan={OBLIGATOIRES.length + 5}>Aucun salarié ne correspond à ce filtre.</Td></Tr>
              ) : (
                liste.map(({ s, docs, bilan }) => {
                  const resume = resumeDossier(bilan);
                  return (
                    <Tr key={s.id}>
                      <Td><strong>{nomComplet(s)}</strong>{s.poste && <span className="text-xs text-muted-foreground"> · {s.poste}</span>}</Td>
                      {OBLIGATOIRES.map((t) => (
                        <Td key={t.code} className="text-center"><PastilleRh etat={pastilleDocument(docs, t.code, aujourdHui, seuils.documentLegal)} /></Td>
                      ))}
                      <Td className="text-center"><PastilleRh etat={PASTILLE_VISITE[etatVisite(s.visiteMedicaleProchaine, aujourdHui, seuils.visiteMedicale).etat]} /></Td>
                      <Td>{docs.filter((d) => !OBLIGATOIRES.some((t) => t.code === d.type)).length || "—"}</Td>
                      <Td>{resume ? <Badge variant="danger">{resume}</Badge> : <Badge variant="succes">Complet</Badge>}</Td>
                      <Td><Button size="sm" variant="outline" onClick={() => basculer(s.id)}>{salarieOuvert === s.id ? "Fermer" : "Ouvrir"}</Button></Td>
                    </Tr>
                  );
                })
              )}
            </TBody>
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Légende : ✓ au dossier · ~ expire bientôt · ! expiré · ? sans date de fin · ✕ manquant. La colonne 🩺 se corrige depuis l'onglet Visites médicales.</p>
      {ouvert && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{nomComplet(ouvert.s)} — dossier documentaire</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => basculer(ouvert.s.id)}>Fermer</Button>
          </CardHeader>
          <CardContent>
            <SectionDossier salarieId={ouvert.s.id} documents={ouvert.docs} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
