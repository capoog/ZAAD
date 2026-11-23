import "server-only";
import { redirect } from "next/navigation";
import { getSession, type Session, type StaffRole } from "./session";

export const STAFF: StaffRole[] = ["owner", "manager", "kitchen", "driver"];
export const MANAGERS: StaffRole[] = ["owner", "manager"];

/** For admin pages: redirect to the staff login when not authorised. */
export async function requireStaffPage(locale: string, roles: StaffRole[] = STAFF): Promise<Session> {
  const session = await getSession();
  const prefix = locale === "en" ? "/en" : "";
  if (!session || session.roles.length === 0) redirect(`${prefix}/admin/login`);
  if (!session.roles.some((r) => roles.includes(r))) redirect(`${prefix}/admin/orders?forbidden=1`);
  return session;
}

export class ForbiddenError extends Error {
  constructor() {
    super("FORBIDDEN");
  }
}

/** For server actions / route handlers: throw when not authorised. */
export async function requireStaff(roles: StaffRole[] = STAFF): Promise<Session> {
  const session = await getSession();
  if (!session || !session.roles.some((r) => roles.includes(r))) throw new ForbiddenError();
  return session;
}
