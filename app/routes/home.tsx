import { Link } from "react-router";
import type { Route } from "./+types/home";
import db from "~/modules/db/db.server";
import { getSession } from "~/modules/auth/session.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "MonReview" },
    {
      name: "description",
      content: "The independent Monash unit reviewing platform.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = session.get("id");

  const units = await db.unit.findMany({
    take: 9,
    include: {
      semesters: {
        include: {
          semester: true,
        },
      },
      campuses: {
        include: {
          campus: true,
        },
      },
      reviews: {
        include: {
          user: true,
        },
        where: {
          userId: user,
        },
      },
    },
  });
  return { units, user };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { units, user } = loaderData;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="space-y-10">
        <div className="card bg-base-100 shadow-lg rounded-xl overflow-hidden">
          <div className="card-body gap-6 p-6 md:p-8">
            <div className="flex flex-col items-center text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                Welcome to MonReview
              </h1>
              <p className="text-lg text-base-content/70">
                The independent unit reviewing platform.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
          {units.map((unit) => (
            <Link
              key={unit.id}
              to={`/units/${unit.id}`}
              className="card bg-base-100 shadow-md hover:shadow-xl transition-all duration-300 rounded-xl overflow-hidden"
            >
              <div className="card-body p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-2xl font-semibold">{unit.code}</h2>
                    <p className="text-base text-base-content/70">
                      {unit.name}
                    </p>
                  </div>
                  <div className="flex justify-between items-end">
                    <div className="flex flex-wrap gap-2">
                      {unit.campuses.map((campus) => (
                        <span key={campus.id} className="badge badge-primary">
                          {campus.campus.name}
                        </span>
                      ))}
                      {unit.semesters.map((semester) => (
                        <span
                          key={semester.id}
                          className="badge badge-secondary"
                        >
                          {semester.semester.name}
                        </span>
                      ))}
                    </div>
                    {user &&
                      unit.reviews.filter((review) => review.userId === user)
                        .length === 0 && (
                        <Link
                          to={`/units/${unit.id}#addReview`}
                          className="btn btn-primary hover:scale-105 transition-transform duration-200"
                        >
                          Review
                        </Link>
                      )}
                    {user &&
                      unit.reviews.filter((review) => review.userId === user)
                        .length !== 0 && (
                        <button disabled className="btn btn-disabled">
                          Reviewed
                        </button>
                      )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
