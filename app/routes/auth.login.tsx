import { useState } from "react";
import { redirect, useFetcher, useNavigate } from "react-router";
import { authenticator } from "~/modules/auth/auth.server";
import { getSession } from "~/modules/auth/session.server";
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

    if (
      email.endsWith("@student.monash.edu") ||
      email.endsWith("@student.unimelb.edu.au") ||
      email.endsWith("@anu.edu.au") ||
      email.endsWith("@students.unsw.edu.au") ||
      email.endsWith("@ad.unsw.edu.au") ||
      email.endsWith("@uq.edu.au") ||
      email.endsWith("@student.uq.edu.au") ||
      email.endsWith("@student.adelaide.edu.au") ||
      email.endsWith("@uni.sydney.edu.au")
    ) {
      setEmailError("");
      fetcher.submit(formData, { method: "POST" });
      return;
    }

    setEmailError("Please use your student email");
  };

  return (
    <>
      <h1 className="text-2xl font-semibold mb-2">Sign In</h1>
      <fetcher.Form method="POST" className="space-y-6" onSubmit={handleSubmit}>
        <label>
          Email Address
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            aria-label="Email"
            aria-describedby="email-helper"
            aria-invalid={emailError != "" || errors}
            disabled={isSubmitting}
          />
          <small id="email-helper">
            Only student emails are permitted. They must end in either
            @student.monash.edu, @student.unimelb.edu.au, @anu.edu.au,
            @student.unsw.edu.au, @ad.unsw.edu.au, @uq.edu.au,
            @student.uq.edu.au, @student.adelaide.edu.au, or @uni.sydney.edu.au
          </small>
        </label>
        <div role="group">
          <button
            type="button"
            onClick={handleBack}
            className="secondary"
            aria-label="Go back"
          >
            Go back
          </button>
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Continue"}
          </button>
        </div>
      </fetcher.Form>
    </>
  );
}
