import { redirect, useLoaderData } from "react-router";
import { Cookie } from "@mjackson/headers";
import { Link, useFetcher } from "react-router";
import { useState } from "react";
import { getSession } from "~/modules/auth/session.server";
import { authenticator } from "~/modules/auth/auth.server";
import type { Route } from "../+types/root";

export async function loader({ request }: Route.LoaderArgs) {
  // Check for existing session.
  const session = await getSession(request.headers.get("Cookie"));
  const user = session.get("user");

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

  // const code = "code" in loaderData ? loaderData.code : undefined;
  const email = "email" in loaderData ? loaderData.email : undefined;
  const error = "error" in loaderData ? loaderData.error : null;
  const errors = fetcher.data?.error || error;

  return (
    <div className="w-full max-w-80 relative bottom-8 flex flex-col justify-center gap-6">
      <div className="flex w-full flex-col items-center gap-1">
        <span className="mb-4 h-full text-6xl animate-bounce transition text-center duration-200 hover:-translate-y-1">
          💌
        </span>
        <h1 className="text-center text-2xl font-semibold tracking-tight">
          Check your email
        </h1>
        <p className="text-center text-base font-normal text-gray-600">
          {email ? (
            <>We sent a code at {email}</>
          ) : (
            <>Check your email for a verification code</>
          )}
        </p>
      </div>

      <fetcher.Form method="post" className="space-y-4">
        <input
          minLength={6}
          maxLength={6}
          required
          name="code"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isSubmitting}
          placeholder="Enter the 6-digit code"
          className="h-10 rounded-lg w-full border-2 border-gray-200 bg-transparent px-4 text-sm font-medium placeholder:text-gray-400"
        />
        <button
          type="submit"
          className="flex h-9 items-center justify-center disabled:opacity-50 font-medium bg-gray-800 text-white w-full rounded-lg"
          disabled={isSubmitting || value.length !== 6}
        >
          {isSubmitting ? "Verifying..." : "Verify Code"}
        </button>
      </fetcher.Form>

      {errors && <p className="text-sm text-red-500 text-center">{errors}</p>}

      {/* Request New Code. */}
      {/* Email is already in session, so no input it's required. */}
      <div className="flex flex-col">
        <p className="text-sm text-gray-600 text-center font-normal">
          Didn't receive the code?
        </p>
        <fetcher.Form
          method="POST"
          action="/auth/login"
          autoComplete="off"
          className="flex w-full flex-col gap-2"
        >
          <button
            type="submit"
            className="flex h-8 items-center justify-center font-medium bg-transparent text-gray-800 w-full"
          >
            Request a new code
          </button>
        </fetcher.Form>
      </div>
    </div>
  );
}
