import { redirect, useLoaderData, useNavigate } from "react-router";
import { getSession } from "~/modules/auth/session.server";
import db from "~/modules/db/db.server";
import ReviewForm from "~/components/ReviewForm";
import type { Route } from "../+types/root";

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get("id");

  if (!userId) {
    return redirect("/auth/login");
  }

  const reviewId = parseInt(params.reviewId as string);

  const review = await db.review.findUnique({
    where: { id: reviewId },
    include: {
      unit: true,
      user: true,
    },
  });

  if (!review || review.userId !== userId) {
    return redirect("/profile");
  }

  return { review };
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const userId = (await getSession(request.headers.get("Cookie"))).get("id");

  if (!userId) {
    return redirect("/auth/login");
  }

  if (intent === "edit-review") {
    const reviewId = parseInt(params.reviewId as string);
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
      return redirect("/profile");
    } catch (error) {
      console.error("Error updating review:", error);
      return { error: "Failed to update review" };
    }
  }

  return null;
}

export default function EditReview() {
  const { review } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const handleCancel = () => {
    navigate("/profile");
  };

  return (
    <>
      <h1>Edit Review</h1>
      <p>
        {review.unit.code} - {review.unit.name}
      </p>

      <ReviewForm review={review} onCancel={handleCancel} isEditing={true} />
    </>
  );
}
