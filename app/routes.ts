import {
  type RouteConfig,
  index,
  layout,
  prefix,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("auth/login", "routes/auth.login.tsx"),
  route("auth/logout", "routes/auth.logout.tsx"),
  route("auth/verify", "routes/auth.verify.tsx"),
  route("units/:unitId", "routes/unit.tsx"),
] satisfies RouteConfig;
