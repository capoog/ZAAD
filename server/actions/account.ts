"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "../auth/session";
import { asUser } from "../db";
import * as s from "../db/schema";

/** Address changes run through RLS as the signed-in user (they can only touch their own rows). */
export async function deleteAddressAction(id: unknown): Promise<boolean> {
  const parsed = z.string().uuid().safeParse(id);
  const session = await getSession();
  if (!parsed.success || !session) return false;
  const rows = await asUser(session.userId, (tx) => tx.delete(s.addresses).where(eq(s.addresses.id, parsed.data)).returning({ id: s.addresses.id }));
  revalidatePath("/[locale]/orders", "page");
  return rows.length > 0;
}

export async function makeDefaultAddressAction(id: unknown): Promise<boolean> {
  const parsed = z.string().uuid().safeParse(id);
  const session = await getSession();
  if (!parsed.success || !session) return false;
  await asUser(session.userId, async (tx) => {
    await tx.update(s.addresses).set({ isDefault: false }).where(and(eq(s.addresses.userId, session.userId), eq(s.addresses.isDefault, true)));
    await tx.update(s.addresses).set({ isDefault: true }).where(eq(s.addresses.id, parsed.data));
  });
  revalidatePath("/[locale]/orders", "page");
  return true;
}
