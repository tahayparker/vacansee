import NextAuth from 'next-auth';
import GithubProvider from 'next-auth/providers/github';

export const authOptions = {
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
    async jwt({ token: _token, user }) {
      if (user) {
        _token.login = user.login;
      }
      return _token;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
};

export default NextAuth(authOptions); 