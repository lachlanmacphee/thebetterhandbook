import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
} from "react-router";

import "./css/pico.min.css";

import { useState } from "react";
import { getSession } from "~/modules/auth/session.server";
import type { Route } from "./+types/root";
import db from "./modules/db/db.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "The Better Handbook" },
    {
      name: "description",
      content:
        "An independent site designed to help Monash University students make informed decisions about their unit selections.",
    },
  ];
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get("id");
  const role = session.get("role");

  const universities = await db.university.findMany({
    orderBy: { name: "asc" },
  });

  const preferredUniversityId =
    session.get("preferredUniversityId") || universities[0].id;

  return { user: userId, role, universities, preferredUniversityId };
}

export async function action({ request }: Route.ActionArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get("id");
  const formData = await request.formData();
  const universityId = formData.get("universityId");

  if (userId && universityId) {
    await db.user.update({
      where: { id: userId },
      data: { preferredUniversityId: parseInt(universityId as string) },
    });
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useLoaderData<typeof loader>();
  const user = data?.user;
  const role = data?.role;
  const universities = data?.universities || [];
  const location = useLocation();

  const [selectedUniversityId, setSelectedUniversityId] = useState<
    number | null
  >(data?.preferredUniversityId);

  const selectedUniversity = universities.find(
    (u) => u.id === selectedUniversityId
  );

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <Meta />
        <Links />
      </head>
      <body
        style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
      >
        <header className="container">
          <nav>
            <ul>
              <li>
                <Link to="/">The Better Handbook</Link>
              </li>
            </ul>
            <ul>
              {universities.length > 1 && (
                <li>
                  <select name="university" aria-label="Select">
                    <option
                      selected
                      disabled
                      value={selectedUniversity?.name || ""}
                    >
                      {selectedUniversity?.name || "Select University"}
                    </option>
                    {universities.map((uni) => (
                      <option
                        key={uni.id}
                        onClick={() => setSelectedUniversityId(uni.id)}
                      >
                        {uni.name}
                      </option>
                    ))}
                  </select>
                  <details className="dropdown">
                    <summary role="button" className="secondary"></summary>
                    <ul></ul>
                  </details>
                </li>
              )}
              {user && role == "ADMIN" && (
                <li>
                  <Link to="/admin">Admin</Link>
                </li>
              )}
              {user && (
                <li>
                  <Link to="/profile">Profile</Link>
                </li>
              )}
              {user && (
                <li>
                  <Link to="/auth/logout">Sign Out</Link>
                </li>
              )}
              {!user && location.pathname !== "/auth/login" && (
                <li>
                  <Link to="/auth/login">Sign In</Link>
                </li>
              )}
            </ul>
          </nav>
        </header>
        <main className="container" style={{ flex: 1 }}>
          {children}
        </main>
        <footer className="container">
          <small>
            &copy; {new Date().getFullYear()} The Better Handbook
            {" • "}
            <Link to="/about">About</Link>
            {" • "}
            <a
              href="https://github.com/lachlanmacphee/thebetterhandbook"
              target="_blank"
              rel="noopener noreferrer"
            >
              Source Code
            </a>
          </small>
        </footer>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="container">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre>
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
