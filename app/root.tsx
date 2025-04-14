import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { LogOutIcon, UserIcon, UserCircleIcon } from "lucide-react";
import { getSession } from "~/modules/auth/session.server";

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
  const user = session.get("id");
  return { user };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useLoaderData<typeof loader>();

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen flex flex-col bg-base-100">
        <header>
          <div className="max-w-4xl mx-auto px-4">
            <nav className="flex h-[80px] justify-between items-center w-full">
              <Link
                to="/"
                className="flex items-center gap-2 text-lg font-semibold hover:text-base-content/70 transition-colors duration-200"
              >
                The Better Handbook
              </Link>
              <div className="flex gap-2">
                {user ? (
                  <>
                    <Link to="/profile" className="btn btn-secondary btn-sm">
                      <UserCircleIcon className="w-4 h-4" />
                      <span className="ml-2">Profile</span>
                    </Link>
                    <Link to="/auth/logout" className="btn btn-primary btn-sm">
                      <LogOutIcon className="w-4 h-4" />
                      <span className="ml-2">Sign Out</span>
                    </Link>
                  </>
                ) : (
                  <Link to="/auth/login" className="btn btn-primary btn-sm">
                    <UserIcon className="w-4 h-4" />
                    <span className="ml-2">Sign In</span>
                  </Link>
                )}
              </div>
            </nav>
          </div>
        </header>
        <main className="flex-grow flex">{children}</main>
        <footer>
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex h-[80px] items-center justify-center gap-4">
              <Link
                to="/about"
                className="text-sm text-base-content/70 hover:text-base-content transition-colors duration-200"
              >
                About
              </Link>
              <span className="text-base-content/70">•</span>
              <p className="text-sm text-base-content/70">
                &copy; {new Date().getFullYear()} The Better Handbook
              </p>
              <span className="text-base-content/70">•</span>
              <a
                href="https://github.com/lachlanmacphee/thebetterhandbook"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-base-content/70 hover:text-base-content transition-colors duration-200"
              >
                Source Code
              </a>
            </div>
          </div>
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
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
