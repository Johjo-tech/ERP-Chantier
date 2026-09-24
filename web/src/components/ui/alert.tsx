import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Props = ComponentProps<"div"> & { variant?: "info" | "erreur" | "succes" };

export function Alert({ className, variant = "info", ...props }: Props) {
  return (
    <div
      role={variant === "erreur" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-4 py-3 text-sm",
        variant === "erreur" && "border-destructive/40 bg-destructive/10 text-destructive",
        variant === "succes" && "border-success/40 bg-success/10",
        variant === "info" && "border-border bg-muted",
        className
      )}
      {...props}
    />
  );
}
