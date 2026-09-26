import { FRAICHEUR_ORDINAIRE_MS } from "@/lib/durees";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { SessionProvider } from "@/modules/auth-roles/hooks/SessionProvider";

function creerQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: FRAICHEUR_ORDINAIRE_MS,
        // Un refus RLS ou une ligne absente ne se corrige pas en réessayant.
        retry: (echecs, erreur) => {
          const code = (erreur as { code?: string } | null)?.code;
          if (code === "42501" || code === "PGRST116" || code === "PGRST301") return false;
          return echecs < 2;
        },
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(creerQueryClient);
  return (
    <QueryClientProvider client={client}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
