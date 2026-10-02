import type { ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useDroitsRh, useEquipes } from "../hooks/useRh";
import { ListeSalaries } from "./ListeSalaries";
import { OngletDocuments } from "./OngletDocuments";
import { OngletEquipes } from "./OngletEquipes";
import { OngletVisites } from "./OngletVisites";

export type VueRh = "salaries" | "documents" | "visites" | "equipes";

/**
 * La barre des rubriques RH (`renderRH`, app.js l. 15453) : `.plus-subnav`
 * centrée, AU-DESSUS de l'en-tête de chaque rubrique. Dossiers et visites
 * n'existent que pour qui tient les dossiers (`rh / modifier`, D-RH-07) :
 * leurs tables le refusent aux autres.
 */
export function CadreRh({ vue, children }: { vue: VueRh; children: ReactNode }) {
  const navigate = useNavigate();
  const droits = useDroitsRh();
  const equipes = useEquipes();
  const n = equipes.data?.length ?? 0;
  const onglets: { vue: VueRh; libelle: string; visible: boolean }[] = [
    { vue: "salaries", libelle: "Salariés", visible: true },
    { vue: "documents", libelle: "Documents", visible: droits.sensible },
    { vue: "visites", libelle: "Visites médicales", visible: droits.sensible },
    { vue: "equipes", libelle: `Équipes ${n ? `(${n})` : ""}`, visible: true },
  ];
  return (
    <>
      <nav aria-label="Rubriques RH" className="plus-subnav" style={{ justifyContent: "center" }}>
        {onglets
          .filter((o) => o.visible)
          .map((o) => (
            <button
              key={o.vue}
              type="button"
              className={`plus-subnav-btn ${o.vue === vue ? "active" : ""}`}
              aria-current={o.vue === vue ? "page" : undefined}
              onClick={() => void navigate(o.vue === "salaries" ? "/rh" : `/rh?vue=${o.vue}`)}
            >
              {o.libelle}
            </button>
          ))}
      </nav>
      {children}
    </>
  );
}

/**
 * L'onglet RH (RH-01 à RH-11). Les sous-traitants ne sont plus ici : l'ancien
 * écran les range dans Réglages › Intervenants (D-ECR-PAR-05) — une adresse
 * `?vue=sous-traitants` gardée d'avant retombe sur les salariés.
 */
export function PageRh() {
  const [params] = useSearchParams();
  const droits = useDroitsRh();
  const demandee = params.get("vue");
  const vue: VueRh = demandee === "equipes" || ((demandee === "documents" || demandee === "visites") && droits.sensible) ? demandee : "salaries";

  return (
    <CadreRh vue={vue}>
      {vue === "salaries" && <ListeSalaries />}
      {vue === "documents" && <OngletDocuments salarieOuvert={params.get("salarie")} />}
      {vue === "visites" && <OngletVisites />}
      {vue === "equipes" && <OngletEquipes />}
    </CadreRh>
  );
}
