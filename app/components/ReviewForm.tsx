import { Form, useFetcher } from "react-router";
import { useEffect } from "react";

type ReviewFormProps = {
  review?: any;
  onCancel?: () => void;
  isEditing?: boolean;
};

export default function ReviewForm({
  review,
  onCancel,
  isEditing,
}: ReviewFormProps) {
  const fetcher = useFetcher();

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      onCancel?.();
    }
  }, [fetcher.state, fetcher.data, onCancel]);

  const FormComponent = isEditing ? fetcher.Form : Form;

  return (
    <FormComponent method="post" className="space-y-8">
      {isEditing && (
        <>
          <input type="hidden" name="intent" value="edit-review" />
          <input type="hidden" name="reviewId" value={review?.id} />
        </>
      )}

      <div className="space-y-6">
        <div className="form-control">
          <label className="label mb-1">
            <span className="label-text text-base font-semibold">Title</span>
          </label>
          <input
            name="title"
            type="text"
            defaultValue={review?.title}
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
            defaultValue={review?.text}
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
            defaultValue={review?.yearCompleted}
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
                defaultChecked={review?.overallRating === i + 1}
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
                defaultChecked={review?.teachingRating === i + 1}
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
                defaultChecked={review?.contentRating === i + 1}
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
                    defaultChecked={review?.difficultyRating === i + 1}
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
                    defaultChecked={review?.workloadRating === i + 1}
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
            defaultChecked={review?.requiresAttendance}
            className="checkbox checkbox-primary checkbox-sm"
          />
        </label>
        <label className="cursor-pointer hover:text-primary transition-colors duration-200">
          <span className="font-semibold mr-3">WAM Booster</span>
          <input
            type="checkbox"
            name="isWamBooster"
            defaultChecked={review?.isWamBooster}
            className="checkbox checkbox-success checkbox-sm"
          />
        </label>
      </div>

      <div className="flex justify-end gap-4">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-ghost">
            Cancel
          </button>
        )}
        <button
          type="submit"
          className={`btn btn-primary ${
            !isEditing ? "btn-lg w-full md:w-auto" : ""
          }`}
          disabled={fetcher.state !== "idle"}
        >
          {isEditing
            ? fetcher.state !== "idle"
              ? "Saving..."
              : "Save Changes"
            : "Submit Review"}
        </button>
      </div>
    </FormComponent>
  );
}
