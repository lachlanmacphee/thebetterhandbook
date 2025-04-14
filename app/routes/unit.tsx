import db from "~/modules/db/db.server";
import type { Route } from "./+types/unit";
import {
  StarIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  ArrowLeftIcon,
} from "lucide-react";
import { data, Form, redirect, useFetcher, Link } from "react-router";
import { getSession } from "~/modules/auth/session.server";
import { useState } from "react";

export async function loader({ params, request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = session.get("id");
  const previousPage = new URL(request.url).searchParams.get("from") || "/";

  const unit = await db.unit.findUnique({
    where: {
      code: params.unitCode,
    },
    include: {
      reviews: {
        include: {
          user: true,
          reactions: true,
        },
        orderBy: {
          reactions: {
            _count: "desc",
          },
        },
      },
      campuses: {
        include: {
          campus: true,
        },
      },
      semesters: {
        include: {
          semester: true,
        },
      },
      prerequisites: {
        include: {
          prerequisite: true,
        },
      },
      corequisites: {
        include: {
          corequisite: true,
        },
      },
      isPrerequisiteFor: {
        include: {
          unit: true,
        },
      },
    },
  });

  const existingUnitAdditionRequest = await db.unitAdditionRequest.findFirst({
    where: {
      code: params.unitCode,
    },
  });

  if (!unit) {
    return data({
      unit: null,
      user,
      hasReviewed: false,
      existingUnitAdditionRequest,
      previousPage,
    });
  }

  const hasReviewed =
    (await db.review.findFirst({
      where: {
        unitId: unit.id,
        userId: user,
      },
    })) !== null;

  return {
    unit,
    user,
    hasReviewed,
    existingUnitAdditionRequest,
    previousPage,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  let session = await getSession(request.headers.get("cookie"));
  let userId = session.get("id");
  if (!userId)
    return data(
      { error: "You must be logged in to perform this action" },
      { status: 400 }
    );

  if (intent === "request-unit") {
    try {
      await db.unitAdditionRequest.create({
        data: {
          code: params.unitCode!,
          userId,
        },
      });
      return data({ success: true });
    } catch (error) {
      console.error("Error creating unit request:", error);
      return data({ error: "Failed to submit unit request" }, { status: 500 });
    }
  }

  if (intent === "react-to-review") {
    const reviewId = parseInt(formData.get("reviewId") as string);
    const reaction = formData.get("reaction") as "like" | "dislike";
    const isLike = reaction === "like";

    try {
      const existingReaction = await db.reviewReaction.findUnique({
        where: {
          userId_reviewId: {
            userId,
            reviewId,
          },
        },
      });

      if (existingReaction) {
        if (existingReaction.isLike === isLike) {
          await db.reviewReaction.delete({
            where: {
              id: existingReaction.id,
            },
          });
        } else {
          await db.reviewReaction.update({
            where: {
              id: existingReaction.id,
            },
            data: {
              isLike,
            },
          });
        }
      } else {
        await db.reviewReaction.create({
          data: {
            isLike,
            reviewId,
            userId,
          },
        });
      }

      return null;
    } catch (error) {
      console.error("Error handling review reaction:", error);
      return data({ error: "Failed to save reaction" }, { status: 500 });
    }
  }

  const title = formData.get("title");
  const description = formData.get("description");
  const yearCompleted = formData.get("yearCompleted");
  const overallRating = formData.get("overallRating");
  const teachingRating = formData.get("teachingRating");
  const contentRating = formData.get("contentRating");
  const difficultyRating = formData.get("difficultyRating");
  const workloadRating = formData.get("workloadRating");

  const errors: {
    title?: string;
    description?: string;
    yearCompleted?: string;
    overallRating?: string;
    teachingRating?: string;
    contentRating?: string;
    difficultyRating?: string;
    workloadRating?: string;
    unitCode?: string;
    userId?: string;
  } = {};

  if (!title) {
    errors.title = "Title is required";
  }

  if (!description) {
    errors.description = "Description is required";
  }

  if (!yearCompleted) {
    errors.yearCompleted = "Year completed is required";
  }

  if (
    yearCompleted &&
    (Number(yearCompleted) < 2000 ||
      Number(yearCompleted) > new Date().getFullYear())
  ) {
    errors.yearCompleted = "Please enter a valid year";
  }

  if (!overallRating) {
    errors.overallRating = "Overall rating is required";
  }

  if (!teachingRating) {
    errors.teachingRating = "Teaching rating is required";
  }

  if (!contentRating) {
    errors.contentRating = "Content rating is required";
  }

  if (!difficultyRating) {
    errors.difficultyRating = "Difficulty rating is required";
  }

  if (!workloadRating) {
    errors.workloadRating = "Workload rating is required";
  }

  if (!params.unitCode) {
    errors.unitCode = "Unit Code is required";
  }

  if (Object.keys(errors).length > 0) {
    return data({ errors }, { status: 400 });
  }

  const unit = await db.unit.findUnique({
    where: {
      code: params.unitCode,
    },
  });
  if (!unit) {
    return data({ error: "Unit not found" }, { status: 404 });
  }
  const unitId = unit.id;

  try {
    await db.review.create({
      data: {
        title: title as string,
        text: description as string,
        yearCompleted: parseInt(yearCompleted as string),
        overallRating: parseInt(overallRating as string),
        teachingRating: parseInt(teachingRating as string),
        contentRating: parseInt(contentRating as string),
        difficultyRating: parseInt(difficultyRating as string),
        workloadRating: parseInt(workloadRating as string),
        requiresAttendance: formData.get("attendanceRequired") === "true",
        isWamBooster: formData.get("isWamBooster") === "true",
        unitId,
        userId,
      },
    });
  } catch (error) {
    console.error("Error saving review:", error);
    return { error: "Failed to save review" };
  }

  return redirect("/units/" + params.unitCode);
}

function OverallRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1.5 bg-base-200/50 p-3 rounded-xl">
      {[...Array(5)].map((_, i) => (
        <StarIcon
          key={i}
          size={12}
          className={`w-8 h-8 md:w-10 md:h-10 fill-current transition-colors duration-200 ${
            i < rating ? "text-yellow-500" : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );
}

function Rating({
  rating,
  title,
  size,
  type,
}: {
  rating: number;
  title: string;
  size?: "md" | "sm";
  type?: "difficulty" | "workload";
}) {
  const getDifficultyLabel = (rating: number) => {
    const rounded = Math.round(rating);
    switch (rounded) {
      case 1:
        return "Very Easy";
      case 2:
        return "Easy";
      case 3:
        return "Medium";
      case 4:
        return "Hard";
      case 5:
        return "Very Hard";
      default:
        return rating.toFixed(1);
    }
  };

  const getWorkloadLabel = (rating: number) => {
    const rounded = Math.round(rating);
    switch (rounded) {
      case 1:
        return "Very Low";
      case 2:
        return "Low";
      case 3:
        return "Moderate";
      case 4:
        return "High";
      case 5:
        return "Very High";
      default:
        return rating.toFixed(1);
    }
  };

  const displayValue =
    type === "difficulty"
      ? getDifficultyLabel(rating)
      : type === "workload"
      ? getWorkloadLabel(rating)
      : rating.toFixed(1);

  if (size == "sm")
    return (
      <div className="flex flex-col items-center px-4 py-2 bg-base-200/50 rounded-xl transition-all duration-200 hover:bg-base-200">
        <span className="font-bold text-xl">{displayValue}</span>
        <p className="text-xs text-base-content/70">{title}</p>
      </div>
    );

  return (
    <div className="flex flex-col items-center justify-center h-24 bg-base-200/50 rounded-xl transition-all duration-200 hover:bg-base-200">
      <div className="flex flex-col items-center">
        <span className="font-bold text-3xl md:text-4xl mb-1">
          {displayValue}
        </span>
        <p className="text-sm text-base-content/70">{title}</p>
      </div>
    </div>
  );
}

function UnitDetails({
  unit,
  overallRating,
}: {
  unit: any;
  overallRating: number;
}) {
  const handbookUrl =
    unit.handbookUrl ||
    `https://handbook.monash.edu/current/units/${unit.code}`;

  return (
    <div className="flex gap-6 sm:gap-8 flex-col sm:flex-row items-center justify-between">
      <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
        <h1 className="card-title text-4xl md:text-5xl font-bold mb-2">
          {unit.code}
        </h1>
        <p className="text-lg text-base-content/70">{unit.name}</p>
        <div className="flex flex-wrap gap-2 mt-4">
          {unit.campuses.map((campus: any) => (
            <span key={campus.campus.id} className="badge badge-primary">
              {campus.campus.name}
            </span>
          ))}
          {unit.semesters.map((semester: any) => (
            <span key={semester.semester.id} className="badge badge-secondary">
              {semester.semester.name}
            </span>
          ))}
        </div>
        <a
          href={handbookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 text-primary hover:text-primary-focus transition-colors duration-200"
        >
          View in Monash Handbook →
        </a>
      </div>
      <OverallRating rating={overallRating} />
    </div>
  );
}

function Review({ review, user }: { review: any; user?: number }) {
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";

  const userReaction = review.reactions?.find((r: any) => r.userId === user);
  const likes = review.reactions?.filter((r: any) => r.isLike).length || 0;
  const dislikes = review.reactions?.filter((r: any) => !r.isLike).length || 0;

  return (
    <div className="card bg-base-100 shadow-md hover:shadow-xl transition-all duration-300 rounded-xl overflow-hidden">
      <div className="card-body p-6">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold">{review.title}</h3>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-base-content/70 font-medium">
                  {review.user.name || "Anonymous"}
                </span>
                {review.yearCompleted && (
                  <span className="text-sm text-base-content/70">
                    • Completed {review.yearCompleted}
                  </span>
                )}
                {review.isWamBooster && (
                  <span className="badge badge-success">WAM Booster</span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Rating
                rating={review.teachingRating}
                title="Teaching"
                size="sm"
              />
              <Rating rating={review.contentRating} title="Content" size="sm" />
              <Rating
                rating={review.difficultyRating}
                title="Difficulty"
                size="sm"
                type="difficulty"
              />
              <Rating
                rating={review.workloadRating}
                title="Workload"
                size="sm"
                type="workload"
              />
            </div>
          </div>
          <div className="divider my-1"></div>
          <p className="text-base-content/80 whitespace-pre-wrap leading-relaxed">
            {review.text}
          </p>
          <div className="flex items-center gap-4 pt-2">
            {user ? (
              <fetcher.Form method="post" className="flex items-center gap-4">
                <input type="hidden" name="intent" value="react-to-review" />
                <input type="hidden" name="reviewId" value={review.id} />
                <button
                  type="submit"
                  name="reaction"
                  value="like"
                  disabled={isSubmitting}
                  className={`btn btn-sm gap-2 ${
                    userReaction?.isLike ? "btn-primary" : "btn-ghost"
                  }`}
                >
                  <ThumbsUpIcon className="w-4 h-4" />
                  <span>{likes}</span>
                </button>
                <button
                  type="submit"
                  name="reaction"
                  value="dislike"
                  disabled={isSubmitting}
                  className={`btn btn-sm gap-2 ${
                    userReaction?.isLike === false ? "btn-primary" : "btn-ghost"
                  }`}
                >
                  <ThumbsDownIcon className="w-4 h-4" />
                  <span>{dislikes}</span>
                </button>
              </fetcher.Form>
            ) : (
              <div className="flex items-center gap-4">
                <Link
                  to="/auth/login"
                  className="btn btn-sm btn-ghost gap-2 cursor-not-allowed opacity-60"
                >
                  <ThumbsUpIcon className="w-4 h-4" />
                  <span>{likes}</span>
                </Link>
                <Link
                  to="/auth/login"
                  className="btn btn-sm btn-ghost gap-2 cursor-not-allowed opacity-60"
                >
                  <ThumbsDownIcon className="w-4 h-4" />
                  <span>{dislikes}</span>
                </Link>
              </div>
            )}
            <span className="text-sm text-base-content/60">
              {new Date(review.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewsList({ reviews, user }: { reviews: any[]; user?: number }) {
  const [sortBy, setSortBy] = useState<"helpful" | "latest" | "oldest">(
    "helpful"
  );

  const sortedReviews = [...reviews].sort((a, b) => {
    if (sortBy === "helpful") {
      const aLikes = a.reactions?.filter((r: any) => r.isLike).length || 0;
      const aDislikes = a.reactions?.filter((r: any) => !r.isLike).length || 0;
      const bLikes = b.reactions?.filter((r: any) => r.isLike).length || 0;
      const bDislikes = b.reactions?.filter((r: any) => !r.isLike).length || 0;
      return bLikes - bDislikes - (aLikes - aDislikes);
    }
    if (sortBy === "latest") {
      // Sort by year completed first, then by creation date
      const yearDiff = b.yearCompleted - a.yearCompleted;
      if (yearDiff !== 0) return yearDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    // For oldest, do the same but reversed
    const yearDiff = a.yearCompleted - b.yearCompleted;
    if (yearDiff !== 0) return yearDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold">Reviews</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSortBy("helpful")}
              className={`btn btn-xs ${
                sortBy === "helpful" ? "btn-primary" : "btn-ghost"
              }`}
            >
              Most Helpful
            </button>
            <button
              onClick={() => setSortBy("latest")}
              className={`btn btn-xs ${
                sortBy === "latest" ? "btn-primary" : "btn-ghost"
              }`}
            >
              Latest
            </button>
            <button
              onClick={() => setSortBy("oldest")}
              className={`btn btn-xs ${
                sortBy === "oldest" ? "btn-primary" : "btn-ghost"
              }`}
            >
              Oldest
            </button>
          </div>
        </div>
      </div>
      <div className="space-y-6">
        {sortedReviews.map((review) => (
          <Review key={review.id} review={review} user={user} />
        ))}
      </div>
    </div>
  );
}

export default function Unit({ loaderData, params }: Route.ComponentProps) {
  const { unit, user, hasReviewed, existingUnitAdditionRequest, previousPage } =
    loaderData;

  if (!unit) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="card bg-base-100 shadow-lg rounded-xl overflow-hidden">
          <div className="card-body p-6 md:p-8 text-center">
            <div className="space-y-6">
              <div className="space-y-4">
                <h1 className="text-4xl font-bold">Unit Not Found</h1>
                <p className="text-xl text-base-content/70">
                  Sorry, we couldn't find the unit {params.unitCode}
                </p>
              </div>

              {user && !existingUnitAdditionRequest && (
                <div className="space-y-4">
                  <p className="text-base-content/70">
                    If you think this unit should be in our system, you can
                    request it to be added.
                  </p>
                  <Form method="post">
                    <input type="hidden" name="intent" value="request-unit" />
                    <button
                      type="submit"
                      className="btn btn-primary btn-lg hover:scale-105 transition-transform duration-200"
                    >
                      Request Unit Addition
                    </button>
                  </Form>
                </div>
              )}

              {existingUnitAdditionRequest && (
                <div className="space-y-4">
                  <p className="text-base-content/70">
                    We currently have a pending request to add this unit. Please
                    check back again soon.
                  </p>
                  <p className="text-sm text-base-content/50">
                    Requested on{" "}
                    {new Date(
                      existingUnitAdditionRequest.createdAt
                    ).toLocaleDateString()}
                  </p>
                </div>
              )}

              {!user && (
                <div className="space-y-4">
                  <p className="text-base-content/70">
                    Please sign in to request this unit to be added to our
                    system.
                  </p>
                  <a
                    href="/auth/login"
                    className="btn btn-primary btn-lg hover:scale-105 transition-transform duration-200"
                  >
                    Sign In
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const overallRating =
    unit.reviews.reduce((acc, review) => acc + review.overallRating, 0) /
    unit.reviews.length;

  const teachingRating =
    unit.reviews.reduce((acc, review) => acc + review.teachingRating, 0) /
    unit.reviews.length;

  const contentRating =
    unit.reviews.reduce((acc, review) => acc + review.contentRating, 0) /
    unit.reviews.length;

  const difficultyRating =
    unit.reviews.reduce((acc, review) => acc + review.difficultyRating, 0) /
    unit.reviews.length;

  const workloadRating =
    unit.reviews.reduce((acc, review) => acc + review.workloadRating, 0) /
    unit.reviews.length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="space-y-10">
        <div className="flex justify-between items-start">
          <Link to={previousPage} className="btn btn-ghost btn-sm gap-2">
            <ArrowLeftIcon size={16} /> <span>Back</span>
          </Link>
        </div>

        <div className="card bg-base-100 shadow-lg rounded-xl overflow-hidden">
          <div className="card-body gap-8 p-6 md:p-8">
            <UnitDetails unit={unit} overallRating={overallRating} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Rating rating={teachingRating} title="Teaching" />
              <Rating rating={contentRating} title="Content" />
              <Rating
                rating={difficultyRating}
                title="Difficulty"
                type="difficulty"
              />
              <Rating
                rating={workloadRating}
                title="Workload"
                type="workload"
              />
            </div>
          </div>
        </div>

        <ReviewsList reviews={unit.reviews} user={user} />

        {user && !hasReviewed && (
          <div
            className="space-y-8 bg-base-100 shadow-lg p-6 md:p-8 rounded-xl"
            id="review-form"
          >
            <h2 className="text-3xl font-bold">Add Review</h2>
            <Form method="post" className="space-y-8">
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
                    className="checkbox checkbox-primary checkbox-sm"
                  />
                </label>
                <label className="cursor-pointer hover:text-primary transition-colors duration-200">
                  <span className="font-semibold mr-3">WAM Booster</span>
                  <input
                    type="checkbox"
                    name="isWamBooster"
                    className="checkbox checkbox-success checkbox-sm"
                  />
                </label>
              </div>

              <div className="pt-6">
                <button
                  type="submit"
                  className="btn btn-primary btn-lg w-full md:w-auto hover:scale-105 transition-transform duration-200"
                >
                  Submit Review
                </button>
              </div>
            </Form>
          </div>
        )}
      </div>
    </div>
  );
}
