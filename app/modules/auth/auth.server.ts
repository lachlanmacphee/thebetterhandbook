import { Authenticator } from "remix-auth";
import { TOTPStrategy } from "remix-auth-totp";
import { sessionStorage } from "./session.server";
import { sendEmail } from "./email.server";
import { db } from "~/modules/db/db.server";
import { redirect } from "react-router";
import type { User } from "@prisma/client";

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
        // Safari doesn't support secure cookies on localhost.
        ...(process.env.NODE_ENV === "production" ? { secure: true } : {}),
      },
      sendTOTP: async ({ email, magicLink, code }) => {
        // await sendEmail({
        //   to: email,
        //   subject: "Magic Link",
        //   html: `
        //     <p>Click this <a href="${magicLink}">magic link</a> to log in.</p>
        //   `,
        // });

        // Development Only.
        console.log({
          email,
          code,
          magicLink,
        });
      },
    },
    async ({ email, request }) => {
      // Get user from database.
      let user = await db.user.findFirst({
        where: { email },
      });

      // Create a new user if it doesn't exist.
      if (!user) {
        user = await db.user.create({
          data: { email },
        });
      }

      // Store user in session.
      const session = await sessionStorage.getSession(
        request.headers.get("Cookie")
      );
      session.set("user", user);

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
