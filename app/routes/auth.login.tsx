import { redirect } from "react-router";
import { useFetcher } from "react-router";
import { getSession } from "~/modules/auth/session.server";
import { authenticator } from "~/modules/auth/auth.server";
import type { Route } from "../+types/root";
import { useState } from "react";

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
  const [emailError, setEmailError] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const pattern = /^[a-zA-Z0-9._%+-]+@student\.monash\.edu$/;

    if (!pattern.test(email)) {
      setEmailError(
        "Please use your Monash student email (example@student.monash.edu)"
      );
      return;
    }

    setEmailError("");
    fetcher.submit(formData, { method: "POST" });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex-grow flex items-center justify-center">
      <div className="card bg-base-100 shadow-lg rounded-xl overflow-hidden w-full max-w-md">
        <div className="card-body gap-8 p-6 md:p-8">
          <div className="flex flex-col items-center gap-4">
            <span className="text-6xl animate-bounce transition duration-200 hover:-translate-y-1">
              👋
            </span>
            <div className="text-center">
              <h1 className="text-2xl font-semibold mb-2">Welcome back!</h1>
              <p className="text-base-content/70">
                Sign in with your Monash email
              </p>
            </div>
          </div>

          <fetcher.Form
            method="POST"
            className="space-y-6"
            onSubmit={handleSubmit}
          >
            {errors && <p className="text-red-500 text-center">{errors}</p>}
            <div className="space-y-2">
              <input
                type="email"
                name="email"
                placeholder="Enter your Monash student email"
                className={`input w-full ${emailError ? "border-red-400" : ""}`}
                required
                disabled={isSubmitting}
              />
              {emailError && (
                <p className="text-sm text-red-500">{emailError}</p>
              )}
            </div>
            <button
              type="submit"
              className="btn btn-primary w-full hover:scale-[1.02] transition-transform duration-200"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Continue"}
            </button>
          </fetcher.Form>
        </div>
      </div>
    </div>
  );
}
