import { useState } from "react";
import { useNavigate } from "react-router";
import { ChampChoix } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDateFr } from "@/lib/dates";
import type { ExtractionBC } from "../domain/contrat";
import { versPreRemplissage } from "../domain/prefill";
import { rapprocherClient } from "../domain/rapprochement";

function Champ({ libelle, valeur }: { libelle: string; valeur: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{libelle}</dt>
      <dd className={valeur ? "text-sm" : "text-sm italic text-muted-foreground"}>{valeur ?? "non lu"}</dd>
    </div>
  );
}

/** Ce que la lecture a trouvé, à RELIRE : rien n'est enregistré avant le formulaire du bon. */
export function ResultatLecture({ extraction, clients }: { extraction: ExtractionBC; clients: readonly { id: string; nom: string }[] }) {
  const navigate = useNavigate();
  const r = rapprocherClient(extraction.client, clients.map((c) => c.nom));
  const [clientNom, setClientNom] = useState(r.reconnu ? r.nom : "");
  const clientId = clients.find((c) => c.nom === clientNom)?.id ?? null;
  const e = extraction;

  return (
    <div className="flex flex-col gap-4">
      {e.avertissements.length > 0 && (
        <Alert>
          <p className="font-medium">À vérifier sur le document :</p>
          <ul className="list-disc pl-5">{e.avertissements.map((a) => <li key={a}>{a}</li>)}</ul>
        </Alert>
      )}
      <ChampChoix
        libelle={`Client (lu : « ${e.client ?? "rien"} »)`}
        valeur={clientNom}
        onChange={setClientNom}
        aide={r.reconnu ? "Reconnu dans votre fichier clients." : "Pas de correspondance certaine : choisissez le client."}
        options={[{ valeur: "", libelle: "— Choisir —" }, ...(r.reconnu ? [] : r.suggestions.map((s) => ({ valeur: s, libelle: `${s} (suggestion)` }))), ...clients.map((c) => ({ valeur: c.nom, libelle: c.nom }))]}
      />
      <dl className="grid gap-3 sm:grid-cols-3">
        <Champ libelle="N° de bon (client)" valeur={e.numeroBC} />
        <Champ libelle="Date du bon" valeur={e.dateBC && formatDateFr(e.dateBC)} />
        <Champ libelle="Fin des travaux" valeur={e.dateFinTravaux && formatDateFr(e.dateFinTravaux)} />
        <Champ libelle="Lieu d'intervention" valeur={[e.adresse, e.codePostal, e.ville].filter(Boolean).join(" ") || null} />
        <Champ libelle="Référence chantier" valeur={e.referenceChantier} />
        <Champ libelle="Nature des travaux" valeur={e.natureTravaux} />
      </dl>
      {e.lignes.length > 0 && (
        <Table>
          <THead><Tr><Th>Désignation</Th><Th className="text-right">Qté</Th><Th>Unité</Th></Tr></THead>
          <TBody>
            {e.lignes.map((l, i) => (
              <Tr key={`${i}-${l.designation}`} className={l.type === "chapitre" ? "font-semibold" : ""}>
                <Td>{l.designation}</Td>
                <Td className="text-right">{l.qte ?? "—"}</Td>
                <Td>{l.unite ?? ""}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      <Button className="self-start" onClick={() => void navigate("/commandes/nouveau", { state: { prefill: versPreRemplissage(e, clientId) } })}>
        Préremplir un nouveau bon de commande
      </Button>
    </div>
  );
}
