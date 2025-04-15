import db from "~/modules/db/db.server";
import type { Route } from "./+types/unit";
import {
  ThumbsUpIcon,
  ThumbsDownIcon,
  ArrowLeftIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { data, Form, redirect, useFetcher, Link } from "react-router";
import { getSession } from "~/modules/auth/session.server";
import { useState } from "react";
import ReviewForm from "~/components/ReviewForm";
import Rating, { OverallRating } from "~/components/Rating";

export async function loader({ params, request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = await db.user.findUnique({
    where: { id: session.get("id") },
    select: { id: true, role: true },
  });
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
      deprecations: {
        where: { status: "approved" },
        include: { user: true },
      },
      suggestions: {
        where: { status: "pending" },
        include: { user: true },
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
        userId: user?.id,
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
      return data({ error: "Review not found" }, { status: 404 });
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
      return data({ success: true });
    } catch (error) {
      console.error("Error updating review:", error);
      return data({ error: "Failed to update review" }, { status: 500 });
    }
  }

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

  if (intent === "deprecate-unit") {
    const reason = formData.get("reason") as string;

    try {
      await db.unitDeprecation.create({
        data: {
          reason,
          unitId: parseInt(formData.get("unitId") as string),
          userId,
        },
      });
      return data({ success: true });
    } catch (error) {
      return data(
        { error: "Failed to submit deprecation request" },
        { status: 500 }
      );
    }
  }

  if (intent === "suggest-change") {
    const field = formData.get("field") as string;
    const oldValue = formData.get("oldValue") as string;
    const newValue = formData.get("newValue") as string;
    const reason = formData.get("reason") as string;

    try {
      await db.unitSuggestion.create({
        data: {
          field,
          oldValue,
          newValue,
          reason,
          unitId: parseInt(formData.get("unitId") as string),
          userId,
        },
      });
      return data({ success: true });
    } catch (error) {
      return data({ error: "Failed to submit suggestion" }, { status: 500 });
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

function UnitDetails({
  unit,
  user,
  overallRating,
  teachingRating,
  contentRating,
  difficultyRating,
  workloadRating,
}: {
  unit: any;
  user?: number;
  overallRating: number;
  teachingRating: number;
  contentRating: number;
  difficultyRating: number;
  workloadRating: number;
}) {
  const [showDeprecateModal, setShowDeprecateModal] = useState(false);
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const handbookUrl =
    unit.handbookUrl ||
    `https://handbook.monash.edu/current/units/${unit.code}`;

  return (
    <div className="card bg-base-100 shadow-lg rounded-xl overflow-hidden">
      <div className="card-body gap-8 p-6 md:p-8">
        <div className="flex gap-6 sm:gap-8 flex-col items-center sm:items-start sm:flex-row justify-between">
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <h1 className="card-title text-4xl md:text-5xl font-bold mb-2">
              {unit.code}
            </h1>
            <p className="text-lg text-base-content/70">{unit.name}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {unit.isDeprecated && (
                <div className="badge badge-warning gap-2">
                  <AlertTriangleIcon className="w-4 h-4" />
                  Deprecated
                </div>
              )}
              {unit.campuses.map((campus: any) => (
                <span key={campus.campus.id} className="badge badge-primary">
                  {campus.campus.name}
                </span>
              ))}
              {unit.semesters.map((semester: any) => (
                <span
                  key={semester.semester.id}
                  className="badge badge-secondary"
                >
                  {semester.semester.name}
                </span>
              ))}
            </div>
            <div className="flex gap-4 mt-4">
              <a
                href={handbookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary-focus transition-colors duration-200"
              >
                View in Monash Handbook →
              </a>
            </div>
          </div>
          <OverallRating rating={overallRating} />
          {/* Deprecate Modal */}
          {showDeprecateModal && (
            <div className="modal modal-open">
              <div className="modal-box">
                <h3 className="font-bold text-lg">Mark Unit as Deprecated</h3>
                <Form method="post" className="space-y-4 mt-4">
                  <input type="hidden" name="intent" value="deprecate-unit" />
                  <input type="hidden" name="unitId" value={unit.id} />
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Reason for deprecation</span>
                    </label>
                    <textarea
                      name="reason"
                      className="textarea textarea-bordered"
                      required
                      placeholder="Why should this unit be marked as deprecated?"
                    />
                  </div>
                  <div className="modal-action">
                    <button type="submit" className="btn btn-primary">
                      Submit
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setShowDeprecateModal(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </Form>
              </div>
              <div
                className="modal-backdrop"
                onClick={() => setShowDeprecateModal(false)}
              />
            </div>
          )}

          {/* Suggest Changes Modal */}
          {showSuggestModal && (
            <div className="modal modal-open">
              <div className="modal-box">
                <h3 className="font-bold text-lg">Suggest Changes</h3>
                <Form method="post" className="space-y-4 mt-4">
                  <input type="hidden" name="intent" value="suggest-change" />
                  <input type="hidden" name="unitId" value={unit.id} />
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">
                        What would you like to change?
                      </span>
                    </label>
                    <select
                      name="field"
                      className="select select-bordered"
                      required
                    >
                      <option value="">Select a field</option>
                      <option value="campus">Campus</option>
                      <option value="semester">Semester</option>
                      <option value="name">Unit Name</option>
                    </select>
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Current Value</span>
                    </label>
                    <input
                      type="text"
                      name="oldValue"
                      className="input input-bordered"
                      required
                      placeholder="Current value"
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Suggested Value</span>
                    </label>
                    <input
                      type="text"
                      name="newValue"
                      className="input input-bordered"
                      required
                      placeholder="Suggested value"
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Reason for change</span>
                    </label>
                    <textarea
                      name="reason"
                      className="textarea textarea-bordered"
                      required
                      placeholder="Why should this change be made?"
                    />
                  </div>
                  <div className="modal-action">
                    <button type="submit" className="btn btn-primary">
                      Submit
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setShowSuggestModal(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </Form>
              </div>
              <div
                className="modal-backdrop"
                onClick={() => setShowSuggestModal(false)}
              />
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Rating rating={teachingRating} title="Teaching" />
          <Rating rating={contentRating} title="Content" />
          <Rating
            rating={difficultyRating}
            title="Difficulty"
            type="difficulty"
          />
          <Rating rating={workloadRating} title="Workload" type="workload" />
        </div>
        {user && (
          <div className="flex justify-center sm:justify-end gap-4">
            <button
              onClick={() => setShowDeprecateModal(true)}
              className="btn btn-sm btn-warning"
            >
              Mark as Deprecated
            </button>
            <button
              onClick={() => setShowSuggestModal(true)}
              className="btn btn-sm btn-accent"
            >
              Suggest Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Review({ review, user }: { review: any; user?: number }) {
  const fetcher = useFetcher();
  const [isEditing, setIsEditing] = useState(false);

  const userReaction = review.reactions?.find((r: any) => r.userId === user);
  const likes = review.reactions?.filter((r: any) => r.isLike).length || 0;
  const dislikes = review.reactions?.filter((r: any) => !r.isLike).length || 0;

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
          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-4">
              {user ? (
                <fetcher.Form method="post" className="flex items-center gap-4">
                  <input type="hidden" name="intent" value="react-to-review" />
                  <input type="hidden" name="reviewId" value={review.id} />
                  <button
                    type="submit"
                    name="reaction"
                    value="like"
                    disabled={fetcher.state !== "idle"}
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
                    disabled={fetcher.state !== "idle"}
                    className={`btn btn-sm gap-2 ${
                      userReaction?.isLike === false
                        ? "btn-primary"
                        : "btn-ghost"
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
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-base-content/60">
                {new Date(review.createdAt).toLocaleDateString()}
              </span>
              {user === review.user.id && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn btn-ghost btn-sm"
                >
                  Edit
                </button>
              )}
            </div>
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
        <UnitDetails
          unit={unit}
          user={user?.id}
          overallRating={overallRating}
          teachingRating={teachingRating}
          contentRating={contentRating}
          difficultyRating={difficultyRating}
          workloadRating={workloadRating}
        />

        <ReviewsList reviews={unit.reviews} user={user?.id} />

        {user && !hasReviewed && (
          <div
            className="space-y-8 bg-base-100 shadow-lg p-6 md:p-8 rounded-xl"
            id="review-form"
          >
            <h2 className="text-3xl font-bold">Add Review</h2>
            <ReviewForm />
          </div>
        )}
      </div>
    </div>
  );
}
