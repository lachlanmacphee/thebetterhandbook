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
    const requiresAttendance = formData.get("attendanceRequired") === "true";
    const isWamBooster = formData.get("isWamBooster") === "true";

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
  const fetcher = useFetcher();

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      setIsEditing(false);
    }
  }, [fetcher.state, fetcher.data]);

  if (isEditing) {
    return (
      <div className="card bg-base-100 shadow-md hover:shadow-xl transition-all duration-300 rounded-xl overflow-hidden">
        <div className="card-body p-6">
          <fetcher.Form method="post" className="space-y-8">
            <input type="hidden" name="intent" value="edit-review" />
            <input type="hidden" name="reviewId" value={review.id} />

            <div className="space-y-6">
              <div className="form-control">
                <label className="label mb-1">
                  <span className="label-text text-base font-semibold">
                    Title
                  </span>
                </label>
                <input
                  name="title"
                  type="text"
                  defaultValue={review.title}
                  className="input input-bordered w-full"
                  required
                />
              </div>
              <div className="form-control">
                <label className="label mb-1">
                  <span className="label-text text-base font-semibold">
                    Description
                  </span>
                </label>
                <textarea
                  name="description"
                  defaultValue={review.text}
                  className="textarea textarea-bordered w-full min-h-[160px]"
                  required
                ></textarea>
              </div>
              <div className="form-control">
                <label className="label mb-1">
                  <span className="label-text text-base font-semibold">
                    Year Completed
                  </span>
                </label>
                <input
                  name="yearCompleted"
                  type="number"
                  defaultValue={review.yearCompleted}
                  min="2000"
                  max={new Date().getFullYear()}
                  className="input input-bordered w-full"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div className="space-y-3">
                <label className="block font-semibold">Overall Rating</label>
                <div className="rating rating-lg gap-2">
                  {[...Array(5)].map((_, i) => (
                    <input
                      key={i}
                      type="radio"
                      name="overallRating"
                      value={i + 1}
                      defaultChecked={review.overallRating === i + 1}
                      className="mask mask-star-2"
                      required
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="block font-semibold">Teaching Rating</label>
                <div className="rating rating-lg gap-2">
                  {[...Array(5)].map((_, i) => (
                    <input
                      key={i}
                      type="radio"
                      name="teachingRating"
                      value={i + 1}
                      defaultChecked={review.teachingRating === i + 1}
                      className="mask mask-star-2"
                      required
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="block font-semibold">Content Rating</label>
                <div className="rating rating-lg gap-2">
                  {[...Array(5)].map((_, i) => (
                    <input
                      key={i}
                      type="radio"
                      name="contentRating"
                      value={i + 1}
                      defaultChecked={review.contentRating === i + 1}
                      className="mask mask-star-2"
                      required
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="block font-semibold">Difficulty</label>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {["Very Easy", "Easy", "Medium", "Hard", "Very Hard"].map(
                    (label, i) => (
                      <label
                        key={i}
                        className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors duration-200"
                      >
                        <input
                          type="radio"
                          name="difficultyRating"
                          value={i + 1}
                          defaultChecked={review.difficultyRating === i + 1}
                          className="radio radio-primary radio-sm"
                          required
                        />
                        <span className="text-sm font-medium">{label}</span>
                      </label>
                    )
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <label className="block font-semibold">Workload</label>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {["Very Low", "Low", "Moderate", "High", "Very High"].map(
                    (label, i) => (
                      <label
                        key={i}
                        className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors duration-200"
                      >
                        <input
                          type="radio"
                          name="workloadRating"
                          value={i + 1}
                          defaultChecked={review.workloadRating === i + 1}
                          className="radio radio-primary radio-sm"
                          required
                        />
                        <span className="text-sm font-medium">{label}</span>
                      </label>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <label className="cursor-pointer hover:text-primary transition-colors duration-200">
                <span className="font-semibold mr-3">
                  In Person Attendance Required
                </span>
                <input
                  type="checkbox"
                  name="attendanceRequired"
                  defaultChecked={review.requiresAttendance}
                  className="checkbox checkbox-primary checkbox-sm"
                />
              </label>
              <label className="cursor-pointer hover:text-primary transition-colors duration-200">
                <span className="font-semibold mr-3">WAM Booster</span>
                <input
                  type="checkbox"
                  name="isWamBooster"
                  defaultChecked={review.isWamBooster}
                  className="checkbox checkbox-success checkbox-sm"
                />
              </label>
            </div>

            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Changes
              </button>
            </div>
          </fetcher.Form>
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
