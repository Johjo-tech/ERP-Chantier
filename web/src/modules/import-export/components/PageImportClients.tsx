import { Link } from "react-router";
import { Chargement } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { messageErreur } from "@/lib/erreurs";
import { rapportRejetsCsv } from "@/modules/articles/domain/import";
import { telechargerTexte } from "@/modules/articles/components/telechargement";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { lignesRapportClients } from "../domain/apercu-clients";
import { useApercuClients, useEcrireClients } from "../hooks/useImportExport";
import { ApercuClients } from "./ApercuClients";

/**
 * Import de clients (CLI-08, IMP-10 à IMP-14) : choisir un fichier, VOIR ce
 * qui sera écrit, puis accepter. Rien n'atteint la base avant le clic final.
 */
export function PageImportClients() {
  const autorise = usePermission("clients", "modifier");
  const apercu = useApercuClients();
  const ecrire = useEcrireClients();
  const titre = <EnTetePage titre="Importer des clients" actions={<Button variant="ghost" asChild><Link to="/clients">Retour aux clients</Link></Button>} />;
  if (!autorise) return <>{titre}<Alert variant="erreur">L'import crée ET met à jour des fiches : il faut pouvoir modifier les clients.</Alert></>;

  const lecture = apercu.data;
  const rapport = () => lecture && telechargerTexte("import-clients-rapport.csv", `\uFEFF${rapportRejetsCsv(lignesRapportClients(lecture.rapport))}`);

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      {titre}
      <p className="text-sm text-muted-foreground">
        Fichier exporté d'un logiciel de gestion, colonnes séparées par des points-virgules et reconnues par leur nom — un export partiel
        passe. Chaque SIRET est vérifié par sa clé de contrôle. Rien n'est écrit avant votre accord.
      </p>
      <div>
        <label htmlFor="fichier-clients" className="mb-1 block text-sm font-medium">Fichier à importer</label>
        <input
          id="fichier-clients"
          type="file"
          accept=".csv,.txt,text/csv"
          disabled={apercu.isPending || ecrire.isPending}
          onChange={(e) => {
            const f = e.target.files?.[0];
            ecrire.reset();
            if (f) void f.arrayBuffer().then((o) => apercu.mutate({ octets: o, nom: f.name }));
          }}
        />
      </div>
      {apercu.isPending && <Chargement libelle="Lecture du fichier…" />}
      {apercu.isError && <Alert variant="erreur">Le fichier n'a pas pu être lu : {messageErreur(apercu.error)}</Alert>}
      {lecture && !ecrire.isSuccess && (
        <ApercuClients nom={lecture.nom} rapport={lecture.rapport} apercu={lecture.apercu} enCours={ecrire.isPending} onImporter={() => ecrire.mutate(lecture.apercu)} onRapport={rapport} />
      )}
      {ecrire.isError && <Alert variant="erreur">{messageErreur(ecrire.error)}</Alert>}
      {ecrire.isSuccess && (
        <>
          <Alert variant="succes">
            Import terminé — {ecrire.data.crees} créé(s), {ecrire.data.misAJour} mis à jour.
          </Alert>
          {ecrire.data.echecs.length > 0 && (
            <Alert variant="erreur">
              <p className="font-semibold">{ecrire.data.echecs.length} refus</p>
              <ul className="list-disc pl-5">
                {ecrire.data.echecs.map((e, i) => (
                  <li key={i}>
                    {e.noms.slice(0, 4).join(", ")}
                    {e.noms.length > 4 ? "…" : ""} — {e.motif}
                  </li>
                ))}
              </ul>
            </Alert>
          )}
          <div>
            <Button variant="outline" onClick={rapport}>Télécharger le rapport</Button>
          </div>
        </>
      )}
    </div>
  );
}
