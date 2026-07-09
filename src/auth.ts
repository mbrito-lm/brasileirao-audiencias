import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { recordAccess } from "@/lib/accessLog";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const email = user?.email ?? "";
      if (!email.endsWith("@livemode.com")) return false;
      await recordAccess(email, user?.name);
      return true;
    },
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
