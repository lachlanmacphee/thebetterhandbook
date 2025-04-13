import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("search", "routes/search.tsx"),
  route("auth/login", "routes/auth.login.tsx"),
  route("auth/logout", "routes/auth.logout.tsx"),
  route("auth/verify", "routes/auth.verify.tsx"),
  route("units/:unitCode", "routes/unit.tsx"),
] satisfies RouteConfig;
