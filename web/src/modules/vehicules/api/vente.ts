import { supabase } from "@/lib/supabase";
import { lireClient } from "@/modules/clients/api/clients";
import { creerFacture, emettreFacture, supprimerBrouillon } from "@/modules/facturation/api/factures";
import { conditions } from "@/modules/facturation/api/operations";
import { designationVente, ligneDeVente, type SaisieVente } from "../domain/vente";
import { lireVehicule } from "./vehicules";

export interface ResultatVente {
  factureId: string;
  /** NULL si l'émission a échoué : la facture est restée en brouillon. */
  numero: string | null;
}

/**
 * Vendre un véhicule (VEH-04, D-VEH-06). Trois écritures, dans l'ordre qui ne
 * laisse jamais de double :
 *   1. la facture naît BROUILLON (aucun numéro consommé) ;
 *   2. le véhicule passe « vendu » avec son lien — seulement s'il ne l'était
 *      pas : deux ventes simultanées n'en retiennent qu'une ; sinon le
 *      brouillon est retiré ;
 *   3. la facture est émise (numéro posé par la base). Si cette dernière étape
 *      échoue, le véhicule est vendu et sa facture l'attend en brouillon :
 *      rien n'est à refaire depuis ici, et rien ne peut l'être deux fois.
 */
export async function vendreVehicule(societeId: string, vehiculeId: string, s: SaisieVente): Promise<ResultatVente> {
  const v = await lireVehicule(vehiculeId);
  if (v.vendu) throw { code: "P0001", message: "Ce véhicule est déjà vendu." };
  const client = await lireClient(s.client_id);
  const factureId = await creerFacture(
    societeId,
    {
      client_id: client.id,
      client_nom: client.nom,
      adresse: client.facturation_adresse ?? client.adresse,
      code_postal: client.facturation_adresse ? client.facturation_code_postal : client.code_postal,
      ville: client.facturation_adresse ? client.facturation_ville : client.ville,
      date: s.date,
      remise_pourcentage: 0,
      ...(await conditions(societeId, client.id, s.date)),
    },
    [ligneDeVente(designationVente(v), s.prix, s.tva)]
  );

  const { data, error } = await supabase()
    .from("vehicules")
    .update({ vendu: true, date_vente: s.date, prix_vente: s.prix, facture_vente_id: factureId })
    .eq("id", vehiculeId)
    .eq("vendu", false)
    .select("id");
  if (error || !data?.length) {
    await supprimerBrouillon(factureId).catch((e: unknown) => console.error(`Brouillon de vente ${factureId} resté en base :`, e));
    throw error ?? { code: "P0001", message: "Le véhicule n'a pas pu être marqué vendu (déjà vendu, ou droit manquant) ; aucune facture n'a été émise." };
  }

  try {
    return { factureId, numero: await emettreFacture(factureId) };
  } catch (e) {
    console.error("Émission de la facture de vente :", e);
    return { factureId, numero: null };
  }
}
