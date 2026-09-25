import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { libelleEncodage } from "@/modules/articles/domain/import";
import { CADRES_FACTURATION } from "@/modules/clients/domain/client";
import type { ApercuImportClients } from "../domain/apercu-clients";
import type { RapportImportClients } from "../domain/clients";
import { Chiffre, ListeMotifs } from "./Recapitulatif";

const MAX = { rejets: 8, signalements: 6, noms: 6 } as const;

interface Props {
  nom: string;
  rapport: RapportImportClients;
  apercu: ApercuImportClients;
  enCours: boolean;
  onImporter: () => void;
  onRapport: () => void;
}

/** Ce que l'import va faire, avant le clic : créations, mises à jour, écarts, types déduits (IMP-13). */
export function ApercuClients({ nom, rapport, apercu, enCours, onImporter, onRapport }: Props) {
  const total = apercu.aCreer + apercu.aMettreAJour;
  const cadres = CADRES_FACTURATION.filter((c) => apercu.cadres[c.code]);
  return (
    <section aria-label={`Aperçu de ${nom}`} className="flex flex-col gap-4">
      <p className="text-sm">
        <span className="font-medium">{nom}</span> — encodage constaté : <span className="font-medium">{libelleEncodage(rapport.encodage)}</span>
      </p>
      <div className="flex flex-wrap gap-6">
        <Chiffre valeur={apercu.aCreer} libelle="à créer" />
        <Chiffre valeur={apercu.aMettreAJour} libelle="à mettre à jour" />
        <Chiffre valeur={rapport.rejets.length} libelle="rejeté(s)" alerte={rapport.rejets.length > 0} />
        <Chiffre valeur={apercu.ambigus.length} libelle="ambigu(s)" alerte={apercu.ambigus.length > 0} />
        <Chiffre valeur={rapport.signalements.length} libelle="signalé(s)" />
      </div>
      <p className="text-sm text-muted-foreground">
        L'annuaire des entreprises n'est pas interrogé : les fiches sont écrites telles que le fichier les décrit. Une mise à jour ne
        remplace que ce que le fichier renseigne, et ne change pas le type d'un client existant.
      </p>
      {cadres.length > 0 && (
        <Alert>
          <p className="font-semibold">Types des nouveaux clients</p>
          <ul className="list-disc pl-5">
            {cadres.map((c) => {
              const seau = apercu.cadres[c.code];
              return (
                <li key={c.code}>
                  <span className="font-medium">{seau?.compte}</span> {c.libelle} — {seau?.noms.slice(0, MAX.noms).join(", ")}
                  {(seau?.noms.length ?? 0) > MAX.noms ? "…" : ""}
                </li>
              );
            })}
          </ul>
          <p className="mt-1 text-xs">Un acheteur public se reconnaît à l'annuaire : vérifiez-en le type dans sa fiche.</p>
        </Alert>
      )}
      <ListeMotifs
        titre="Laissés de côté — plusieurs clients portent déjà ce nom"
        lignes={apercu.ambigus.map((a) => `${a.nom} — déjà : ${a.homonymes.join(", ")}`)}
        max={apercu.ambigus.length}
        variant="erreur"
      />
      <ListeMotifs titre="Lignes écartées" lignes={rapport.rejets.map((r) => `Ligne ${r.ligne} — ${r.motif}`)} max={MAX.rejets} variant="erreur" />
      <ListeMotifs
        titre="Décidé à la place du fichier"
        lignes={rapport.signalements.map((s) => `Ligne ${s.ligne}${s.code ? ` (${s.code})` : ""} — ${s.motif}`)}
        max={MAX.signalements}
      />
      <div className="flex flex-wrap gap-2">
        <Button disabled={!total || enCours} onClick={onImporter}>
          {enCours ? "Écriture…" : `Importer ${total} client${total > 1 ? "s" : ""}`}
        </Button>
        <Button variant="outline" onClick={onRapport}>Télécharger le rapport</Button>
      </div>
    </section>
  );
}
