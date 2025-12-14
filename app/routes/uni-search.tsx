import { Prisma } from "@prisma/client";
import { Form, Link, useLocation } from "react-router";
import { getSession } from "~/modules/auth/session.server";
import db from "~/modules/db/db.server";
import type { Route } from "./+types/uni-search";

// Default and allowed page sizes
const DEFAULT_PAGE_SIZE = 12;
const ALLOWED_PAGE_SIZES = [12, 24, 36];

export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get("id");
  const url = new URL(request.url);
  const universityId = parseInt(params.uniId);

  // Get all filter parameters
  const code = url.searchParams.get("code")?.toUpperCase() || "";
  const name = (url.searchParams.get("name") || "").toLowerCase();
  const faculty = url.searchParams.get("faculty") || "";
  const level = url.searchParams.get("level") || "";
  const creditPoints = url.searchParams.get("creditPoints") || "";
  const campus = url.searchParams.get("campus") || "";
  const semester = url.searchParams.get("semester") || "";
  const sortBy = url.searchParams.get("sortBy") || "code";
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = parseInt(
    url.searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE),
  );

  // Validate page size
  const validPageSize = ALLOWED_PAGE_SIZES.includes(pageSize)
    ? pageSize
    : DEFAULT_PAGE_SIZE;

  // Fetch reference data for dropdowns
  const [faculties, campuses, semesters, universities] = await Promise.all([
    db.faculty.findMany({
      where: { universityId },
      orderBy: { name: "asc" },
    }),
    db.campus.findMany({
      where: { universityId },
      orderBy: { name: "asc" },
    }),
    db.semester.findMany({
      where: { universityId },
      orderBy: { name: "asc" },
    }),
    db.university.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Build the where clause based on filters
  const where = {
    AND: [
      { universityId },
      code ? { code: { contains: code } } : {},
      name ? { name: { contains: name } } : {},
      faculty ? { facultyId: parseInt(faculty) } : {},
      level ? { level: parseInt(level) } : {},
      creditPoints ? { creditPoints: parseInt(creditPoints) } : {},
      campus
        ? {
            campuses: {
              some: {
                campusId: parseInt(campus),
              },
            },
          }
        : {},
      semester
        ? {
            semesters: {
              some: {
                semesterId: parseInt(semester),
              },
            },
          }
        : {},
    ],
  };

  // Get total count for pagination
  const totalCount = await db.unit.count({ where });
  const totalPages = Math.ceil(totalCount / validPageSize);

  let units;
  if (sortBy === "rating" || sortBy === "reviews") {
    // For rating and review count sort, we need to use raw queries
    const unitsWithStats = await db.$queryRaw`
      SELECT u.*,
             COALESCE(AVG(CAST(r."overallRating" AS FLOAT)), 0) as "avgRating",
             COUNT(r.id) as "reviewCount"
      FROM "Unit" u
      LEFT JOIN "Review" r ON u.id = r."unitId"
      GROUP BY u.id
      ORDER BY ${
        sortBy === "rating"
          ? Prisma.sql`"avgRating" DESC`
          : Prisma.sql`"reviewCount" DESC`
      }
      OFFSET ${(page - 1) * validPageSize}
      LIMIT ${validPageSize}
    `;

    // Then fetch the full unit data for the sorted units
    const unitIds = (unitsWithStats as any[]).map((u: any) => u.id);
    units = await db.unit.findMany({
      where: {
        id: {
          in: unitIds,
        },
      },
      include: {
        faculty: true,
        campuses: {
          include: {
            campus: true,
          },
        },
        semesters: {
          include: {
            semester: true,
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
        university: true,
        _count: {
          select: { reviews: true },
        },
      },
      orderBy: {
        id: "asc",
      },
    });

    // Reorder the units to match the sorted order from the raw query
    const unitMap = new Map(units.map((u) => [u.id, u]));
    units = unitIds
      .map((id) => unitMap.get(id)!)
      .filter((unit): unit is NonNullable<typeof unit> => unit !== undefined);
  } else {
    // For other sorts, we can use regular Prisma queries
    const orderBy: any = {};
    switch (sortBy) {
      case "name":
        orderBy.name = "asc";
        break;
      case "code":
      default:
        orderBy.code = "asc";
        break;
    }

    units = await db.unit.findMany({
      where,
      include: {
        faculty: true,
        campuses: {
          include: {
            campus: true,
          },
        },
        semesters: {
          include: {
            semester: true,
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
        university: true,
        _count: {
          select: { reviews: true },
        },
      },
      orderBy,
      skip: (page - 1) * validPageSize,
      take: validPageSize,
    });
  }

  return {
    units,
    faculties,
    campuses,
    semesters,
    universities,
    pagination: {
      currentPage: page,
      totalPages,
      totalCount,
      pageSize: validPageSize,
    },
    filters: {
      code,
      name,
      faculty,
      level,
      creditPoints,
      campus,
      semester,
      sortBy,
      pageSize: validPageSize,
    },
  };
}

export default function Search({ loaderData, params }: Route.ComponentProps) {
  const { units, faculties, campuses, semesters, filters, pagination } =
    loaderData;
  const { currentPage, totalPages, totalCount, pageSize } = pagination;
  const location = useLocation();

  const createPageUrl = (pageNum: number) => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set("page", pageNum.toString());
    if (!searchParams.has("pageSize")) {
      searchParams.set("pageSize", String(pageSize));
    }
    return `${location.pathname}?${searchParams.toString()}`;
  };

  return (
    <>
      <h1>Advanced Unit Search</h1>

      <Form method="get" preventScrollReset>
        <div className="grid">
          <label>
            Unit Code
            <input
              type="text"
              name="code"
              defaultValue={filters.code}
              placeholder={"e.g. " + units[0]?.code || "CS1010"}
            />
          </label>

          <label>
            Unit Name
            <input
              type="text"
              name="name"
              defaultValue={filters.name}
              placeholder="e.g. Introduction to CS"
            />
          </label>
        </div>

        <div className="grid">
          <label>
            Faculty
            <select name="faculty" defaultValue={filters.faculty}>
              <option value="">All Faculties</option>
              {faculties.map((faculty) => (
                <option key={faculty.id} value={faculty.id}>
                  {faculty.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Level
            <select name="level" defaultValue={filters.level}>
              <option value="">All Levels</option>
              {[1, 2, 3, 4, 5].map((level) => (
                <option key={level} value={level}>
                  Level {level}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid">
          <label>
            Credit Points
            <select name="creditPoints" defaultValue={filters.creditPoints}>
              <option value="">Any Credit Points</option>
              {[6, 12].map((points) => (
                <option key={points} value={points}>
                  {points} Points
                </option>
              ))}
            </select>
          </label>

          <label>
            Campus
            <select name="campus" defaultValue={filters.campus}>
              <option value="">All Campuses</option>
              {campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid">
          <label>
            Semester
            <select name="semester" defaultValue={filters.semester}>
              <option value="">All Semesters</option>
              {semesters.map((semester) => (
                <option key={semester.id} value={semester.id}>
                  {semester.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Sort By
            <select name="sortBy" defaultValue={filters.sortBy}>
              <option value="code">Unit Code</option>
              <option value="name">Unit Name</option>
              <option value="rating">Average Rating</option>
              <option value="reviews">Number of Reviews</option>
            </select>
          </label>
        </div>

        <label>
          Items per Page
          <select name="pageSize" defaultValue={filters.pageSize}>
            {ALLOWED_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} Items
              </option>
            ))}
          </select>
        </label>

        <div className="grid">
          <input type="reset" value="Clear" className="secondary" />
          <button type="submit">Search</button>
        </div>
      </Form>

      <h2>Search Results ({totalCount} units)</h2>

      {Array.from({ length: Math.ceil(units.length / 3) }, (_, rowIndex) => (
        <div key={rowIndex} className="grid">
          {units.slice(rowIndex * 3, rowIndex * 3 + 3).map((unit) => (
            <article key={unit.id}>
              <header>
                <Link to={`/${params.uniId}/units/${unit.code}`}>
                  <h3>{unit.code}</h3>
                </Link>
              </header>
              <p>
                <strong>{unit.name}</strong>
              </p>
              <p>
                <small>
                  Level {unit.level} • {unit.creditPoints} Points •{" "}
                  {unit._count.reviews} reviews
                </small>
              </p>
              <p>
                <strong>Campuses:</strong>{" "}
                {unit.campuses.map((uc) => uc.campus.name).join(", ")}
              </p>
              <p>
                <strong>Semesters:</strong>{" "}
                {unit.semesters.map((us) => us.semester.name).join(", ")}
              </p>
            </article>
          ))}
        </div>
      ))}

      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "0.5rem",
            marginTop: "2rem",
          }}
        >
          <Link
            to={createPageUrl(1)}
            role="button"
            className={currentPage === 1 ? "secondary" : ""}
            style={{ textDecoration: "none" }}
          >
            {"<<"}
          </Link>
          <Link
            to={createPageUrl(currentPage - 1)}
            role="button"
            className={currentPage === 1 ? "secondary" : ""}
            style={{ textDecoration: "none" }}
          >
            {"<"}
          </Link>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }

            return (
              <Link
                key={pageNum}
                to={createPageUrl(pageNum)}
                role="button"
                className={currentPage === pageNum ? "" : "secondary"}
                style={{ textDecoration: "none" }}
              >
                {pageNum}
              </Link>
            );
          })}

          <Link
            to={createPageUrl(currentPage + 1)}
            role="button"
            className={currentPage === totalPages ? "secondary" : ""}
            style={{ textDecoration: "none" }}
          >
            {">"}
          </Link>
          <Link
            to={createPageUrl(totalPages)}
            role="button"
            className={currentPage === totalPages ? "secondary" : ""}
            style={{ textDecoration: "none" }}
          >
            {">>"}
          </Link>
        </div>
      )}
    </>
  );
}
