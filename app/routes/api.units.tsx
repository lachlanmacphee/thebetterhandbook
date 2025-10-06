import { Prisma } from "@prisma/client";
import db from "~/modules/db/db.server";
import type { Route } from "./+types/search";

const DEFAULT_PAGE_SIZE = 12;
const ALLOWED_PAGE_SIZES = [12, 24, 36];

export async function loader({ request }: Route.LoaderArgs) {
  const apiKey = request.headers.get("Authorization")?.replace("Bearer ", "");

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: "API key required",
        message: "Please provide your API key via the Authorization header.",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const user = await db.user.findFirst({
    where: { apiKey },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    return new Response(
      JSON.stringify({
        error: "Invalid API key",
        message: "The provided API key is not valid",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

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
        reviews: true,
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
        reviews: true,
        _count: {
          select: { reviews: true },
        },
      },
      orderBy,
      skip: (page - 1) * validPageSize,
      take: validPageSize,
    });
  }

  return new Response(
    JSON.stringify({
      units,
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
      authenticated_user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
