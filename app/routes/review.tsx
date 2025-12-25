import { useEffect } from "react";
import toast from "react-hot-toast";
import {
  data,
  redirect,
  useFetcher,
  useLoaderData,
  useNavigate,
} from "react-router";
import ReviewForm from "~/components/ReviewForm";
import { getSession } from "~/modules/auth/session.server";
import db from "~/modules/db/db.server";
import type { Route } from "../+types/root";

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get("id");

  if (!userId) {
    return redirect("/auth/login");
  }

  if (!!params?.reviewId) {
    const reviewId = parseInt(params.reviewId as string);
    const review = await db.review.findUnique({
      where: { id: reviewId },
      include: {
        unit: true,
        user: true,
      },
    });

    if (!!review && review.userId !== userId) {
      return redirect("/profile");
    }

    return { review };
  } else if (!!params?.uniId && !!params?.unitCode) {
    return {
      uniId: params.uniId,
      unitCode: params.unitCode,
    };
  } else {
    return redirect("/profile");
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const userId = (await getSession(request.headers.get("Cookie"))).get("id");

  if (!userId) {
    return redirect("/auth/login");
  }

  if (intent === "create") {
    if (!params.uniId || !params.unitCode) {
      return data(
        { error: "University ID and Unit Code are required" },
        { status: 400 },
      );
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

    if (Object.keys(errors).length > 0) {
      return data({ errors }, { status: 400 });
    }

    const unit = await db.unit.findUnique({
      where: {
        code_universityId: {
          universityId: parseInt(params.uniId),
          code: params.unitCode,
        },
      },
    });

    if (!unit) {
      return data({ error: "Unit not found" }, { status: 404 });
    }

    const existingReview = await db.review.findUnique({
      where: {
        userId_unitId: {
          userId,
          unitId: unit.id,
        },
      },
    });

    if (existingReview) {
      return data(
        {
          error:
            "You have already reviewed this unit. You can edit your existing review from your profile.",
        },
        { status: 400 },
      );
    }

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
          unitId: unit.id,
          userId,
        },
      });
    } catch (error) {
      console.error(error);
      return data(
        { error: "Failed to save review. Please try again." },
        { status: 500 },
      );
    }

    return redirect(`/${params.uniId}/units/${params.unitCode}`);
  }

  if (intent === "edit") {
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
      console.error(error);
      return { error: "Failed to update review" };
    }
  }

  return null;
}

export default function Review() {
  const { review, uniId, unitCode } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const fetcher = useFetcher();
  const { data, state } = fetcher;

  useEffect(() => {
    if (state === "idle" && data) {
      if (data.error) {
        toast.error(data.error);
      }
      if (data.message) {
        toast.success(data.message);
      }
    }
  }, [data, state]);

  const handleCancel = () => {
    if (review) {
      navigate("/profile");
    } else {
      navigate(-1);
    }
  };

  if (!review && uniId && unitCode)
    return (
      <>
        <h1>Create Review</h1>
        <p>{unitCode}</p>
        <ReviewForm onCancel={handleCancel} isEditing={false} />
      </>
    );

  if (review)
    return (
      <>
        <h1>Edit Review</h1>
        <p>
          {review.unit.code} - {review.unit.name}
        </p>

        <ReviewForm review={review} onCancel={handleCancel} isEditing />
      </>
    );
}
