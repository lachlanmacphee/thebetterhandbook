import { redirect, Link, useLoaderData } from "react-router";
import { getSession } from "~/modules/auth/session.server";
import { useFetcher } from "react-router";
import db from "~/modules/db/db.server";
import { useState, useEffect } from "react";
import ReviewForm from "~/components/ReviewForm";
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
  const intent = formData.get("intent");
  const userId = (await getSession(request.headers.get("Cookie"))).get("id");

  if (!userId) {
    return redirect("/auth/login");
  }

  if (intent === "edit-review") {
    const reviewId = parseInt(formData.get("reviewId") as string);
    const title = formData.get("title");
    const text = formData.get("description");
    const yearCompleted = formData.get("yearCompleted");
    const overallRating = formData.get("overallRating");
    const teachingRating = formData.get("teachingRating");
    const contentRating = formData.get("contentRating");
    const difficultyRating = formData.get("difficultyRating");
    const workloadRating = formData.get("workloadRating");
    const requiresAttendance = formData.get("attendanceRequired") === "on";
    const isWamBooster = formData.get("isWamBooster") === "on";

    // Validate that the review belongs to the user
    const review = await db.review.findUnique({
      where: { id: reviewId },
    });

    if (!review || review.userId !== userId) {
      return { error: "Review not found" };
    }

    try {
      await db.review.update({
        where: { id: reviewId },
        data: {
          title: title as string,
          text: text as string,
          yearCompleted: parseInt(yearCompleted as string),
          overallRating: parseInt(overallRating as string),
          teachingRating: parseInt(teachingRating as string),
          contentRating: parseInt(contentRating as string),
          difficultyRating: parseInt(difficultyRating as string),
          workloadRating: parseInt(workloadRating as string),
          requiresAttendance,
          isWamBooster,
        },
      });
      return { success: true };
    } catch (error) {
      console.error("Error updating review:", error);
      return { error: "Failed to update review" };
    }
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
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <div className="card bg-base-100 shadow-md hover:shadow-xl transition-all duration-300 rounded-xl overflow-hidden">
        <div className="card-body p-6">
          <ReviewForm
            review={review}
            onCancel={() => setIsEditing(false)}
            isEditing={true}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-100 shadow-md hover:shadow-xl transition-all duration-300 rounded-xl overflow-hidden">
      <div className="card-body p-6">
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4">
                <h3 className="text-xl font-semibold">{review.unit.code}</h3>
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn btn-ghost btn-sm"
                >
                  Edit
                </button>
              </div>
              <Rating rating={review.overallRating} title="" size="sm" />
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
    </div>
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
                  <fieldset className="form-control flex-1">
                    <legend className="sr-only">Display Name</legend>
                    <input
                      type="text"
                      name="name"
                      defaultValue={user.name || ""}
                      className="input flex-1"
                      placeholder="Enter your name"
                      required
                    />
                  </fieldset>
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
