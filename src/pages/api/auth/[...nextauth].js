import NextAuth from 'next-auth';
import GithubProvider from 'next-auth/providers/github';

export default NextAuth({
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Only allow specific GitHub users
      const ALLOWED_USERS = ['tahayparker'];
      return ALLOWED_USERS.includes(user.login);
    },
    async jwt({ token, user }) {
      if (user) {
        token.login = user.login;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.login) {
        session.user.login = token.login;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
}); 