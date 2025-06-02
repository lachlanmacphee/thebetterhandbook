import { Link, useLocation } from "react-router";
import type { Route } from "./+types/search";
import db from "~/modules/db/db.server";
import { getSession } from "~/modules/auth/session.server";
import { Form } from "react-router";
import { Prisma } from "@prisma/client";

// Default and allowed page sizes
const DEFAULT_PAGE_SIZE = 12;
const ALLOWED_PAGE_SIZES = [12, 24, 36];

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request.headers.get("Cookie"));
  const user = session.get("id");
  const url = new URL(request.url);

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
    url.searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE)
  );

  // Validate page size
  const validPageSize = ALLOWED_PAGE_SIZES.includes(pageSize)
    ? pageSize
    : DEFAULT_PAGE_SIZE;

  // Fetch reference data for dropdowns
  const [faculties, campuses, semesters] = await Promise.all([
    db.faculty.findMany({ orderBy: { name: "asc" } }),
    db.campus.findMany({ orderBy: { name: "asc" } }),
    db.semester.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Build the where clause based on filters
  const where = {
    AND: [
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
            userId: user,
          },
        },
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
            userId: user,
          },
        },
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

export default function Search({ loaderData }: Route.ComponentProps) {
  const { units, faculties, campuses, semesters, filters, pagination } =
    loaderData;
  const { currentPage, totalPages, totalCount, pageSize } = pagination;
  const location = useLocation();

  // Create URL with current filters for pagination
  const createPageUrl = (pageNum: number) => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set("page", pageNum.toString());
    // Ensure pageSize is preserved in pagination links
    if (!searchParams.has("pageSize")) {
      searchParams.set("pageSize", String(pageSize));
    }
    return `${location.pathname}?${searchParams.toString()}`;
  };

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4 py-8">
      <div className="space-y-8">
        <div className="card bg-base-100 shadow-lg rounded-xl overflow-hidden">
          <div className="card-body p-4 md:p-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-6">
              Advanced Unit Search
            </h1>
            <Form method="get" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-sm">Unit Code</span>
                  </label>
                  <input
                    type="text"
                    name="code"
                    defaultValue={filters.code}
                    placeholder="e.g. FIT1008"
                    className="input input-bordered input-sm md:input-md w-full"
                  />
                </div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-sm">Unit Name</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={filters.name}
                    placeholder="e.g. Introduction to CS"
                    className="input input-bordered input-sm md:input-md w-full"
                  />
                </div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-sm">Faculty</span>
                  </label>
                  <select
                    name="faculty"
                    defaultValue={filters.faculty}
                    className="select select-bordered select-sm md:select-md w-full"
                  >
                    <option value="">All Faculties</option>
                    {faculties.map((faculty) => (
                      <option key={faculty.id} value={faculty.id}>
                        {faculty.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-sm">Level</span>
                  </label>
                  <select
                    name="level"
                    defaultValue={filters.level}
                    className="select select-bordered select-sm md:select-md w-full"
                  >
                    <option value="">All Levels</option>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <option key={level} value={level}>
                        Level {level}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-sm">Credit Points</span>
                  </label>
                  <select
                    name="creditPoints"
                    defaultValue={filters.creditPoints}
                    className="select select-bordered select-sm md:select-md w-full"
                  >
                    <option value="">Any Credit Points</option>
                    {[6, 12].map((points) => (
                      <option key={points} value={points}>
                        {points} Points
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-sm">Campus</span>
                  </label>
                  <select
                    name="campus"
                    defaultValue={filters.campus}
                    className="select select-bordered select-sm md:select-md w-full"
                  >
                    <option value="">All Campuses</option>
                    {campuses.map((campus) => (
                      <option key={campus.id} value={campus.id}>
                        {campus.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-sm">Semester</span>
                  </label>
                  <select
                    name="semester"
                    defaultValue={filters.semester}
                    className="select select-bordered select-sm md:select-md w-full"
                  >
                    <option value="">All Semesters</option>
                    {semesters.map((semester) => (
                      <option key={semester.id} value={semester.id}>
                        {semester.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-sm">Sort By</span>
                  </label>
                  <select
                    name="sortBy"
                    defaultValue={filters.sortBy}
                    className="select select-bordered select-sm md:select-md w-full"
                  >
                    <option value="code">Unit Code</option>
                    <option value="name">Unit Name</option>
                    <option value="rating">Average Rating</option>
                    <option value="reviews">Number of Reviews</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-sm">Items per Page</span>
                  </label>
                  <select
                    name="pageSize"
                    defaultValue={filters.pageSize}
                    className="select select-bordered select-sm md:select-md w-full"
                  >
                    {ALLOWED_PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size} Items
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-4">
                <Link to="/search" reloadDocument className="btn btn-ghost">
                  Clear
                </Link>
                <button type="submit" className="btn btn-primary">
                  Search
                </button>
              </div>
            </Form>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-bold">
            Search Results ({totalCount} units)
          </h2>

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
                      <h3 className="text-2xl font-semibold">{unit.code}</h3>
                      <p className="text-base text-base-content/70">
                        {unit.name}
                      </p>
                      <p className="text-sm text-base-content/60">
                        Level {unit.level} • {unit.creditPoints} Points •{" "}
                        {unit._count.reviews} reviews
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {unit.campuses.map((uc) => (
                        <span
                          key={uc.campus.id}
                          className="badge badge-primary"
                        >
                          {uc.campus.name}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {unit.semesters.map((us) => (
                        <span
                          key={us.semester.id}
                          className="badge badge-secondary h-min"
                        >
                          {us.semester.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <Link
                to={createPageUrl(1)}
                className={`btn btn-sm ${
                  currentPage === 1 ? "btn-disabled" : ""
                }`}
              >
                «
              </Link>
              <Link
                to={createPageUrl(currentPage - 1)}
                className={`btn btn-sm ${
                  currentPage === 1 ? "btn-disabled" : ""
                }`}
              >
                ‹
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
                    className={`btn btn-sm ${
                      currentPage === pageNum ? "btn-active" : ""
                    }`}
                  >
                    {pageNum}
                  </Link>
                );
              })}

              <Link
                to={createPageUrl(currentPage + 1)}
                className={`btn btn-sm ${
                  currentPage === totalPages ? "btn-disabled" : ""
                }`}
              >
                ›
              </Link>
              <Link
                to={createPageUrl(totalPages)}
                className={`btn btn-sm ${
                  currentPage === totalPages ? "btn-disabled" : ""
                }`}
              >
                »
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
