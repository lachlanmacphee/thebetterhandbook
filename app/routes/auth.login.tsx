import { redirect } from "react-router";
import { useFetcher } from "react-router";
import { getSession } from "~/modules/auth/session.server";
import { authenticator } from "~/modules/auth/auth.server";
import type { Route } from "../+types/root";

export async function loader({ request }: Route.LoaderArgs) {
  // Check for existing session.
  const session = await getSession(request.headers.get("Cookie"));
  const user = session.get("id");

  // If the user is already authenticated, redirect to home page.
  if (user) return redirect("/");

  return null;
}

export async function action({ request }: Route.ActionArgs) {
  try {
    // Authenticate the user via TOTP (Form submission).
    return await authenticator.authenticate("TOTP", request);
  } catch (error) {
    // The error from TOTP includes the redirect Response with the cookie.
    if (error instanceof Response) {
      return error;
    }

    // For other errors, return with error message.
    return {
      error: "An error occurred during login. Please try again.",
    };
  }
}

export default function Route() {
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle" || fetcher.formData != null;
  const errors = fetcher.data?.error;

  return (
    <div className="w-full max-w-80 relative bottom-8 flex flex-col justify-center gap-6">
      <div className="flex w-full flex-col items-center gap-1">
        <span className="mb-4 h-full text-6xl animate-bounce transition text-center duration-200 hover:-translate-y-1">
          👋
        </span>
        <h1 className="text-center text-2xl font-semibold tracking-tight">
          Welcome back!
        </h1>
        <p className="text-center text-base font-normal text-gray-600">
          Log in or sign in to your account
        </p>
      </div>
      <fetcher.Form method="POST" className="space-y-2">
        {errors && <p style={{ color: "red" }}>{errors}</p>}
        <input
          type="email"
          name="email"
          pattern="^[a-zA-Z0-9._%+-]+@student\.monash\.edu$"
          placeholder="Enter your email"
          className="h-10 rounded-lg w-full border-2 border-gray-200 bg-transparent px-4 text-sm font-medium placeholder:text-gray-400"
          required
          disabled={isSubmitting}
        />
        <button
          type="submit"
          className="flex h-9 items-center justify-center font-medium bg-gray-800 text-white w-full rounded-lg"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Sending..." : "Continue with Email"}
        </button>
      </fetcher.Form>
    </div>
  );
}
