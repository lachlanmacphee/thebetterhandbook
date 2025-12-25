import { randomBytes } from "crypto";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, redirect, useFetcher, useLoaderData } from "react-router";
import { getSession } from "~/modules/auth/session.server";
import db from "~/modules/db/db.server";

export async function loader({ request }: any) {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get("id");

  if (!userId) {
    return redirect("/auth/login");
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      reviews: {
        include: {
          unit: true,
          reactions: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  return { user };
}

export async function action({ request }: any) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const userId = (await getSession(request.headers.get("Cookie"))).get("id");

  if (!userId) {
    return redirect("/auth/login");
  }

  if (intent === "update-name") {
    try {
      const updatedUser = await db.user.update({
        where: { id: userId },
        data: { name: formData.get("name") as string },
      });
      return { user: updatedUser, message: "Name updated successfully" };
    } catch (error) {
      return { error: "Failed to update name" };
    }
  }

  if (intent === "generate-apikey") {
    try {
      const apiKey = `tbh_${randomBytes(32).toString("hex")}`;
      const updatedUser = await db.user.update({
        where: { id: userId },
        data: { apiKey },
      });

      return {
        user: updatedUser,
        apiKey,
        message: "API key generated successfully",
      };
    } catch (error) {
      return {
        error: `Failed to generate API key`,
      };
    }
  }

  return { error: "Invalid action" };
}

function ReviewCard({ review }: { review: any }) {
  return (
    <article style={{ display: "flex", flexDirection: "column" }}>
      <header>
        <h3>{review.unit.code}</h3>
      </header>
      <h4>{review.title}</h4>
      <p>{review.text}</p>
      <footer style={{ marginTop: "auto" }}>
        <div className="grid">
          <small>
            {new Date(review.createdAt).toLocaleDateString()}
            <br />
            Unit Taken: {review.yearCompleted}
          </small>
          <Link to={`/reviews/${review.id}`} role="button">
            Edit
          </Link>
        </div>
      </footer>
    </article>
  );
}

export default function Profile() {
  const [isEditing, setIsEditing] = useState(false);
  const { user } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const { data, state } = fetcher;

  if (!user) {
    return redirect("/auth/login");
  }

  useEffect(() => {
    if (state === "idle") {
      if (data?.message) {
        setIsEditing(false);
        toast.success(data.message);
      }
      if (data?.error) {
        toast.error(data.error);
      }
    }
  }, [data, state]);

  return (
    <>
      <section>
        <h1>Profile</h1>

        {isEditing ? (
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="update-name" />
            <fieldset role="group">
              <input
                type="text"
                name="name"
                defaultValue={user.name || ""}
                placeholder="Enter your name"
                required
              />
              <button
                type="button"
                className="secondary"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
              <button type="submit">Save</button>
            </fieldset>
          </fetcher.Form>
        ) : (
          <fieldset role="group">
            <input
              type="text"
              value={user.name || "Anonymous"}
              disabled
              readOnly
            />
            <button onClick={() => setIsEditing(true)}>Edit</button>
          </fieldset>
        )}
      </section>

      <section>
        <h2>Your API Key</h2>
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="generate-apikey" />
          <fieldset role="group">
            <input
              type="text"
              name="apiKey"
              value={user.apiKey || ""}
              placeholder="No key found. Please click generate."
              disabled
              readOnly
            />
            <button type="submit" disabled={fetcher.state !== "idle"}>
              {fetcher.state !== "idle"
                ? "Generating..."
                : user.apiKey
                  ? "Regenerate"
                  : "Generate"}
            </button>
          </fieldset>
        </fetcher.Form>
      </section>

      <section>
        <h2>Your Reviews</h2>
        {user.reviews.length > 0 ? (
          <>
            {Array.from(
              { length: Math.ceil(user.reviews.length / 3) },
              (_, rowIndex) => (
                <div key={rowIndex} className="grid">
                  {user.reviews
                    .slice(rowIndex * 3, rowIndex * 3 + 3)
                    .map((review: any) => (
                      <ReviewCard key={review.id} review={review} />
                    ))}
                </div>
              ),
            )}
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "3rem 0" }}>
            <p>
              <em>No reviews yet</em>
            </p>
            <p>
              <Link to="/search" role="button">
                Find Units to Review
              </Link>
            </p>
          </div>
        )}
      </section>
    </>
  );
}
