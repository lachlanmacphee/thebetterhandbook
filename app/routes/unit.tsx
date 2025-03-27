import db from "~/modules/db/db.server";
import type { Route } from "./+types/unit";
import { StarIcon } from "lucide-react";
import { data, Form, redirect } from "react-router";

export async function loader({ params }: Route.LoaderArgs) {
  const unit = await db.unit.findUnique({
    where: {
      id: parseInt(params.unitId),
    },
    include: {
      reviews: {
        include: {
          user: true,
        },
      },
    },
  });
  return unit;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();

  const title = formData.get("title");
  const text = formData.get("text");
  const overallRating = formData.get("overallRating");
  const teachingRating = formData.get("teachingRating");
  const contentRating = formData.get("contentRating");
  const difficultyRating = formData.get("difficultyRating");
  const workloadRating = formData.get("workloadRating");
  const attendanceRequired = formData.get("attendanceRequired");
  const unitId = formData.get("unitId");
  const userId = formData.get("userId");

  // Need to verify that this user doesn't already have a review

  const errors: {
    title?: string;
    text?: string;
    overallRating?: string;
    teachingRating?: string;
    contentRating?: string;
    difficultyRating?: string;
    workloadRating?: string;
    attendanceRequired?: string;
    unitId?: string;
    userId?: string;
  } = {};

  if (!title) {
    errors.title = "Title is required";
  }

  if (!text) {
    errors.text = "Text is required";
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

  if (!unitId) {
    errors.unitId = "Unit ID is required";
  }

  if (!userId) {
    errors.userId = "User ID is required";
  }

  if (Object.keys(errors).length > 0) {
    return data({ errors }, { status: 400 });
  }

  try {
    await db.review.create({
      data: {
        title: title as string,
        text: text as string,
        overallRating: parseInt(overallRating as string),
        teachingRating: parseInt(teachingRating as string),
        contentRating: parseInt(contentRating as string),
        difficultyRating: parseInt(difficultyRating as string),
        workloadRating: parseInt(workloadRating as string),
        requiresAttendance: attendanceRequired === "true",
        unitId: parseInt(unitId as string),
        userId: parseInt(userId as string),
      },
    });
  } catch (error) {
    console.error("Error saving review:", error);
    return { error: "Failed to save review" };
  }

  return redirect("/units/" + parseInt(unitId as string));
}

function OverallRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1">
      {[...Array(5)].map((_, i) => (
        <StarIcon
          key={i}
          size={12}
          className={`w-12 h-12 fill-current ${
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
}: {
  rating: number;
  title: string;
  size?: "md" | "sm";
}) {
  if (size == "sm")
    return (
      <div className="flex flex-col items-center px-4 py-2 bg-secondary rounded-xl">
        <span className="font-bold text-xl">{rating}</span>
        <p className="text-xs">{title}</p>
      </div>
    );

  return (
    <div className="flex flex-col items-center justify-center w-20 h-20 bg-primary rounded-md">
      <div className="flex flex-col items-center">
        <span className="font-bold text-4xl">{rating}</span>
        <p className="font-semibold">{title}</p>
      </div>
    </div>
  );
}

export default function Unit({ loaderData }: Route.ComponentProps) {
  const unit = loaderData;
  if (!unit) {
    return <h1>Unit not found</h1>;
  }

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
    <div className="space-y-8">
      <div className="card bg-base-100 min-h-[120px] card-xs shadow-sm p-4">
        <div className="card-body gap-8">
          <div className="flex gap-4 sm:gap-0 flex-col sm:flex-row items-center justify-between">
            <div className="flex flex-col items-center sm:items-baseline">
              <h1 className="card-title text-5xl">{unit.code}</h1>
              <p className="text-lg font-extralight">{unit.name}</p>
            </div>
            <OverallRating rating={3} />
          </div>
          <div className="flex flex-wrap justify-between sm:flex-nowrap sm:justify-start items-center gap-4">
            <Rating rating={teachingRating} title="Teaching" />
            <Rating rating={contentRating} title="Content" />
            <Rating rating={difficultyRating} title="Difficulty" />
            <Rating rating={workloadRating} title="Workload" />
          </div>
        </div>
      </div>
      <div id="addReview">
        <h2 className="text-3xl font-bold mb-2">Reviews</h2>
        <div className="space-y-4">
          {unit.reviews.map((review) => (
            <div key={review.id} className="card bg-base-100 card-lg shadow-lg">
              <div className="card-body">
                <div>
                  <div className="flex justify-between items-center">
                    <h3 className="card-title">{review.title}</h3>
                    <div className="flex gap-2">
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
                      />
                      <Rating
                        rating={review.workloadRating}
                        title="Workload"
                        size="sm"
                      />
                    </div>
                  </div>
                  <p>{review.user.name}</p>
                </div>

                <p>{review.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h2 className="text-3xl font-bold mb-2">Add Review</h2>
        <Form method="post" className="space-y-4">
          <div>
            <label className="block font-semibold">Title</label>
            <input
              name="title"
              type="text"
              className="input input-bordered w-full"
              required
            />
          </div>
          <div>
            <label className="block font-semibold">Description</label>
            <textarea
              name="description"
              className="textarea textarea-bordered w-full"
              required
            ></textarea>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold">Overall Rating</label>
              <div className="rating">
                {[...Array(5)].map((_, i) => (
                  <input
                    key={i}
                    type="radio"
                    name="overallRating"
                    value={i + 1}
                    className="mask mask-star-2 bg-yellow-400"
                    required
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block font-semibold">Teaching Rating</label>
              <div className="rating">
                {[...Array(5)].map((_, i) => (
                  <input
                    key={i}
                    type="radio"
                    name="teachingRating"
                    value={i + 1}
                    className="mask mask-star-2 bg-yellow-400"
                    required
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block font-semibold">Content Rating</label>
              <div className="rating">
                {[...Array(5)].map((_, i) => (
                  <input
                    key={i}
                    type="radio"
                    name="contentRating"
                    value={i + 1}
                    className="mask mask-star-2 bg-yellow-400"
                    required
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block font-semibold">Difficulty</label>
              <div className="flex gap-4">
                {["Very Easy", "Easy", "Medium", "Hard", "Very Hard"].map(
                  (label, i) => (
                    <label key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="difficultyRating"
                        value={i + 1}
                        className="radio radio-primary"
                        required
                      />
                      {label}
                    </label>
                  )
                )}
              </div>
            </div>
            <div>
              <label className="block font-semibold">Workload</label>
              <div className="flex gap-4">
                {["Very Low", "Low", "Moderate", "High", "Very High"].map(
                  (label, i) => (
                    <label key={i} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="workloadRating"
                        value={i + 1}
                        className="radio radio-primary"
                        required
                      />
                      {label}
                    </label>
                  )
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="block font-semibold">Attendance Required</label>
            <input
              type="checkbox"
              name="attendanceRequired"
              className="checkbox checkbox-primary"
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Submit Review
          </button>
        </Form>
      </div>
    </div>
  );
}
