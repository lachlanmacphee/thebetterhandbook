import { Link } from "react-router";
import type { Route } from "./+types/home";
import db from "~/modules/db/db.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "MonReview" },
    {
      name: "description",
      content: "The independent Monash unit reviewing platform.",
    },
  ];
}

export async function loader() {
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
    },
  });
  return units;
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const units = loaderData;

  return (
    <div className="container mx-auto p-4">
      <header className="text-center my-8">
        <h1 className="text-4xl font-bold">Welcome to MonReview</h1>
        <p className="text-lg mt-2">
          The independent Monash University unit reviewing platform.
        </p>
      </header>
      <main className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
          {units.map((unit) => (
            <Link
              key={unit.id}
              to={`/units/${unit.id}`}
              className="card bg-base-100 card-lg shadow-sm"
            >
              <div className="card-body">
                <div className="flex items-center">
                  <h2 className="card-title">{unit.code}</h2>
                  <p className="text-right">{unit.name}</p>
                </div>
                <div className="card-actions justify-between">
                  <div className="flex flex-wrap mt-auto gap-2">
                    {unit.campuses.map((campus) => (
                      <span key={campus.id} className="badge badge-primary">
                        {campus.campus.name}
                      </span>
                    ))}
                    {unit.semesters.map((semester) => (
                      <span key={semester.id} className="badge badge-secondary">
                        {semester.semester.name}
                      </span>
                    ))}
                  </div>
                  <Link
                    to={`/units/${unit.id}#addReview`}
                    className="btn btn-secondary"
                  >
                    Review
                  </Link>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
