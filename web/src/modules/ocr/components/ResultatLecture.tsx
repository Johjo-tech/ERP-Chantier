import { useState } from "react";
import { useNavigate } from "react-router";
import { ChampChoix } from "@/components/formulaire/Champ";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatDateFr, todayISO } from "@/lib/dates";
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

type ClientConnu = { id: string; nom: string };

/**
 * Les options du client, par IDENTIFIANT (relecture 3, M5) : deux homonymes
 * restent deux choix, et une suggestion n'apparaît qu'une fois. Les
 * suggestions viennent en tête, sans doublon dans la liste complète.
 */
function optionsClients(clients: readonly ClientConnu[], suggestions: readonly string[]) {
  const suggeres = clients.filter((c) => suggestions.includes(c.nom));
  const autres = clients.filter((c) => !suggeres.includes(c));
  return [{ valeur: "", libelle: "— Choisir —" }, ...suggeres.map((c) => ({ valeur: c.id, libelle: `${c.nom} (suggestion)` })), ...autres.map((c) => ({ valeur: c.id, libelle: c.nom }))];
}

/** Ce que la lecture a trouvé, à RELIRE : rien n'est enregistré avant le formulaire du bon. */
export function ResultatLecture({ extraction, fichier, clients }: { extraction: ExtractionBC; fichier: File; clients: readonly ClientConnu[] }) {
  const navigate = useNavigate();
  const r = rapprocherClient(extraction.client, clients.map((c) => c.nom));
  // Un nom reconnu désigne la PREMIÈRE fiche de ce nom : l'homonyme reste à un choix de distance.
  const [clientId, setClientId] = useState(r.reconnu ? (clients.find((c) => c.nom === r.nom)?.id ?? "") : "");
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
        valeur={clientId}
        onChange={setClientId}
        aide={r.reconnu ? "Reconnu dans votre fichier clients." : "Pas de correspondance certaine : choisissez le client."}
        options={optionsClients(clients, r.reconnu ? [] : r.suggestions)}
      />
      <dl className="grid gap-3 sm:grid-cols-3">
        <Champ libelle="N° de bon (client)" valeur={e.numeroBC} />
        <Champ libelle="Date du bon" valeur={e.dateBC && formatDateFr(e.dateBC)} />
        <Champ libelle="Fin des travaux" valeur={e.dateFinTravaux && formatDateFr(e.dateFinTravaux)} />
        <Champ libelle="Lieu d'intervention" valeur={[e.adresse, e.codePostal, e.ville].filter(Boolean).join(" ") || null} />
        <Champ libelle="Référence chantier" valeur={e.referenceChantier} />
        <Champ libelle="Nature des travaux" valeur={e.natureTravaux} />
        <Champ libelle="Interlocuteur" valeur={e.interlocuteur} />
        <Champ libelle="Logement" valeur={[e.logementStatut, e.numeroLogement && `n° ${e.numeroLogement}`, e.etage && `étage ${e.etage}`, e.occupant].filter(Boolean).join(" · ") || null} />
        <Champ libelle="Adresse de facturation" valeur={[e.facturationAdresse, e.facturationCodePostal, e.facturationVille].filter(Boolean).join(" ") || null} />
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
      <Button className="self-start" onClick={() => void navigate("/commandes/nouveau", { state: { prefill: versPreRemplissage(e, clientId || null, todayISO()), fichier } })}>
        Préremplir un nouveau bon de commande
      </Button>
    </div>
  );
}
