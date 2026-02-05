export const getAdminEmails = () =>
  (process.env.CLAWOPS_ADMIN_EMAILS ?? "")
    .split(/[,;\n]/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const isClawOpsAdmin = (email?: string | null) => {
  if (!email) return false;
  const allowed = getAdminEmails();
  if (allowed.length === 0) return false;
  return allowed.includes(email.trim().toLowerCase());
};
