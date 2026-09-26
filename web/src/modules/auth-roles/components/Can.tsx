import type { ReactNode } from "react";
import type { Action, ModuleId } from "../domain/permissions";
import { usePermission } from "../hooks/useSession";

interface Props {
  module: ModuleId;
  action?: Action;
  children: ReactNode;
  /** Ce qui s'affiche à la place, s'il y a lieu (par défaut : rien). */
  sinon?: ReactNode;
}

/** Masque ce que le rôle effectif ne peut pas faire. N'accorde jamais rien : la RLS juge. */
export function Can({ module, action = "voir", children, sinon = null }: Props) {
  return usePermission(module, action) ? <>{children}</> : <>{sinon}</>;
}
