import type { User } from "@prisma/client";
import { redirect } from "react-router";
import { Authenticator } from "remix-auth";
import { TOTPStrategy } from "remix-auth-totp";
import db from "~/modules/db/db.server";
import { sendEmail } from "./email.server";
import { sessionStorage } from "./session.server";

export let authenticator = new Authenticator<User>();

authenticator.use(
  // Secret must be a string with 64 hex characters
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
      sendTOTP: async ({ email, code }: { email: string; code: string }) => {
        if (
          !email.endsWith("@student.monash.edu") &&
          !email.endsWith("@student.unimelb.edu.au") &&
          !email.endsWith("@anu.edu.au") &&
          !email.endsWith("@students.unsw.edu.au") &&
          !email.endsWith("@ad.unsw.edu.au") &&
          !email.endsWith("@uq.edu.au") &&
          !email.endsWith("@student.uq.edu.au") &&
          !email.endsWith("@student.adelaide.edu.au") &&
          !email.endsWith("@uni.sydney.edu.au") &&
          !email.endsWith("@student.uwa.edu.au")
        ) {
          throw new Error("Use your University email to sign up");
        }

        sendEmail({
          to: email,
          subject: "The Better Handbook - Login Code",
          html: `
            <p>Use the code ${code} to sign in.</p>
          `,
        });

        // Development Only.
        if (process.env.NODE_ENV === "development") {
          console.log("Code:", code);
        }
      },
    },
    async ({ email, request }) => {
      if (
        !email.endsWith("@student.monash.edu") &&
        !email.endsWith("@student.unimelb.edu.au") &&
        !email.endsWith("@anu.edu.au") &&
        !email.endsWith("@students.unsw.edu.au") &&
        !email.endsWith("@ad.unsw.edu.au") &&
        !email.endsWith("@uq.edu.au") &&
        !email.endsWith("@student.uq.edu.au") &&
        !email.endsWith("@student.adelaide.edu.au") &&
        !email.endsWith("@uni.sydney.edu.au") &&
        !email.endsWith("@student.uwa.edu.au")
      ) {
        throw new Error("Use your University email to sign up");
      }

      let user = await db.user.findFirst({
        where: { email },
      });

      if (!user) {
        const name = email.split("@")[0];
        user = await db.user.create({
          data: { email, name },
        });
      }

      const session = await sessionStorage.getSession(
        request.headers.get("Cookie"),
      );

      session.set("id", user.id);
      session.set("role", user.role);
      session.set("name", user.name);
      session.set("email", user.email);
      session.set("preferredUniversityId", user.preferredUniversityId);

      const sessionCookie = await sessionStorage.commitSession(session);

      throw redirect("/", {
        headers: {
          "Set-Cookie": sessionCookie,
        },
      });
    },
  ),
);
