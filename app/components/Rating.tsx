import { useEffect, useState } from "react";
import { StarIcon } from "./Icons";

type RatingProps = {
  rating: number;
  title: string;
  type?: "difficulty" | "workload";
};

export function OverallRating({ rating }: { rating: number }) {
  const [screenWidth, setScreenWidth] = useState<number | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const starSize = screenWidth && screenWidth < 640 ? 24 : 36;
  return (
    <div style={{ marginBottom: "1rem" }}>
      {[...Array(Math.round(rating))].map((_, i) => (
        <StarIcon key={i} filled={true} size={starSize} />
      ))}
    </div>
  );
}

export default function Rating({ rating, title, type }: RatingProps) {
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
      : rating.toFixed(1) + " / 5";

  return (
    <div style={{ textAlign: "center" }}>
      <h4>{title}</h4>
      <p>{displayValue}</p>
    </div>
  );
}
