import { redirect, useLoaderData } from "react-router";
import { Cookie } from "@mjackson/headers";
import { useFetcher } from "react-router";
import { useState } from "react";
import { getSession } from "~/modules/auth/session.server";
import { authenticator } from "~/modules/auth/auth.server";
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
  const error = "error" in loaderData ? loaderData.error : null;
  const errors = fetcher.data?.error || error;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex-grow flex items-center justify-center">
      <div className="card bg-base-100 shadow-lg rounded-xl overflow-hidden w-full max-w-md">
        <div className="card-body gap-8 p-6 md:p-8">
          <div className="flex flex-col items-center gap-4">
            <span className="text-6xl animate-bounce transition duration-200 hover:-translate-y-1">
              💌
            </span>
            <div className="text-center">
              <h1 className="text-2xl font-semibold mb-2">Check your email</h1>
              <p className="text-base-content/70">
                {email ? (
                  <>We sent a code to {email}</>
                ) : (
                  <>Check your email for a verification code</>
                )}
              </p>
            </div>
          </div>

          <fetcher.Form method="post" className="space-y-6">
            <input
              minLength={6}
              maxLength={6}
              required
              name="code"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={isSubmitting}
              placeholder="Enter the 6-digit code"
              className="input w-full text-center text-lg tracking-wider"
            />
            <button
              type="submit"
              className="btn btn-primary w-full hover:scale-[1.02] transition-transform duration-200"
              disabled={isSubmitting || value.length !== 6}
            >
              {isSubmitting ? "Verifying..." : "Verify Code"}
            </button>
          </fetcher.Form>

          {errors && (
            <p className="text-sm text-red-500 text-center">{errors}</p>
          )}

          <div className="flex flex-col items-center gap-2">
            <p className="text-base-content/70 text-sm">
              Didn't receive the code?
            </p>
            <fetcher.Form
              method="POST"
              action="/auth/login"
              autoComplete="off"
              className="w-full"
            >
              <button
                type="submit"
                className="w-full text-base-content/70 hover:text-base-content transition-colors duration-200"
              >
                Request a new code
              </button>
            </fetcher.Form>
          </div>
        </div>
      </div>
    </div>
  );
}
