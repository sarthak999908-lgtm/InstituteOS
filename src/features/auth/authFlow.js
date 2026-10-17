export const INSTITUTE_STAFF_ROLES = Object.freeze(["owner", "counselor", "trainer", "accounts"]);

export function createAuthorizedInstituteSession(user, context) {
  if (!user?.id || !context?.user_id || !context?.institute_id || !INSTITUTE_STAFF_ROLES.includes(context.role)) return null;
  return {
    role: context.role,
    user: { ...user, instituteUserId: context.user_id },
    context,
  };
}

export function routeAuthorizedInstituteSession(user, context, { onRoleChange, onLogin } = {}) {
  const authorization = createAuthorizedInstituteSession(user, context);
  if (!authorization) return null;
  onRoleChange?.(authorization.role, authorization.user);
  onLogin?.(authorization.user, authorization.role, authorization.context);
  return authorization;
}
