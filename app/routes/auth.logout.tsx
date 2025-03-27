import { sessionStorage } from "~/modules/auth/session.server";
import { redirect } from "react-router";
import type { Route } from "../+types/root";

export async function loader({ request }: Route.LoaderArgs) {
  // Get the session.
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );

  // Destroy the session and redirect to login.
  return redirect("/auth/login", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}
