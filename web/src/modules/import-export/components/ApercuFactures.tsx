import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatEuros, montant } from "@/lib/money";
import type { ApercuImportFactures } from "../domain/apercu-factures";
import { CATEGORIES_TAUX_ZERO, DESIGNATION_SANS_LIGNES, type CategorieTva } from "../domain/factures";
import { Chiffre, ListeMotifs } from "./Recapitulatif";

const MAX = { rejets: 8, signalements: 6, collisions: 20 } as const;
const euros = (n: number) => formatEuros(montant(n));

interface Props {
  apercu: ApercuImportFactures;
  avecLignes: boolean;
  categorie: CategorieTva | undefined;
  enCours: boolean;
  onCategorie: (c: CategorieTva | undefined) => void;
  onEcrire: () => void;
  onRapport: () => void;
}

function libelleClient(c: ApercuImportFactures["clients"][number]): string {
  const sort = c.rapprochement === "exact" ? "fiche existante" : c.rapprochement === "prefixe" ? `rapproché de « ${c.versNom} »` : "aucune fiche — elle sera créée";
  return `${c.nom} — ${c.pieces} pièce(s), ${euros(c.ht)} : ${sort}`;
}

/** Les totaux reconstitués passent AVANT tout : c'est le seul chiffre que le comptable saura vérifier. */
export function ApercuFactures({ apercu: a, avecLignes, categorie, enCours, onCategorie, onEcrire, onRapport }: Props) {
  const t = a.totauxAEcrire;
  const tauxZero = a.rejets.some((r) => /0 %/.test(r.motif)) || categorie !== undefined;
  return (
    <section aria-label="Aperçu de la reprise" className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-6">
        <Chiffre valeur={t.pieces} libelle="pièces à écrire" />
        <Chiffre valeur={t.factures} libelle="factures" />
        <Chiffre valeur={t.avoirs} libelle="avoirs" />
        <Chiffre valeur={t.lignes} libelle="lignes" />
        <Chiffre valeur={a.rejets.length} libelle="écartées" alerte={a.rejets.length > 0} />
        <Chiffre valeur={a.collisions.length} libelle="déjà en base" />
      </div>
      <Alert>
        <p className="font-semibold">Totaux reconstitués — à confronter à votre grand livre</p>
        <p>
          <span className="font-medium">{euros(t.ht)}</span> HT net · <span className="font-medium">{euros(t.tva)}</span> TVA · <span className="font-medium">{euros(t.ttc)}</span> TTC net
        </p>
        <p className="text-xs">Les avoirs comptent en négatif. Taux : {t.parTaux.map((x) => `${x.taux} % sur ${x.pieces} pièce(s) (${euros(x.ht)})`).join(" · ")}</p>
        {a.totaux.pieces !== t.pieces && <p className="text-xs">Le fichier porte {a.totaux.pieces} pièces pour {euros(a.totaux.ht)} HT ; l'écart vient des pièces écartées ou déjà présentes.</p>}
      </Alert>
      {!avecLignes && (
        <Alert>
          Sans le détail des lignes : les montants restent exacts, chaque pièce portera un seul poste « {DESIGNATION_SANS_LIGNES} ». Ajoutez le fichier des lignes pour ventiler par compte comptable.
        </Alert>
      )}
      {a.incoherent && (
        <Alert variant="erreur">
          <span className="font-semibold">Le fichier se contredit lui-même</span> — une TVA, un TTC, un signe ou une somme de lignes ne tombe pas juste. Rien ne sera écrit : ces pièces seraient définitives et fausses.
        </Alert>
      )}
      {tauxZero && (
        <Alert variant="erreur">
          <p className="font-semibold">Des pièces sont à 0 % de TVA</p>
          <p className="mb-2">Le fichier ne dit pas pourquoi, et la raison change la facture électronique. Choisissez, ou laissez ces pièces de côté.</p>
          <div role="group" aria-label="Catégorie des pièces à 0 %" className="flex flex-wrap gap-2">
            {(Object.entries(CATEGORIES_TAUX_ZERO) as [CategorieTva, string][]).map(([code, libelle]) => (
              <Button key={code} size="sm" variant={categorie === code ? "default" : "outline"} aria-pressed={categorie === code} onClick={() => onCategorie(code)}>
                {libelle}
              </Button>
            ))}
            {categorie && <Button size="sm" variant="ghost" onClick={() => onCategorie(undefined)}>Les laisser de côté</Button>}
          </div>
        </Alert>
      )}
      <ListeMotifs titre="Clients" lignes={a.clients.map(libelleClient)} max={a.clients.length} />
      <ListeMotifs titre="Déjà en base, non réécrites" lignes={a.collisions} max={MAX.collisions} />
      <ListeMotifs titre="Pièces écartées — l'import reste bloqué tant qu'il en reste" lignes={a.rejets.map((r) => `Ligne ${r.ligne} — ${r.motif}`)} max={MAX.rejets} variant="erreur" />
      <ListeMotifs titre="Décidé à la place du fichier" lignes={a.signalements.map((s) => `${s.code ? `${s.code} — ` : ""}${s.motif}`)} max={MAX.signalements} />
      <div className="flex flex-wrap gap-2">
        <Button disabled={!a.ecriturePossible || enCours} onClick={onEcrire}>
          Écrire {t.pieces} pièce{t.pieces > 1 ? "s" : ""} — définitif
        </Button>
        <Button variant="outline" onClick={onRapport}>Télécharger le rapport</Button>
      </div>
    </section>
  );
}
