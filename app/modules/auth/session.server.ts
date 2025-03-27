import type { User } from "@prisma/client";
import { createCookieSessionStorage } from "react-router";

export const sessionStorage = createCookieSessionStorage<User>({
  cookie: {
    name: "_auth",
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    secrets: [process.env.SESSION_SECRET!],
    secure: process.env.NODE_ENV === "production",
  },
});

export const { getSession, commitSession, destroySession } = sessionStorage;
