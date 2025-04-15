import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("auth/login", "routes/auth.login.tsx"),
  route("auth/logout", "routes/auth.logout.tsx"),
  route("auth/verify", "routes/auth.verify.tsx"),
  route("search", "routes/search.tsx"),
  route("about", "routes/about.tsx"),
  route("profile", "routes/profile.tsx"),
  route("admin", "routes/admin.tsx"),
  route("units/:unitCode", "routes/unit.tsx"),
] satisfies RouteConfig;
