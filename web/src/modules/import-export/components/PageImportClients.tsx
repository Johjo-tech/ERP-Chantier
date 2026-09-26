import type { ReactNode } from "react";
import { Link } from "react-router";
import { messageErreur } from "@/lib/erreurs";
import { rapportRejetsCsv } from "@/modules/articles/domain/import";
import { telechargerTexte } from "@/modules/articles/components/telechargement";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import { lignesRapportClients } from "../domain/apercu-clients";
import { useApercuClients, useEcrireClients } from "../hooks/useImportExport";
import { ApercuClients } from "./ApercuClients";

/** Les premiers noms d'un échec suffisent à le retrouver ; le rapport CSV les donne tous. */
const NOMS_CITES = 4;

const pluriel = (n: number) => (n > 1 ? "s" : "");

/**
 * Import de clients (CLI-08, IMP-10 à IMP-14), au HTML de l'ancien
 * (`importClientsHTML`) : l'import prend l'écran entier, choisir un fichier,
 * VOIR ce qui sera écrit, puis accepter. Rien n'atteint la base avant le clic
 * final.
 */
export function PageImportClients() {
  const autorise = usePermission("clients", "modifier");
  const apercu = useApercuClients();
  const ecrire = useEcrireClients();
  const retour = (
    <Link className="btn" to="/clients">
      Retour
    </Link>
  );
  const cadre = (contenu: ReactNode) => (
    <>
      <div className="page-head">
        <h1>Importer des clients</h1>
      </div>
      {contenu}
    </>
  );
  if (!autorise) {
    return cadre(
      <div className="form-panel">
        <div role="alert" className="wf-banner alerte">
          L'import crée ET met à jour des fiches : il faut pouvoir modifier les clients.
        </div>
        <div style={{ marginTop: "14px" }}>{retour}</div>
      </div>
    );
  }

  const lecture = apercu.data;
  const rapport = () => lecture && telechargerTexte("import-clients-rapport.csv", `\uFEFF${rapportRejetsCsv(lignesRapportClients(lecture.rapport))}`);
  const erreur = apercu.error ?? ecrire.error;

  if (erreur) {
    return cadre(
      <div className="form-panel">
        <div role="alert" className="wf-banner alerte">
          <b>Import impossible</b> — {messageErreur(erreur)}
        </div>
        <div style={{ marginTop: "14px" }}>{retour}</div>
      </div>
    );
  }
  if (apercu.isPending || ecrire.isPending) {
    return cadre(
      <div className="form-panel">
        <div className="empty" role="status">
          {apercu.variables?.nom ?? "votre fichier"}
          <br />
          <span>{ecrire.isPending ? "Écriture…" : "Traitement…"}</span>
        </div>
      </div>
    );
  }
  if (ecrire.isSuccess) {
    const { crees, misAJour, echecs } = ecrire.data;
    return cadre(
      <div className="form-panel">
        <div role="status" className="wf-banner ok">
          <b>Import terminé</b> — {crees} créé{pluriel(crees)}, {misAJour} mis à jour.
        </div>
        {echecs.length > 0 && (
          <div role="alert" className="wf-banner alerte" style={{ marginTop: "10px" }}>
            <div style={{ fontWeight: 700 }}>{echecs.length} refus</div>
            <ul style={{ margin: 0, paddingLeft: "18px" }}>
              {echecs.map((e, i) => (
                <li key={i}>
                  {e.noms.slice(0, NOMS_CITES).join(", ")}
                  {e.noms.length > NOMS_CITES ? "…" : ""} — {e.motif}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          <button type="button" className="btn" onClick={rapport}>
            📄 Rapport
          </button>
          {retour}
        </div>
      </div>
    );
  }
  if (lecture) {
    return cadre(<ApercuClients nom={lecture.nom} rapport={lecture.rapport} apercu={lecture.apercu} onImporter={() => ecrire.mutate(lecture.apercu)} onRapport={rapport} retour={retour} />);
  }
  return cadre(
    <div className="form-panel">
      <h3>Importer des clients</h3>
      {/* La phrase de l'ancien, sans l'annuaire que l'import n'interroge pas (D-EFA-06). */}
      <p className="card-sub">
        Fichier exporté d'un logiciel de gestion, colonnes séparées par des points-virgules. L'encodage est reconnu tout seul et les colonnes le sont par leur nom — un
        export partiel passe. Chaque SIRET est vérifié par sa clé de contrôle. Rien n'est écrit avant votre accord.
      </p>
      <div style={{ margin: "16px 0" }}>
        <input
          type="file"
          aria-label="Fichier à importer"
          accept=".csv,.txt,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0];
            ecrire.reset();
            if (f) void f.arrayBuffer().then((o) => apercu.mutate({ octets: o, nom: f.name }));
          }}
        />
      </div>
      {retour}
    </div>
  );
}
