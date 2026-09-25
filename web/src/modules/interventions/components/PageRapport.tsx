import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { todayISO } from "@/lib/dates";
import { useClients } from "@/modules/clients/hooks/useClients";
import { heureDeParis } from "@/modules/planning/domain/contacts";
import type { RapportComplet } from "../api/rapports";
import { avecLeBon, saisieInitiale, type BonSource, type PhotoEdition } from "../domain/assistant";
import { useBonsLiables, useEnregistrerRapport, useRapport, useTransformer } from "../hooks/useRapports";
import { afficherToast } from "@/lib/toast";
import { AssistantRapport, type ResultatAssistant } from "./AssistantRapport";
import { ListeRapports } from "./PageRapports";

const DUREE_TOAST_DEVIS_MS = 4000;

function photosDe(complet: RapportComplet | undefined): PhotoEdition[] {
  return (complet?.photos ?? []).map((p) => ({ cle: p.id, id: p.id, apercu: p.url ?? "", dataUrl: null, categorie: p.categorie }));
}

function Formulaire({ id, complet, bon }: { id: string | undefined; complet: RapportComplet | undefined; bon: BonSource | null }) {
  const navigate = useNavigate();
  const clients = useClients();
  const enregistrer = useEnregistrerRapport(id);
  const transformer = useTransformer();
  const [erreur, setErreur] = useState<unknown>(null);
  const base = saisieInitiale(todayISO(), heureDeParis(new Date()), complet?.rapport ?? null, complet?.controles, complet?.precisionAutre);
  const initiale = complet ? base : avecLeBon(base, bon);

  const terminer = (r: ResultatAssistant) => {
    const adresseClient = (clients.data ?? []).find((c) => c.id === r.saisie.client_id)?.adresse ?? complet?.rapport.adresse ?? null;
    enregistrer.mutate(
      { saisie: r.saisie, photos: r.photos, signatures: r.signatures, adresseClient },
      {
        onError: setErreur,
        onSuccess: async (rapportId) => {
          if (r.suite === "apercu") return void navigate(`/rapports/${rapportId}/apercu`);
          if (r.suite === "liste") return void navigate("/rapports");
          try {
            const devisId = await transformer.mutateAsync({ type: "devis", rapport: rapportId });
            afficherToast("Rapport enregistré — devis pré-rempli, vérifiez puis enregistrez-le.", "success", DUREE_TOAST_DEVIS_MS);
            void navigate(`/devis/${devisId}`);
          } catch (e) {
            setErreur(e);
          }
        },
      }
    );
  };

  return (
    <AssistantRapport
      initiale={initiale}
      photosInitiales={photosDe(complet)}
      signaturesExistantes={{ client: complet?.signatureClient ?? null, technicien: complet?.signatureTechnicien ?? null }}
      enCours={enregistrer.isPending || transformer.isPending}
      erreur={erreur}
      onEnregistrer={terminer}
      onAnnuler={() => void navigate("/rapports")}
    />
  );
}

/**
 * Créer ou modifier un rapport. `?bon=<id>` le rédige pour un bon (depuis le
 * planning) : client et lieu repris du bon.
 */
export function PageRapport() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const rapport = useRapport(id);
  const bons = useBonsLiables();
  const bonId = params.get("bon");
  const bon = (bonId && bons.data?.find((b) => b.id === bonId)) || null;
  const pret = (!id || rapport.isSuccess) && (!bonId || bons.isSuccess || bons.isError);
  // L'ancien écran ouvrait l'assistant AU-DESSUS de la liste, sous le même titre (`renderInterventions`).
  return (
    <>
      <EnTetePage titre="Rapports / recherche de fuite" />
      <div id="formZoneIntervention">
        {id && rapport.isError && <Erreur erreur={rapport.error} reessayer={() => void rapport.refetch()} />}
        {!pret && !rapport.isError && <Chargement />}
        {pret && <Formulaire key={id ?? bonId ?? "nouveau"} id={id} complet={rapport.data} bon={bon} />}
      </div>
      <ListeRapports />
    </>
  );
}
