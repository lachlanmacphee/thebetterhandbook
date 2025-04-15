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
    <div className="card bg-base-100 shadow-md hover:shadow-xl transition-all duration-300 rounded-xl overflow-hidden">
      <div className="card-body p-6">
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold">
                {type === "deprecation" && "Deprecation Request"}
                {type === "suggestion" && "Change Suggestion"}
                {type === "addition" && "Unit Addition Request"}
              </h3>
              <p className="text-sm text-base-content/70">
                by {data.user.name || "Anonymous"} on{" "}
                {new Date(data.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="badge badge-primary">
              {data.unit?.code || data.code}
            </div>
          </div>

          {type === "deprecation" && (
            <div>
              <h4 className="font-medium mb-1">Reason for deprecation:</h4>
              <p className="text-base-content/80">{data.reason}</p>
            </div>
          )}

          {type === "suggestion" && (
            <div className="space-y-2">
              <div>
                <h4 className="font-medium">Field to change:</h4>
                <p className="text-base-content/80">{data.field}</p>
              </div>
              <div>
                <h4 className="font-medium">Description:</h4>
                <p className="text-base-content/80">{data.reason}</p>
              </div>
            </div>
          )}

          <Form method="post" className="flex gap-2 justify-end">
            <input type="hidden" name="intent" value={`handle-${type}`} />
            <input type="hidden" name="id" value={data.id} />
            <button
              type="submit"
              name="action"
              value="reject"
              className="btn btn-ghost btn-sm"
            >
              Reject
            </button>
            <button
              type="submit"
              name="action"
              value="approve"
              className="btn btn-primary btn-sm"
            >
              Approve
            </button>
          </Form>
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const { deprecationRequests, suggestions, additionRequests } =
    useLoaderData<typeof loader>();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Admin Dashboard</h1>
      {(deprecationRequests.length > 0 ||
        suggestions.length > 0 ||
        additionRequests.length > 0) && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Pending Requests</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
        </div>
      )}

      {deprecationRequests.length === 0 &&
        suggestions.length === 0 &&
        additionRequests.length === 0 && (
          <div className="text-center py-12 text-base-content/70">
            <p className="text-xl">No pending requests</p>
          </div>
        )}
    </div>
  );
}
