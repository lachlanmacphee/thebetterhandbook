import { StarIcon } from "lucide-react";

type RatingProps = {
  rating: number;
  title: string;
  size?: "md" | "sm";
  type?: "difficulty" | "workload";
};

export function OverallRating({ rating }: { rating: number }) {
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

export default function Rating({ rating, title, size, type }: RatingProps) {
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

  if (size === "sm") {
    return (
      <div className="flex flex-col items-center px-4 py-2 bg-base-200/50 rounded-xl transition-all duration-200 hover:bg-base-200">
        <span className="font-bold text-xl">{displayValue}</span>
        <p className="text-xs text-base-content/70">{title}</p>
      </div>
    );
  }

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
