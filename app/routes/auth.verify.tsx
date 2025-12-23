import { Cookie } from "@mjackson/headers";
import { useState } from "react";
import { redirect, useFetcher, useLoaderData } from "react-router";
import { authenticator } from "~/modules/auth/auth.server";
import { getSession } from "~/modules/auth/session.server";
import type { Route } from "../+types/root";

export async function loader({ request }: Route.LoaderArgs) {
  // Check for existing session.
  const session = await getSession(request.headers.get("Cookie"));
  const user = session.get("id");

  // If the user is already authenticated, redirect to index.
  if (user) return redirect("/");

  // Get the TOTP cookie and the token from the URL.
  const cookie = new Cookie(request.headers.get("Cookie") || "");
  const totpCookie = cookie.get("_totp");

  const url = new URL(request.url);
  const token = url.searchParams.get("t");

  // Authenticate the user via magic-link URL.
  if (token) {
    try {
      return await authenticator.authenticate("TOTP", request);
    } catch (error) {
      if (error instanceof Response) return error;
      if (error instanceof Error) return { error: error.message };
      return { error: "Invalid TOTP" };
    }
  }

  // Get the email from the TOTP cookie.
  let email = null;
  if (totpCookie) {
    const params = new URLSearchParams(totpCookie);
    email = params.get("email");
  }

  // If no email is found, redirect to login.
  if (!email) return redirect("/auth/login");

  return { email };
}

/**
 * Action function that handles the TOTP verification form submission.
 * - Authenticates the user via TOTP (Form submission).
 */
export async function action({ request }: Route.ActionArgs) {
  try {
    return await authenticator.authenticate("TOTP", request);
  } catch (error) {
    if (error instanceof Response) {
      const cookie = new Cookie(error.headers.get("Set-Cookie") || "");
      const totpCookie = cookie.get("_totp");
      if (totpCookie) {
        const params = new URLSearchParams(totpCookie);
        return { error: params.get("error") };
      }

      throw error;
    }
    return { error: "Invalid TOTP" };
  }
}

export default function VerifyPage() {
  const loaderData = useLoaderData<typeof loader>();

  const [value, setValue] = useState("");
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle" || fetcher.formData != null;

  const email = "email" in loaderData ? loaderData.email : undefined;

  return (
    <>
      <h1>Check your email</h1>
      <p>We sent a code to {email}</p>

      <fetcher.Form method="post">
        <label>
          Verification Code
          <input
            minLength={6}
            maxLength={6}
            required
            name="code"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={isSubmitting}
            placeholder="Enter the 6-digit code"
            style={{ textAlign: "center", letterSpacing: "0.1em" }}
          />
        </label>
        <button type="submit" disabled={isSubmitting || value.length !== 6}>
          {isSubmitting ? "Verifying..." : "Verify Code"}
        </button>
      </fetcher.Form>
      <fetcher.Form method="POST" action="/auth/login" autoComplete="off">
        <button type="submit" className="secondary">
          Request a new code
        </button>
      </fetcher.Form>
    </>
  );
}
