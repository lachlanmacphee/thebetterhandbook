import { redirect } from "react-router";
import { useFetcher, useNavigate } from "react-router";
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
  const navigate = useNavigate();
  const isSubmitting = fetcher.state !== "idle" || fetcher.formData != null;
  const errors = fetcher.data?.error;
  const [emailError, setEmailError] = useState("");

  const handleBack = () => {
    navigate(-1);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const pattern = /^[a-zA-Z0-9._%+-]+@student\.monash\.edu$/;

    if (!pattern.test(email)) {
      setEmailError(
        "Please use your Monash student email (abcd0001@student.monash.edu)"
      );
      return;
    }

    setEmailError("");
    fetcher.submit(formData, { method: "POST" });
  };

  return (
    <>
      <h1 className="text-2xl font-semibold mb-2">Sign In</h1>
      <fetcher.Form
        method="POST"
        className="space-y-6"
        onSubmit={handleSubmit}
      >
        <label>
          Email Address
          <input
            type="email"
            name="email"
            placeholder="abcd0001@student.monash.edu"
            required
            autoComplete="email"
            aria-label="Email"
            aria-describedby="email-helper"
            disabled={isSubmitting}
          />
          <small id="email-helper">
            Please use your Monash student email.
          </small>
        </label>
        <div className="grid">
          <button
            type="button"
            onClick={handleBack}
            className="secondary"
            aria-label="Go back"
          >
            Go back
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending..." : "Continue"}
          </button>
        </div>
      </fetcher.Form>
    </>
  );
}
