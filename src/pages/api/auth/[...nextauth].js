import NextAuth from 'next-auth';
import GithubProvider from 'next-auth/providers/github';

// Add your GitHub username(s) here
const ALLOWED_USERS = ['tahayparker'];

const authOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name || profile.login,
          email: profile.email,
          image: profile.avatar_url,
          login: profile.login,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === 'github') {
        const isAllowed = ALLOWED_USERS.includes(profile.login);
        console.log(`Sign in attempt by: ${profile.login}, allowed: ${isAllowed}`);
        return isAllowed;
      }
      return false;
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === 'github') {
        token.login = profile.login;
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
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
export { authOptions }; 