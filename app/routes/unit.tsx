import { useEffect, useState } from "react";
import { data, Form, Link, redirect, useFetcher } from "react-router";
import { ThumbsDownIcon, ThumbsUpIcon } from "~/components/Icons";
import Rating, { OverallRating } from "~/components/Rating";
import ReviewForm from "~/components/ReviewForm";
import { getSession } from "~/modules/auth/session.server";
import db from "~/modules/db/db.server";
import type { Route } from "./+types/unit";

export async function loader({ params, request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  let user;
  if (session.has("id")) {
    user = await db.user.findUnique({
      where: { id: session.get("id") },
      select: { id: true, role: true },
    });
  }

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

  const hasReviewed = user
    ? (await db.review.findFirst({
        where: {
          unitId: unit.id,
          userId: user?.id,
        },
      })) !== null
    : false;

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
    const requiresAttendance = formData.get("attendanceRequired") === "on";
    const isWamBooster = formData.get("isWamBooster") === "on";

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
    const reason = formData.get("reason") as string;

    try {
      await db.unitSuggestion.create({
        data: {
          field,
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
        requiresAttendance: formData.get("attendanceRequired") === "on",
        isWamBooster: formData.get("isWamBooster") === "on",
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

function DeprecateForm({
  onClose,
  unitId,
}: {
  onClose: () => void;
  unitId: number;
}) {
  const fetcher = useFetcher();

  useEffect(() => {
    if (fetcher.data?.success) {
      onClose();
    }
  }, [fetcher.data, onClose]);

  return (
    <dialog open>
      <article>
        <header>
          <button aria-label="Close" rel="prev" onClick={onClose}></button>
          <h3>Mark Unit as Deprecated</h3>
        </header>
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="deprecate-unit" />
          <input type="hidden" name="unitId" value={unitId} />
          <fieldset>
            <label>
              Reason for deprecation
              <textarea
                required
                placeholder="Why should this unit be marked as deprecated?"
                name="reason"
                rows={4}
              />
            </label>
          </fieldset>
          <footer>
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit">Submit</button>
          </footer>
        </fetcher.Form>
      </article>
    </dialog>
  );
}

function SuggestChangesForm({
  onClose,
  unitId,
}: {
  onClose: () => void;
  unitId: number;
}) {
  const fetcher = useFetcher();

  useEffect(() => {
    if (fetcher.data?.success) {
      onClose();
    }
  }, [fetcher.data, onClose]);

  return (
    <dialog open>
      <article>
        <header>
          <button aria-label="Close" rel="prev" onClick={onClose}></button>
          <h3>Suggest Changes</h3>
        </header>
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="suggest-change" />
          <input type="hidden" name="unitId" value={unitId} />

          <fieldset>
            <label>
              What would you like to change?
              <select name="field" required>
                <option value="">Select a field</option>
                <option value="campus">Campus</option>
                <option value="semester">Semester</option>
                <option value="name">Unit Name</option>
              </select>
            </label>
          </fieldset>

          <fieldset>
            <label>
              Description of change
              <textarea
                name="reason"
                required
                placeholder="Describe what needs to be adjusted - such as the semester that should be added/removed or what the new unit name should be"
                rows={4}
              />
            </label>
          </fieldset>

          <footer>
            <button type="button" className="secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit">Submit</button>
          </footer>
        </fetcher.Form>
      </article>
    </dialog>
  );
}

function UnitDetails({
  unit,
  user,
  previousPage,
  overallRating,
  teachingRating,
  contentRating,
  difficultyRating,
  workloadRating,
}: {
  unit: any;
  user?: number;
  previousPage: string;
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
    <article>
      <header>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <hgroup>
            <h1>{unit.code}</h1>
            <p>{unit.name}</p>
          </hgroup>
          <OverallRating rating={overallRating} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {unit.isDeprecated && <mark>Deprecated</mark>}
          {unit.campuses.map((campus: any) => (
            <kbd key={campus.campus.id}>{campus.campus.name}</kbd>
          ))}
          {unit.semesters.map((semester: any) => (
            <kbd key={semester.semester.id}>{semester.semester.name}</kbd>
          ))}
        </div>
        <a
          href={handbookUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "block", marginTop: "1rem" }}
        >
          View in Monash Handbook
        </a>
      </header>

      <div className="grid">
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
        <footer
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "0.5rem",
          }}
        >
          <Link to={previousPage} role="button" className="secondary">
            Back
          </Link>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => setShowDeprecateModal(true)}
              className="secondary"
            >
              Mark as Deprecated
            </button>
            <button
              onClick={() => setShowSuggestModal(true)}
              className="secondary"
            >
              Suggest Changes
            </button>
          </div>
        </footer>
      )}

      {showDeprecateModal && (
        <DeprecateForm
          onClose={() => setShowDeprecateModal(false)}
          unitId={unit.id}
        />
      )}
      {showSuggestModal && (
        <SuggestChangesForm
          onClose={() => setShowSuggestModal(false)}
          unitId={unit.id}
        />
      )}
    </article>
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
      <article>
        <ReviewForm
          review={review}
          onCancel={() => setIsEditing(false)}
          isEditing={true}
        />
      </article>
    );
  }

  return (
    <article>
      <header>
        <hgroup>
          <h3>{review.title}</h3>
          <p>
            <small>
              {review.user.name || "Anonymous"}
              {review.yearCompleted && ` • Completed ${review.yearCompleted}`}
              {review.isWamBooster && " • WAM Booster"}
            </small>
          </p>
        </hgroup>

        <div className="grid">
          <Rating rating={review.teachingRating} title="Teaching" />
          <Rating rating={review.contentRating} title="Content" />
          <Rating
            rating={review.difficultyRating}
            title="Difficulty"
            type="difficulty"
          />
          <Rating
            rating={review.workloadRating}
            title="Workload"
            type="workload"
          />
        </div>
      </header>

      <p>{review.text}</p>

      <footer>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {user ? (
              <fetcher.Form
                method="post"
                style={{ display: "flex", alignItems: "center", gap: "1rem" }}
              >
                <input type="hidden" name="intent" value="react-to-review" />
                <input type="hidden" name="reviewId" value={review.id} />
                <button
                  type="submit"
                  name="reaction"
                  value="like"
                  disabled={fetcher.state !== "idle"}
                  className={userReaction?.isLike ? "" : "secondary"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  <ThumbsUpIcon />
                  <span>{likes}</span>
                </button>
                <button
                  type="submit"
                  name="reaction"
                  value="dislike"
                  disabled={fetcher.state !== "idle"}
                  className={userReaction?.isLike === false ? "" : "secondary"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  <ThumbsDownIcon />
                  <span>{dislikes}</span>
                </button>
              </fetcher.Form>
            ) : (
              <div
                style={{ display: "flex", alignItems: "center", gap: "1rem" }}
              >
                <Link
                  to="/auth/login"
                  role="button"
                  className="secondary"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  <ThumbsUpIcon />
                  <span>{likes}</span>
                </Link>
                <Link
                  to="/auth/login"
                  role="button"
                  className="secondary"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  <ThumbsDownIcon />
                  <span>{dislikes}</span>
                </Link>
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <small>{new Date(review.createdAt).toLocaleDateString()}</small>
            {user === review.user.id && (
              <button onClick={() => setIsEditing(true)} className="secondary">
                Edit
              </button>
            )}
          </div>
        </div>
      </footer>
    </article>
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
      const yearDiff = b.yearCompleted - a.yearCompleted;
      if (yearDiff !== 0) return yearDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    const yearDiff = a.yearCompleted - b.yearCompleted;
    if (yearDiff !== 0) return yearDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return (
    <section>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ marginBottom: "0px" }}>Reviews</h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            className={sortBy === "helpful" ? "" : "secondary"}
            onClick={() => setSortBy("helpful")}
          >
            Most Helpful
          </button>
          <button
            onClick={() => setSortBy("latest")}
            className={sortBy === "latest" ? "" : "secondary"}
          >
            Latest
          </button>
          <button
            onClick={() => setSortBy("oldest")}
            className={sortBy === "oldest" ? "" : "secondary"}
          >
            Oldest
          </button>
        </div>
      </header>
      <div>
        {sortedReviews.map((review) => (
          <Review key={review.id} review={review} user={user} />
        ))}
      </div>
    </section>
  );
}

export default function Unit({ loaderData, params }: Route.ComponentProps) {
  const { unit, user, hasReviewed, existingUnitAdditionRequest, previousPage } =
    loaderData;

  if (!unit) {
    return (
      <main style={{ padding: "2rem 0" }}>
        <div className="container">
          <article style={{ padding: "2rem", textAlign: "center" }}>
            <header style={{ marginBottom: "2rem" }}>
              <h1>Unit Not Found</h1>
              <p>Sorry, we couldn't find the unit {params.unitCode}</p>
            </header>

            {user && !existingUnitAdditionRequest && (
              <section style={{ marginBottom: "2rem" }}>
                <p>
                  If you think this unit should be in our system, you can
                  request it to be added.
                </p>
                <Form method="post" style={{ marginTop: "1rem" }}>
                  <input type="hidden" name="intent" value="request-unit" />
                  <button type="submit">Request Unit Addition</button>
                </Form>
              </section>
            )}

            {existingUnitAdditionRequest && (
              <section style={{ marginBottom: "2rem" }}>
                <p>
                  We currently have a pending request to add this unit. Please
                  check back again soon.
                </p>
                <small>
                  Requested on{" "}
                  {new Date(
                    existingUnitAdditionRequest.createdAt
                  ).toLocaleDateString()}
                </small>
              </section>
            )}

            {!user && (
              <section>
                <p>
                  Please sign in to request this unit to be added to our system.
                </p>
                <a
                  href="/auth/login"
                  role="button"
                  style={{ marginTop: "1rem" }}
                >
                  Sign In
                </a>
              </section>
            )}
          </article>
        </div>
      </main>
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
    <main style={{ padding: "2rem 0" }}>
      <div className="container">
        <UnitDetails
          unit={unit}
          user={user?.id}
          previousPage={previousPage}
          overallRating={overallRating}
          teachingRating={teachingRating}
          contentRating={contentRating}
          difficultyRating={difficultyRating}
          workloadRating={workloadRating}
        />

        <ReviewsList reviews={unit.reviews} user={user?.id} />

        {user && !hasReviewed && (
          <section style={{ marginTop: "3rem" }}>
            <article style={{ padding: "2rem", marginBottom: "2rem" }}>
              <header>
                <h2>Add Review</h2>
              </header>
              <ReviewForm />
            </article>
          </section>
        )}
      </div>
    </main>
  );
}
