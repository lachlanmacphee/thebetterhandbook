import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/index.tsx"),
  route("api/units", "routes/api.units.tsx"),

  route("auth/login", "routes/auth.login.tsx"),
  route("auth/logout", "routes/auth.logout.tsx"),
  route("auth/verify", "routes/auth.verify.tsx"),

  route("about", "routes/about.tsx"),
  route("profile", "routes/profile.tsx"),

  route(":uniId", "routes/uni-home.tsx"),
  route(":uniId/search", "routes/uni-search.tsx"),
  route(":uniId/units/:unitCode", "routes/uni-unit.tsx"),
  route(":uniId/units/:unitCode/review", "routes/review.tsx", {
    id: "review-create",
  }),

  route("reviews/:reviewId", "routes/review.tsx", { id: "review-edit" }),

  route("admin", "routes/admin.tsx"),
] satisfies RouteConfig;
