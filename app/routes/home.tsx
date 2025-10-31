import { Link, useNavigate } from "react-router";
import { getSession } from "~/modules/auth/session.server";
import db from "~/modules/db/db.server";
import type { Route } from "./+types/home";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get("id");
  const preferredUniversityId = session.get("preferredUniversityId");

  const units = await db.unit.findMany({
    where: preferredUniversityId
      ? {
          universityId: preferredUniversityId,
        }
      : {},
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
          userId: userId,
        },
      },
      university: {
        select: {
          id: true,
        },
      },
      _count: {
        select: { reviews: true },
      },
    },
  });
  return { units, user: userId };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { units, user } = loaderData;
  const navigate = useNavigate();

  const handleUnitSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const uniId = formData.get("uniId")?.toString();
    const unitCode = formData.get("unitCode")?.toString().toUpperCase();
    if (uniId && unitCode) {
      navigate(`/units/${uniId}/${unitCode}`);
    }
  };

  return (
    <>
      <h2>Find a Unit</h2>
      <form onSubmit={handleUnitSearch}>
        <select name="uniId">
          <option value="1">Monash University</option>
          <option value="2">University of Melbourne</option>
        </select>
        <fieldset role="group">
          <input
            type="text"
            name="unitCode"
            placeholder="Enter the unit code"
            required
          />
          <input type="submit" value="Go" />
        </fieldset>
      </form>
      <Link to="/search">Want to search for units instead?</Link>
      <h2>Popular Units</h2>
      <UnitsRow units={units.slice(0, 3)} user={user} />
      <UnitsRow units={units.slice(3, 6)} user={user} />
    </>
  );
}

function UnitsRow({
  units,
  user,
}: {
  units: Route.ComponentProps["loaderData"]["units"];
  user: Route.ComponentProps["loaderData"]["user"];
}) {
  return (
    <div className="grid">
      {units.map((unit) => (
        <article
          key={unit.id}
          style={{ display: "flex", flexDirection: "column" }}
        >
          <header>
            <Link key={unit.id} to={`/units/${unit.universityId}/${unit.code}`}>
              <h4>{unit.code}</h4>
            </Link>
          </header>
          <p>
            <strong>Name:</strong> {unit.name}
            <br />
            <strong>Reviews:</strong> {unit._count.reviews}
            <br />
            <strong>Campuses:</strong>{" "}
            {unit.campuses.map((campus) => campus.campus.name).join(", ")}
            <br />
            <strong>Semesters:</strong>{" "}
            {unit.semesters
              .map((semester) => semester.semester.name)
              .join(", ")}
          </p>
          {user && (
            <footer style={{ marginTop: "auto" }}>
              <div>
                {unit.reviews.filter((review) => review.userId === user)
                  .length === 0 && (
                  <Link
                    to={`/units/${unit.universityId}/${unit.code}#review-form`}
                    role="button"
                  >
                    Review
                  </Link>
                )}
                {unit.reviews.filter((review) => review.userId === user)
                  .length !== 0 && (
                  <Link
                    to={`/units/${unit.universityId}/${unit.code}#review-form`}
                    role="button"
                    className="secondary"
                  >
                    Reviewed
                  </Link>
                )}
              </div>
            </footer>
          )}
        </article>
      ))}
    </div>
  );
}
