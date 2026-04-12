import db from "~/modules/db/db.server";
import type { Route } from "./+types";

const DEFAULT_PAGE_SIZE = 10;
const ALLOWED_PAGE_SIZES = [10, 20, 50];

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
      },
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
      },
    );
  }

  const url = new URL(request.url);

  const name = (url.searchParams.get("name") || "").trim();
  const sortBy = url.searchParams.get("sortBy") || "name";
  const rawPage = parseInt(url.searchParams.get("page") || "1", 10);
  const rawPageSize = parseInt(
    url.searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE),
    10,
  );

  const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  const validPageSize = ALLOWED_PAGE_SIZES.includes(rawPageSize)
    ? rawPageSize
    : DEFAULT_PAGE_SIZE;

  const where = name
    ? {
        name: {
          contains: name,
          mode: "insensitive" as const,
        },
      }
    : {};

  const totalCount = await db.university.count({ where });
  const totalPages = Math.ceil(totalCount / validPageSize);

  const orderBy: any =
    sortBy === "unitCount"
      ? {
          units: {
            _count: "desc",
          },
        }
      : {
          name: "asc",
        };

  const universities = await db.university.findMany({
    where,
    select: {
      id: true,
      name: true,
      handbookUrl: true,
      _count: {
        select: {
          units: true,
          faculties: true,
          campuses: true,
          semesters: true,
          users: true,
        },
      },
    },
    orderBy,
    skip: (page - 1) * validPageSize,
    take: validPageSize,
  });

  return new Response(
    JSON.stringify({
      universities,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        pageSize: validPageSize,
      },
      filters: {
        name,
        sortBy: sortBy === "unitCount" ? "unitCount" : "name",
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
    },
  );
}
