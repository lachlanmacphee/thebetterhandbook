import { useEffect } from "react";
import toast from "react-hot-toast";
import { useFetcher, useNavigate } from "react-router";
import { StarIcon } from "./Icons";

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
  const navigate = useNavigate();
  const { data, state } = fetcher;

  useEffect(() => {
    if (state === "idle" && data) {
      if (data.error) {
        toast.error(data.error);
      }
      if (data.message) {
        toast.success(data.message);
        if (isEditing) {
          navigate("/profile");
        } else {
          navigate(-1);
        }
      }
    }
  }, [data, state]);

  return (
    <fetcher.Form method="post">
      {fetcher.data?.error && (
        <div style={{ color: "red", marginBottom: "1rem" }}>
          {fetcher.data?.error}
        </div>
      )}
      {isEditing && <input type="hidden" name="reviewId" value={review?.id} />}
      <input
        type="hidden"
        name="intent"
        value={isEditing ? "edit" : "create"}
      />

      <fieldset>
        <label>
          Title
          <textarea
            name="title"
            defaultValue={review?.title}
            required
            rows={2}
            placeholder="Enter a title for your review"
            autoComplete="off"
          />
        </label>

        <label>
          Description
          <textarea
            name="description"
            defaultValue={review?.text}
            required
            rows={8}
            placeholder="Write your review here. Share your experience with assignments, teaching quality, content, and any tips for future students."
          />
        </label>

        <label>
          Year Completed
          <input
            name="yearCompleted"
            type="number"
            defaultValue={review?.yearCompleted}
            min="2000"
            max={new Date().getFullYear()}
            required
            placeholder={"e.g. " + new Date().getFullYear().toString()}
            autoComplete="off"
            style={{ marginBottom: "0px" }}
          />
        </label>
      </fieldset>

      <div className="grid">
        <fieldset>
          <legend>In Person Attendance Required</legend>
          <label>
            <input
              type="checkbox"
              name="attendanceRequired"
              defaultChecked={review?.requiresAttendance}
            />
            Yes
          </label>
        </fieldset>

        <fieldset>
          <legend>WAM Booster</legend>
          <label>
            <input
              type="checkbox"
              name="isWamBooster"
              defaultChecked={review?.isWamBooster}
            />
            Yes
          </label>
        </fieldset>
      </div>

      <div className="grid">
        <fieldset>
          <legend>Overall Rating</legend>
          {[...Array(5)].map((_, i) => (
            <div key={i}>
              <input
                type="radio"
                id={`overallRating-${i + 1}`}
                name="overallRating"
                value={i + 1}
                defaultChecked={review?.overallRating === i + 1}
                required
              />
              <label htmlFor={`overallRating-${i + 1}`}>
                {[...Array(i + 1)].map((_, starIndex) => (
                  <StarIcon key={starIndex} filled={true} />
                ))}
              </label>
            </div>
          ))}
        </fieldset>

        <fieldset>
          <legend>Teaching Quality</legend>
          {[...Array(5)].map((_, i) => (
            <div key={i}>
              <input
                type="radio"
                id={`teachingRating-${i + 1}`}
                name="teachingRating"
                value={i + 1}
                defaultChecked={review?.teachingRating === i + 1}
                required
              />
              <label htmlFor={`teachingRating-${i + 1}`}>
                {[...Array(i + 1)].map((_, starIndex) => (
                  <StarIcon key={starIndex} filled={true} />
                ))}
              </label>
            </div>
          ))}
        </fieldset>

        <fieldset>
          <legend>Content Quality</legend>
          {[...Array(5)].map((_, i) => (
            <div key={i}>
              <input
                type="radio"
                id={`contentRating-${i + 1}`}
                name="contentRating"
                value={i + 1}
                defaultChecked={review?.contentRating === i + 1}
                required
              />
              <label htmlFor={`contentRating-${i + 1}`}>
                {[...Array(i + 1)].map((_, starIndex) => (
                  <StarIcon key={starIndex} filled={true} />
                ))}
              </label>
            </div>
          ))}
        </fieldset>

        <fieldset>
          <legend>Difficulty Level</legend>
          {["Very Easy", "Easy", "Medium", "Hard", "Very Hard"].map(
            (label, i) => (
              <div key={i}>
                <input
                  type="radio"
                  id={`difficultyRating-${i + 1}`}
                  name="difficultyRating"
                  value={i + 1}
                  defaultChecked={review?.difficultyRating === i + 1}
                  required
                />
                <label htmlFor={`difficultyRating-${i + 1}`}>{label}</label>
              </div>
            ),
          )}
        </fieldset>

        <fieldset>
          <legend>Workload</legend>
          {["Very Low", "Low", "Moderate", "High", "Very High"].map(
            (label, i) => (
              <div key={i}>
                <input
                  type="radio"
                  id={`workloadRating-${i + 1}`}
                  name="workloadRating"
                  value={i + 1}
                  defaultChecked={review?.workloadRating === i + 1}
                  required
                />
                <label htmlFor={`workloadRating-${i + 1}`}>{label}</label>
              </div>
            ),
          )}
        </fieldset>
      </div>

      <fieldset role="group" style={{ marginTop: "1rem" }}>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" disabled={fetcher.state !== "idle"}>
          {isEditing
            ? fetcher.state !== "idle"
              ? "Saving..."
              : "Save"
            : "Submit Review"}
        </button>
      </fieldset>
    </fetcher.Form>
  );
}
