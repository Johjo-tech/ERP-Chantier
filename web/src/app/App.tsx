import { RouterProvider } from "react-router";
import { Providers } from "./providers";
import { routeur } from "./routes";

export function App() {
  return (
    <Providers>
      <RouterProvider router={routeur} />
    </Providers>
  );
}
