import db from "~/modules/db/db.server";
import type { Route } from "./+types/unit";
import { StarIcon } from "lucide-react";
import { data, Form, redirect } from "react-router";
import { getSession } from "~/modules/auth/session.server";

export async function loader({ params, request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = session.get("id");

  const unit = await db.unit.findUnique({
    where: {
      code: params.unitCode,
    },
    include: {
      reviews: {
        include: {
          user: true,
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

  // Handle review submission
  const title = formData.get("title");
  const description = formData.get("description");
  const overallRating = formData.get("overallRating");
  const teachingRating = formData.get("teachingRating");
  const contentRating = formData.get("contentRating");
  const difficultyRating = formData.get("difficultyRating");
  const workloadRating = formData.get("workloadRating");
  const attendanceRequired = formData.get("attendanceRequired");

  const errors: {
    title?: string;
    description?: string;
    overallRating?: string;
    teachingRating?: string;
    contentRating?: string;
    difficultyRating?: string;
    workloadRating?: string;
    attendanceRequired?: string;
    unitCode?: string;
    userId?: string;
  } = {};

  if (!title) {
    errors.title = "Title is required";
  }

  if (!description) {
    errors.description = "Description is required";
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

  if (!attendanceRequired) {
    errors.attendanceRequired = "Requires attendance is required";
  }

  if (!params.unitCode) {
    errors.unitCode = "Unit Code is required";
  }

  if (Object.keys(errors).length > 0) {
    return data({ errors }, { status: 400 });
  }

  // Find the unit ID by its unit code
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
        overallRating: parseInt(overallRating as string),
        teachingRating: parseInt(teachingRating as string),
        contentRating: parseInt(contentRating as string),
        difficultyRating: parseInt(difficultyRating as string),
        workloadRating: parseInt(workloadRating as string),
        requiresAttendance: attendanceRequired === "true",
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

export default function Unit({ loaderData, params }: Route.ComponentProps) {
  const { unit, user, hasReviewed, existingUnitAdditionRequest } = loaderData;

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
        <div className="card bg-base-100 shadow-lg rounded-xl overflow-hidden">
          <div className="card-body gap-8 p-6 md:p-8">
            <div className="flex gap-6 sm:gap-8 flex-col sm:flex-row items-center justify-between">
              <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                <h1 className="card-title text-4xl md:text-5xl font-bold mb-2">
                  {unit.code}
                </h1>
                <p className="text-lg text-base-content/70">{unit.name}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {unit.campuses.map((campus) => (
                    <span
                      key={campus.campus.id}
                      className="badge badge-primary"
                    >
                      {campus.campus.name}
                    </span>
                  ))}
                  {unit.semesters.map((semester) => (
                    <span
                      key={semester.semester.id}
                      className="badge badge-secondary"
                    >
                      {semester.semester.name}
                    </span>
                  ))}
                </div>
              </div>
              <OverallRating rating={overallRating} />
            </div>
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
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-bold">Reviews</h2>
            {user && !hasReviewed && (
              <button
                className="btn btn-primary hover:scale-105 transition-transform duration-200"
                onClick={() =>
                  document
                    .getElementById("review-form")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Add Review
              </button>
            )}
          </div>
          <div className="space-y-6">
            {unit.reviews.map((review) => (
              <div
                key={review.id}
                className="card bg-base-100 shadow-md hover:shadow-xl transition-all duration-300 rounded-xl overflow-hidden"
              >
                <div className="card-body p-6">
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                      <div className="space-y-2">
                        <h3 className="text-2xl font-semibold">
                          {review.title}
                        </h3>
                        <p className="text-sm text-base-content/70 font-medium">
                          {review.user.name}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Rating
                          rating={review.teachingRating}
                          title="Teaching"
                          size="sm"
                        />
                        <Rating
                          rating={review.contentRating}
                          title="Content"
                          size="sm"
                        />
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
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

              <div className="flex items-center gap-3 pt-4">
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
