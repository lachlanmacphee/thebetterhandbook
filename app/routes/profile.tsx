import { redirect, useLoaderData, Link } from "react-router";
import { getSession } from "~/modules/auth/session.server";
import { useFetcher } from "react-router";
import db from "~/modules/db/db.server";
import { useState, useEffect } from "react";
import Rating from "~/components/Rating";

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
  const userId = (await getSession(request.headers.get("Cookie"))).get("id");

  if (!userId) {
    return redirect("/auth/login");
  }

  try {
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: { name: formData.get("name") as string },
    });
    return { success: true, user: updatedUser };
  } catch (error) {
    return { success: false, error: "Failed to update name" };
  }
}

function ReviewCard({ review }: { review: any }) {
  const likes = review.reactions?.filter((r: any) => r.isLike).length || 0;
  const dislikes = review.reactions?.filter((r: any) => !r.isLike).length || 0;

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
          <Link to={`/reviews/${review.id}/edit`} role="button">
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

  if (!user) {
    return redirect("/auth/login");
  }

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      setIsEditing(false);
    }
  }, [fetcher.state, fetcher.data]);

  return (
    <>
      <section>
        <h1>Profile</h1>

        {isEditing ? (
          <fetcher.Form method="post">
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
              )
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
