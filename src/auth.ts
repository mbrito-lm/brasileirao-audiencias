import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      return !!profile?.email?.endsWith("@livemode.com");
    },
    async session({ session, token }) {
      return session;
    },
    async jwt({ token, profile }) {
      return token;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
