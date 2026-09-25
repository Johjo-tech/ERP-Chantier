import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ChampZone } from "@/components/formulaire/Champ";
import { Chargement, Erreur } from "@/components/etats/Etats";
import { EnTetePage } from "@/components/page/EnTetePage";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { messageErreur } from "@/lib/erreurs";
import { SavSansToutesSesPhotos } from "../api/documents";
import { estSav } from "../domain/bon";
import { PHOTOS_SAV_MAX, refusPieceJointe } from "../domain/pieceJointe";
import { savDuBon } from "../domain/sav";
import { useBon, useBons, useCreerSav } from "../hooks/useBons";

/**
 * Créer le SAV d'un bon (BC-13) : « Ce qui ne va pas » et jusqu'à cinq
 * photos ; ni n° de BC ni devis — le SAV prend un numéro de notre série. Un
 * seul SAV par bon : s'il existe, on l'ouvre.
 */
export function PageCreerSav() {
  const { id } = useParams();
  const navigate = useNavigate();
  const origine = useBon(id);
  const bons = useBons();
  const creer = useCreerSav();
  const [probleme, setProbleme] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [refus, setRefus] = useState<string | null>(null);
  if (origine.isPending || bons.isPending) return <Chargement />;
  if (origine.isError) return <Erreur erreur={origine.error} reessayer={() => void origine.refetch()} />;
  const bon = origine.data;
  const existant = savDuBon(bon.id, bons.data ?? []);
  if (estSav(bon)) return <Alert>Un SAV ne se rattache pas à un autre SAV : ouvrez le bon de commande d'origine.</Alert>;
  if (existant) {
    return (
      <Alert>
        Un SAV a déjà été créé pour ce bon de commande (<Link className="text-primary hover:underline" to={`/commandes/${existant.id}`}>{existant.numero_bc ?? existant.numero_interne}</Link>) : ouvrez-le directement.
      </Alert>
    );
  }

  function choisir(liste: FileList | null) {
    const fichiers = [...(liste ?? [])];
    const motif = fichiers.map((f) => refusPieceJointe({ name: f.name, type: f.type, size: f.size })).find((m) => m !== null) ?? null;
    if (motif) return setRefus(motif);
    if (photos.length + fichiers.length > PHOTOS_SAV_MAX) return setRefus(`${PHOTOS_SAV_MAX} photos au plus.`);
    setRefus(null);
    setPhotos([...photos, ...fichiers]);
  }

  function envoyer() {
    creer.mutate(
      { origine: bon, probleme: probleme.trim() || null, photos },
      {
        onSuccess: (savId) => void navigate(`/commandes/${savId}`, { replace: true, state: { message: "SAV créé." } }),
        // Le SAV existe déjà : on y va, en disant ce qui manque, plutôt que de laisser recréer un doublon.
        onError: (e) => e instanceof SavSansToutesSesPhotos && void navigate(`/commandes/${e.savId}`, { replace: true, state: { message: e.message, alerte: true } }),
      }
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <EnTetePage titre="Créer un SAV" sousTitre={`Depuis le bon ${bon.numero_interne ?? ""} — ${bon.client_nom}`} />
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); envoyer(); }}>
        <ChampZone libelle="Ce qui ne va pas" valeur={probleme} onChange={setProbleme} aide="Le SAV reprend le client, le lieu, le logement, le conducteur et les métiers du bon." />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="photos-sav">Photos ({photos.length}/{PHOTOS_SAV_MAX})</Label>
          <Input id="photos-sav" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={photos.length >= PHOTOS_SAV_MAX} onChange={(e) => choisir(e.target.files)} />
          <ul className="text-sm">{photos.map((p, i) => <li key={`${p.name}-${i}`}>📷 {p.name} <Button variant="link" size="sm" onClick={() => setPhotos(photos.filter((_, j) => j !== i))}>Retirer</Button></li>)}</ul>
        </div>
        {refus && <Alert variant="erreur">{refus}</Alert>}
        {creer.isError && !(creer.error instanceof SavSansToutesSesPhotos) && <Alert variant="erreur">{messageErreur(creer.error)}</Alert>}
        <div className="flex gap-2">
          <Button type="submit" disabled={creer.isPending}>{creer.isPending ? "Création…" : "Créer le SAV"}</Button>
          <Button variant="ghost" asChild><Link to={`/commandes/${bon.id}`}>Annuler</Link></Button>
        </div>
      </form>
    </div>
  );
}
