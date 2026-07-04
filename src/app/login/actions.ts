"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signToken } from "@/lib/auth";

export async function login(_: unknown, formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";

  if (!email.endsWith("@livemode.com")) {
    return { error: "Acesso permitido apenas para e-mails @livemode.com" };
  }

  const token = signToken(email);
  const jar = await cookies();
  jar.set("auth", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  });

  redirect("/geral");
}

export async function logout() {
  const jar = await cookies();
  jar.delete("auth");
  redirect("/login");
}
