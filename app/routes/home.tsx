import { Link, useNavigate } from "react-router";
import type { Route } from "./+types/home";
import db from "~/modules/db/db.server";
import { getSession } from "~/modules/auth/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = session.get("id");

  const units = await db.unit.findMany({
    take: 6,
    orderBy: {
      reviews: {
        _count: "desc",
      },
    },
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
      _count: {
        select: { reviews: true },
      },
    },
  });
  return { units, user };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { units, user } = loaderData;
  const navigate = useNavigate();

  const handleUnitSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const unitCode = formData.get("unitCode")?.toString().toUpperCase();
    if (unitCode) {
      navigate(`/units/${unitCode}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="space-y-10">
        <div className="card bg-base-100 shadow-lg rounded-xl overflow-hidden">
          <div className="card-body gap-6 p-6 md:p-8">
            <div className="flex flex-col items-center text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                Welcome to MonReview
              </h1>
              <p className="text-lg text-base-content/70 mb-6">
                The <strong>independent</strong> unit reviewing platform.
              </p>
              <form
                onSubmit={handleUnitSearch}
                className="flex gap-4 w-full max-w-2xl"
              >
                <input
                  type="text"
                  name="unitCode"
                  placeholder="Enter unit code (e.g. FIT1008)"
                  className="input input-bordered flex-1"
                  required
                />
                <button type="submit" className="btn btn-primary">
                  Go
                </button>
              </form>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-3xl font-bold mb-6">Popular Units</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
            {units.map((unit) => (
              <Link
                key={unit.id}
                to={`/units/${unit.code}`}
                className="card bg-base-100 shadow-md hover:shadow-xl transition-all duration-300 rounded-xl overflow-hidden"
              >
                <div className="card-body p-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <h2 className="text-2xl font-semibold">{unit.code}</h2>
                      <p className="text-base text-base-content/70">
                        {unit.name}
                      </p>
                      <p className="text-sm text-base-content/60">
                        {unit._count.reviews} reviews
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {unit.campuses.map((campus) => (
                          <span key={campus.id} className="badge badge-primary">
                            {campus.campus.name}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
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
                            to={`/units/${unit.code}#review-form`}
                            className="btn btn-primary w-full hover:scale-105 transition-transform duration-200"
                          >
                            Review
                          </Link>
                        )}
                      {user &&
                        unit.reviews.filter((review) => review.userId === user)
                          .length !== 0 && (
                          <button disabled className="btn btn-disabled w-full">
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
    </div>
  );
}
