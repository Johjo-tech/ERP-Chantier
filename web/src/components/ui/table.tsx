import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}
export function THead(props: ComponentProps<"thead">) {
  return <thead className="border-b border-border bg-muted/50" {...props} />;
}
export function TBody(props: ComponentProps<"tbody">) {
  return <tbody className="[&_tr:last-child]:border-0" {...props} />;
}
export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("border-b border-border hover:bg-muted/40", className)} {...props} />;
}
export function Th({ className, ...props }: ComponentProps<"th">) {
  return <th scope="col" className={cn("h-9 px-3 text-left font-medium text-muted-foreground", className)} {...props} />;
}
export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-3 py-2 align-middle", className)} {...props} />;
}
