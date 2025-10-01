import { redirect, useLoaderData } from "react-router";
import { getSession } from "~/modules/auth/session.server";
import db from "~/modules/db/db.server";
import { data, Form } from "react-router";

export async function loader({ request }: any) {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get("id");

  if (!userId) {
    return redirect("/auth/login");
  }

  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (user?.role !== "admin") {
    return redirect("/");
  }

  const [deprecationRequests, suggestions, additionRequests] =
    await Promise.all([
      db.unitDeprecation.findMany({
        where: { status: "pending" },
        include: {
          unit: true,
          user: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      db.unitSuggestion.findMany({
        where: { status: "pending" },
        include: {
          unit: true,
          user: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      db.unitAdditionRequest.findMany({
        include: {
          user: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  return { deprecationRequests, suggestions, additionRequests };
}

export async function action({ request }: any) {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get("id");

  if (!userId) {
    return redirect("/auth/login");
  }

  const user = await db.user.findUnique({
    where: { id: userId },
  });

  if (user?.role !== "admin") {
    return redirect("/");
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "handle-deprecation") {
    const id = parseInt(formData.get("id") as string);
    const action = formData.get("action") as "approve" | "reject";

    const deprecation = await db.unitDeprecation.findUnique({
      where: { id },
      include: { unit: true },
    });

    if (!deprecation) {
      return data({ error: "Deprecation request not found" }, { status: 404 });
    }

    await db.$transaction([
      db.unitDeprecation.update({
        where: { id },
        data: { status: action },
      }),
      ...(action === "approve"
        ? [
          db.unit.update({
            where: { id: deprecation.unitId },
            data: { isDeprecated: true },
          }),
        ]
        : []),
    ]);

    return data({ success: true });
  }

  if (intent === "handle-suggestion") {
    const id = parseInt(formData.get("id") as string);
    const action = formData.get("action") as "approve" | "reject";

    const suggestion = await db.unitSuggestion.findUnique({
      where: { id },
      include: { unit: true },
    });

    if (!suggestion) {
      return data({ error: "Suggestion not found" }, { status: 404 });
    }

    await db.unitSuggestion.update({
      where: { id },
      data: { status: action },
    });

    return data({ success: true });
  }

  if (intent === "handle-addition") {
    const id = parseInt(formData.get("id") as string);
    const action = formData.get("action") as "approve" | "reject";
    const addition = await db.unitAdditionRequest.findUnique({
      where: { id },
    });

    if (!addition) {
      return data({ error: "Addition request not found" }, { status: 404 });
    }

    if (action === "reject") {
      await db.unitAdditionRequest.delete({
        where: { id },
      });
    }

    return data({ success: true });
  }

  return null;
}

function RequestCard({
  type,
  data,
}: {
  type: "deprecation" | "suggestion" | "addition";
  data: any;
}) {
  return (
    <article>
      <header>
        <h3>
          {type === "deprecation" && "Deprecation Request"}
          {type === "suggestion" && "Change Suggestion"}
          {type === "addition" && "Unit Addition Request"}
        </h3>
        <p>
          <small>
            by {data.user.name || "Anonymous"} on{" "}
            {new Date(data.createdAt).toLocaleDateString()}
          </small>
        </p>
        <p><strong>{data.unit?.code || data.code}</strong></p>
      </header>

      {type === "deprecation" && (
        <div>
          <h4>Reason for deprecation:</h4>
          <p>{data.reason}</p>
        </div>
      )}

      {type === "suggestion" && (
        <div>
          <h4>Field to change:</h4>
          <p>{data.field}</p>
          <h4>Description:</h4>
          <p>{data.reason}</p>
        </div>
      )}

      <footer>
        <Form method="post" className="grid">
          <input type="hidden" name="intent" value={`handle-${type}`} />
          <input type="hidden" name="id" value={data.id} />
          <button
            type="submit"
            name="action"
            value="reject"
            className="secondary"
          >
            Reject
          </button>
          <button
            type="submit"
            name="action"
            value="approve"
          >
            Approve
          </button>
        </Form>
      </footer>
    </article>
  );
}

export default function Admin() {
  const { deprecationRequests, suggestions, additionRequests } =
    useLoaderData<typeof loader>();

  return (
    <>
      <h1>Admin Dashboard</h1>
      {(deprecationRequests.length > 0 ||
        suggestions.length > 0 ||
        additionRequests.length > 0) && (
          <>
            <h2>Pending Requests</h2>
            <div className="grid">
              {deprecationRequests.map((request) => (
                <RequestCard key={request.id} type="deprecation" data={request} />
              ))}
              {suggestions.map((suggestion) => (
                <RequestCard
                  key={suggestion.id}
                  type="suggestion"
                  data={suggestion}
                />
              ))}
              {additionRequests.map((request) => (
                <RequestCard key={request.id} type="addition" data={request} />
              ))}
            </div>
          </>
        )}

      {deprecationRequests.length === 0 &&
        suggestions.length === 0 &&
        additionRequests.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem 0" }}>
            <p><em>No pending requests</em></p>
          </div>
        )}
    </>
  );
}
