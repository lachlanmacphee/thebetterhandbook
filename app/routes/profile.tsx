import { redirect, Link, useLoaderData } from "react-router";
import { getSession } from "~/modules/auth/session.server";
import { Form, useFetcher } from "react-router";
import db from "~/modules/db/db.server";
import { useState, useEffect } from "react";
import { StarIcon } from "lucide-react";

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
  const name = formData.get("name");
  const userId = (await getSession(request.headers.get("Cookie"))).get("id");

  if (!userId) {
    return redirect("/auth/login");
  }

  try {
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: { name: name as string },
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
    <Link
      to={`/units/${review.unit.code}`}
      className="card bg-base-100 shadow-md hover:shadow-xl transition-all duration-300 rounded-xl overflow-hidden"
    >
      <div className="card-body p-6">
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-semibold">{review.unit.code}</h3>
              <div className="flex gap-1">
                {[...Array(review.overallRating)].map((_, i) => (
                  <StarIcon
                    key={i}
                    className="w-4 h-4 text-yellow-500 fill-current"
                  />
                ))}
              </div>
            </div>
            <p className="text-base-content/70">{review.unit.name}</p>
          </div>
          <div>
            <h4 className="font-medium mb-1">{review.title}</h4>
            <p className="text-sm text-base-content/70 line-clamp-2">
              {review.text}
            </p>
          </div>
          <div className="flex items-center justify-between text-sm text-base-content/60">
            <div className="flex items-center gap-2">
              <span>{new Date(review.createdAt).toLocaleDateString()}</span>
              <span>•</span>
              <span>Completed {review.yearCompleted}</span>
            </div>
            <div className="flex items-center gap-4">
              <span>{likes} likes</span>
              <span>{dislikes} dislikes</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
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
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="space-y-10">
        <div className="card bg-base-100 shadow-lg rounded-xl overflow-hidden">
          <div className="card-body p-6 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              {isEditing ? (
                <fetcher.Form
                  method="post"
                  className="flex items-center gap-4 w-full"
                >
                  <input
                    type="text"
                    name="name"
                    defaultValue={user.name || ""}
                    className="input input-bordered flex-1"
                    placeholder="Enter your name"
                    required
                  />
                  <div className="space-x-2">
                    <button type="submit" className="btn btn-primary btn-sm">
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setIsEditing(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </fetcher.Form>
              ) : (
                <div className="space-y-1">
                  <h1 className="text-3xl font-bold">
                    {user.name || "Anonymous User"}
                  </h1>
                  <p className="text-base-content/70">{user.email}</p>
                </div>
              )}
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn btn-primary btn-sm"
                >
                  Edit Name
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">
              Your Reviews ({user.reviews.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {user.reviews.map((review: any) => (
              <ReviewCard key={review.id} review={review} />
            ))}
            {user.reviews.length === 0 && (
              <div className="col-span-full text-center py-12 text-base-content/70">
                <p className="text-xl mb-4">No reviews yet</p>
                <Link
                  to="/search"
                  className="btn btn-primary hover:scale-105 transition-transform duration-200"
                >
                  Find Units to Review
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
