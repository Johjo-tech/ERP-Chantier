import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatEuros, montant } from "@/lib/money";
import { montantLigneHt, totauxDocument } from "@/modules/documents/domain/totaux";
import { montantsParMetier } from "../domain/metiers";
import { UNITE_DEFAUT, type LigneDocument, type SaisieTravail } from "../domain/prefacture";

interface Props {
  document: readonly LigneDocument[];
  connus: readonly string[];
  saisies: Readonly<Record<string, SaisieTravail>>;
  erreurs: Readonly<Record<string, string>>;
  onSaisie: (travailId: string, s: SaisieTravail) => void;
  /** Le chiffrage des travaux suit `peut_ecrire()` : la secrétaire les voit sans pouvoir les chiffrer. */
  chiffrageTravaux: boolean;
}

function SaisieDuTravail({ l, saisie, erreur, onSaisie, actif }: { l: LigneDocument & { ajout: { travailId: string } }; saisie: SaisieTravail; erreur?: string | undefined; onSaisie: Props["onSaisie"]; actif: boolean }) {
  const id = l.ajout.travailId;
  const maj = (champ: keyof SaisieTravail, v: string) => onSaisie(id, { ...saisie, [champ]: v });
  return (
    <>
      <Td className="w-32">
        <span className="flex gap-1">
          <Input aria-label={`Quantité de « ${l.designation} »`} className="h-8 w-16 text-right" inputMode="decimal" value={saisie.quantite} disabled={!actif} onChange={(e) => maj("quantite", e.target.value)} />
          <Input aria-label={`Unité de « ${l.designation} »`} className="h-8 w-14" value={saisie.unite} disabled={!actif} onChange={(e) => maj("unite", e.target.value)} />
        </span>
      </Td>
      <Td className="w-28">
        <Input aria-label={`Prix unitaire HT de « ${l.designation} »`} className="h-8 text-right" inputMode="decimal" placeholder="prix" value={saisie.prix} disabled={!actif} onChange={(e) => maj("prix", e.target.value)} aria-invalid={!!erreur} title={erreur} />
      </Td>
    </>
  );
}

/**
 * Le document qui partira en facture (BC-17) : les lignes du bon, et chaque
 * travail constaté dans le chapitre de son métier, surligné. Les travaux se
 * chiffrent ici — quantité, unité, prix — ; les totaux et les sous-totaux par
 * métier (dès deux groupes) suivent la frappe.
 */
export function DocumentPrefacture({ document, connus, saisies, erreurs, onSaisie, chiffrageTravaux }: Props) {
  const t = totauxDocument(document);
  const parMetier = montantsParMetier(document, connus);
  return (
    <section aria-labelledby="titre-document" className="flex flex-col gap-2">
      <h2 id="titre-document" className="text-base font-semibold">Document de facturation</h2>
      <Table aria-label="Document de facturation">
        <THead>
          <Tr>
            <Th>Désignation</Th>
            <Th>Qté / unité</Th>
            <Th className="text-right">PU HT</Th>
            <Th className="text-right">Total HT</Th>
          </Tr>
        </THead>
        <TBody>
          {document.map((l, i) => {
            const cle = l.ajout ? `t-${l.ajout.travailId}` : `l-${l.id ?? i}-${i}`;
            if (l.type !== "ligne") {
              return (
                <Tr key={cle} className={l.type === "chapitre" ? "bg-muted/60 font-semibold" : "italic text-muted-foreground"}>
                  <Td colSpan={4}>{l.designation}</Td>
                </Tr>
              );
            }
            const ajout = l.ajout;
            return (
              <Fragment key={cle}>
                <Tr className={ajout ? "border-l-4 border-l-amber-500 bg-amber-50/40" : undefined}>
                  <Td>
                    {l.designation} {ajout && <Badge variant="alerte">{ajout.badge}</Badge>}
                    {ajout && erreurs[ajout.travailId] && <span className="block text-xs text-destructive">{erreurs[ajout.travailId]}</span>}
                  </Td>
                  {ajout ? (
                    <SaisieDuTravail
                      l={{ ...l, ajout }}
                      saisie={saisies[ajout.travailId] ?? { quantite: String(l.quantite).replace(".", ","), unite: l.unite ?? UNITE_DEFAUT, prix: "" }}
                      erreur={erreurs[ajout.travailId]}
                      onSaisie={onSaisie}
                      actif={chiffrageTravaux}
                    />
                  ) : (
                    <>
                      <Td>{String(l.quantite).replace(".", ",")} {l.unite ?? ""}</Td>
                      <Td className="text-right tabular-nums">{formatEuros(montant(l.prix_unitaire))}</Td>
                    </>
                  )}
                  <Td className="text-right tabular-nums">{formatEuros(montantLigneHt(l))}</Td>
                </Tr>
              </Fragment>
            );
          })}
        </TBody>
      </Table>
      {parMetier.length >= 2 && (
        <dl aria-label="Sous-totaux par métier" className="flex flex-col gap-1 text-sm">
          {parMetier.map((g) => (
            <div key={g.metier ?? "sans"} className="flex justify-between gap-6">
              <dt>{g.metier ?? "Hors métier"} <span className="text-muted-foreground">({g.nbLignes} ligne{g.nbLignes > 1 ? "s" : ""})</span></dt>
              <dd className="tabular-nums">{formatEuros(g.montantHt)}</dd>
            </div>
          ))}
        </dl>
      )}
      <dl aria-label="Totaux de la pré-facture" className="ml-auto flex w-72 flex-col gap-1 text-sm">
        <div className="flex justify-between"><dt>Total HT</dt><dd className="tabular-nums">{formatEuros(t.ht)}</dd></div>
        <div className="flex justify-between"><dt>TVA</dt><dd className="tabular-nums">{formatEuros(t.tva)}</dd></div>
        <div className="flex justify-between font-semibold"><dt>Total TTC</dt><dd className="tabular-nums">{formatEuros(t.ttc)}</dd></div>
      </dl>
    </section>
  );
}
