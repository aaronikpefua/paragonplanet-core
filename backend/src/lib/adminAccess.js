export function isAdminUser(user) {
  return Boolean(user?.admin === true || user?.role === "admin");
}
