import type { User } from "@prisma/client";
import { redirect } from "react-router";
import { Authenticator } from "remix-auth";
import { TOTPStrategy } from "remix-auth-totp";
import db from "~/modules/db/db.server";
import { sendEmail } from "./email.server";
import { sessionStorage } from "./session.server";

export let authenticator = new Authenticator<User>();

authenticator.use(
  new TOTPStrategy(
    {
      secret: process.env.ENCRYPTION_SECRET!,
      totpGeneration: {
        digits: 6,
        charSet: "0123456789",
        period: 300,
        algorithm: "SHA-256",
      },
      emailSentRedirect: "/auth/verify",
      magicLinkPath: "/auth/verify",
      successRedirect: "/",
      failureRedirect: "/auth/verify",
      cookieOptions: {
        secure: true,
        httpOnly: true,
        sameSite: "Lax",
      },
      sendTOTP: async ({ email, magicLink, code }) => {
        // Raise an error if the email is not a Monash student email.
        if (!email.endsWith("@student.monash.edu")) {
          throw new Error(
            "Only Monash student email addresses are allowed to sign up"
          );
        }

        sendEmail({
          to: email,
          subject: "Magic Link",
          html: `
            <p>Click this <a href="${magicLink}">magic link</a> to log in. If that doesn't work, use the code ${code} to sign in.</p>
          `,
        });

        // Development Only.
        if (process.env.NODE_ENV === "development") {
          console.log("Code:", code);
        }
      },
    },
    async ({ email, request }) => {
      // Validate email domain
      if (!email.endsWith("@student.monash.edu")) {
        throw new Error(
          "Only Monash student email addresses are allowed to sign up"
        );
      }

      // Get user from database.
      let user = await db.user.findFirst({
        where: { email },
      });

      // Create a new user if it doesn't exist.
      if (!user) {
        const name = email.split("@")[0];
        user = await db.user.create({
          data: { email, name },
        });
      }

      // Store user in session.
      const session = await sessionStorage.getSession(
        request.headers.get("Cookie")
      );

      session.set("id", user.id);
      session.set("role", user.role);
      session.set("name", user.name);
      session.set("email", user.email);
      session.set("preferredUniversityId", user.preferredUniversityId);

      // Commit session.
      const sessionCookie = await sessionStorage.commitSession(session);

      // Redirect to your authenticated route.
      throw redirect("/", {
        headers: {
          "Set-Cookie": sessionCookie,
        },
      });
    }
  )
);
