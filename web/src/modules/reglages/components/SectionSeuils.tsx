import { useState, type FormEvent } from "react";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { ChampTexte } from "@/components/formulaire/Champ";
import { usePermission } from "@/modules/auth-roles/hooks/useSession";
import {
  appliquerSeuils,
  LIBELLES_SEUILS,
  schemaSeuil,
  SEUILS_PAR_DOMAINE,
  type CleSeuil,
  type DomaineSeuils,
  type ReglagesSociete,
} from "@/modules/societes/domain/reglages-societe";
import { useEnregistrerReglages, useReglagesSociete } from "@/modules/societes/hooks/useSocieteReglages";
import { PiedEnregistrement } from "./champs";

/*
 * Le titre ET la phrase : celle des deux premiers domaines parle d'« alerte dans
 * la cloche », ce qui serait faux pour la conduite — ce seuil ne sonne rien.
 */
const TEXTES: Record<DomaineSeuils, { titre: string; phrase: string }> = {
  rh: { titre: "🧑‍🔧 Seuils d'alerte RH", phrase: "Nombre de jours avant échéance à partir duquel l'alerte apparaît dans la cloche." },
  vehicules: { titre: "🚚 Seuils d'alerte véhicules", phrase: "Nombre de jours avant échéance à partir duquel l'alerte apparaît dans la cloche." },
  conduite: {
    titre: "🦺 Conduite de travaux",
    phrase: "Au-delà de ce délai, un bon reçu et jamais planifié remonte dans « Sans rendez-vous » sur le tableau de bord du conducteur.",
  },
};

/** Seuils d'alerte par domaine (PAR-07). */
export function SectionSeuils({ domaine }: { domaine: DomaineSeuils }) {
  const reglages = useReglagesSociete();
  const enregistrer = useEnregistrerReglages();
  if (reglages.isPending) return <Chargement />;
  if (reglages.isError) return <Erreur erreur={reglages.error} reessayer={() => void reglages.refetch()} />;
  return <FormulaireSeuils key={`${domaine}-${JSON.stringify(reglages.data.seuils)}`} domaine={domaine} reglages={reglages.data} enregistrer={enregistrer} />;
}

function FormulaireSeuils({ domaine, reglages, enregistrer }: { domaine: DomaineSeuils; reglages: ReglagesSociete; enregistrer: ReturnType<typeof useEnregistrerReglages> }) {
  const modifiable = usePermission("reglages", "modifier");
  const cles = SEUILS_PAR_DOMAINE[domaine];
  const [valeurs, setValeurs] = useState<Record<string, string>>(() => Object.fromEntries(cles.map((c) => [c, String(reglages.seuils[c])])));
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  function soumettre(e: FormEvent) {
    e.preventDefault();
    const lus: Partial<Record<CleSeuil, number>> = {};
    const fautes: Record<string, string> = {};
    for (const c of cles) {
      const r = schemaSeuil.safeParse(valeurs[c]);
      if (r.success) lus[c] = r.data;
      else fautes[c] = r.error.issues[0]?.message ?? "Valeur invalide.";
    }
    setErreurs(fautes);
    if (Object.keys(fautes).length === 0) enregistrer.mutate((r) => appliquerSeuils(r, lus));
  }

  return (
    <form className="card" onSubmit={soumettre} noValidate>
      <div className="card-title" style={{ marginBottom: "10px" }}>
        {TEXTES[domaine].titre}
      </div>
      <div className="card-sub" style={{ marginBottom: "14px" }}>
        {TEXTES[domaine].phrase}
      </div>
      <div className="field-grid">
        {cles.map((c) => (
          <ChampTexte
            key={c}
            libelle={LIBELLES_SEUILS[c]}
            type="number"
            valeur={valeurs[c] ?? ""}
            onChange={(v) => setValeurs((x) => ({ ...x, [c]: v }))}
            erreur={erreurs[c]}
            desactive={!modifiable}
          />
        ))}
      </div>
      <PiedEnregistrement modifiable={modifiable} enCours={enregistrer.isPending} erreur={enregistrer.error} succes={enregistrer.isSuccess ? "Préférences enregistrées." : null} />
    </form>
  );
}
