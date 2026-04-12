import { useState } from "react";
import { Link, useLoaderData } from "react-router";
import { getSession } from "~/modules/auth/session.server";
import db from "~/modules/db/db.server";

type ApiExample = {
  id: string;
  title: string;
  description: string;
  path: string;
  endpoint: "units" | "universities";
};

const EXAMPLES: ApiExample[] = [
  {
    id: "all-units",
    title: "List Units (Default Pagination)",
    description: "Returns the first page of units sorted by code.",
    path: "/api/units?page=1&pageSize=12",
    endpoint: "units",
  },
  {
    id: "search-by-code",
    title: "Search By Unit Code",
    description: "Find units where the code contains FIT.",
    path: "/api/units?code=FIT&page=1&pageSize=12",
    endpoint: "units",
  },
  {
    id: "sort-by-rating",
    title: "Sort By Highest Rating",
    description:
      "Returns units sorted by average rating with an explicit university filter.",
    path: "/api/units?university=1&sortBy=rating&page=1&pageSize=12",
    endpoint: "units",
  },
  {
    id: "most-reviewed",
    title: "Most Reviewed Units",
    description: "Returns units sorted by total review count.",
    path: "/api/units?sortBy=reviews&page=1&pageSize=12",
    endpoint: "units",
  },
  {
    id: "monash-all-params",
    title: "Monash Example (All Query Params)",
    description:
      "Includes all /api/units query params using Monash University (id 1).",
    path: "/api/units?code=FIT&name=data&faculty=1&level=Undergraduate&creditPoints=6&campus=1&semester=1&university=1&sortBy=name&page=1&pageSize=12",
    endpoint: "units",
  },
  {
    id: "all-universities",
    title: "List Universities",
    description: "Returns supported universities with aggregate counts.",
    path: "/api/universities?page=1&pageSize=10",
    endpoint: "universities",
  },
  {
    id: "search-universities",
    title: "Search Universities By Name",
    description: "Find universities by name and sort by unit count.",
    path: "/api/universities?name=university&sortBy=unitCount&page=1&pageSize=10",
    endpoint: "universities",
  },
];

export async function loader({ request }: any) {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get("id");

  if (!userId) {
    return { user: null, apiKey: null };
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      apiKey: true,
    },
  });

  return {
    user,
    apiKey: user?.apiKey ?? null,
  };
}

export default function ApiDocs() {
  const { user, apiKey } = useLoaderData<typeof loader>();
  const [results, setResults] = useState<Record<string, string>>({});
  const [activeExampleId, setActiveExampleId] = useState<string | null>(null);

  const canRun = Boolean(user && apiKey);

  const runExample = async (example: ApiExample) => {
    if (!apiKey) {
      return;
    }

    setActiveExampleId(example.id);

    try {
      const response = await fetch(example.path, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      const responseText = await response.text();
      let parsedBody: unknown;

      try {
        parsedBody = JSON.parse(responseText);
      } catch {
        parsedBody = { raw: responseText };
      }

      const payload = {
        request: {
          method: "GET",
          path: example.path,
        },
        status: response.status,
        ok: response.ok,
        response: parsedBody,
      };

      setResults((prev) => ({
        ...prev,
        [example.id]: JSON.stringify(payload, null, 2),
      }));
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        [example.id]: JSON.stringify(
          {
            request: {
              method: "GET",
              path: example.path,
            },
            error:
              error instanceof Error
                ? error.message
                : "Request failed unexpectedly",
          },
          null,
          2,
        ),
      }));
    } finally {
      setActiveExampleId(null);
    }
  };

  const authHeaderExample = `Authorization: Bearer ${
    apiKey ?? "tbh_your_api_key_here"
  }`;

  return (
    <>
      <section>
        <h1>API Documentation</h1>
        <p>
          Use the API endpoints below to fetch universities and unit data in
          JSON format.
        </p>
        <pre>
          <code>{`GET /api/universities\nGET /api/units`}</code>
        </pre>
      </section>

      <section>
        <h2>Universities Endpoint</h2>
        <p>
          <strong>GET /api/universities</strong>
          <br />
          Optional query params: <code>name</code>, <code>sortBy</code>(
          <code>name</code> or <code>unitCount</code>), <code>page</code>, and
          <code>pageSize</code> (10, 20, or 50).
        </p>
      </section>

      <section>
        <h2>Units Endpoint</h2>
        <p>
          <strong>GET /api/units</strong>
          <br />
          Optional query params include <code>code</code>, <code>name</code>,
          <code>faculty</code>, <code>level</code>, <code>creditPoints</code>,
          <code>campus</code>, <code>semester</code>, <code>university</code>,
          <code>sortBy</code>, <code>page</code>, and <code>pageSize</code>.
        </p>
      </section>

      <section>
        <h2>Authentication</h2>
        {user ? (
          <>
            <p>
              Signed in as <strong>{user.email}</strong>.
            </p>
            <label>
              Your API Key
              <input
                type="text"
                value={apiKey ?? ""}
                placeholder="No API key found"
                readOnly
                disabled
              />
            </label>
            {!apiKey && (
              <p>
                No API key found. Go to your <Link to="/profile">Profile</Link>{" "}
                page and click <strong>Generate</strong> in the API key section.
              </p>
            )}
          </>
        ) : (
          <p>
            To get an API key: 1. <Link to="/auth/login">Log in</Link>. 2. Go to
            your <Link to="/profile">Profile</Link> page. 3. Click
            <strong> Generate</strong> in the API key section.
          </p>
        )}

        <p>Pass your key in the Authorization header for every request:</p>
        <pre>
          <code>{authHeaderExample}</code>
        </pre>
      </section>

      <section>
        <h2>Example Requests</h2>
        {!canRun && (
          <p>
            Sign in and generate an API key to enable the <strong>Run</strong>{" "}
            buttons.
          </p>
        )}

        {EXAMPLES.map((example) => (
          <article key={example.id}>
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              <div>
                <h3 style={{ marginBottom: "0.25rem" }}>{example.title}</h3>
                <small>{example.description}</small>
                <br />
                <small>
                  Endpoint:{" "}
                  <code>
                    {example.endpoint === "units"
                      ? "/api/units"
                      : "/api/universities"}
                  </code>
                </small>
              </div>
              <button
                type="button"
                onClick={() => runExample(example)}
                disabled={!canRun || activeExampleId === example.id}
              >
                {activeExampleId === example.id ? "Running..." : "Run"}
              </button>
            </header>

            <pre>
              <code>{`GET ${example.path}`}</code>
            </pre>

            {results[example.id] && (
              <pre>
                <code>{results[example.id]}</code>
              </pre>
            )}
          </article>
        ))}
      </section>
    </>
  );
}
