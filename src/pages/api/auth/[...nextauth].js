import NextAuth from 'next-auth';
import GithubProvider from 'next-auth/providers/github';

// Add your GitHub username(s) here
const ALLOWED_USERS = ['tahayparker'];

export const authOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
  ],
  debug: true,
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account, profile }) {
      // Check if the user's GitHub username is in the allowed list
      const isAllowed = ALLOWED_USERS.includes(profile.login);
      
      if (!isAllowed) {
        console.log(`Unauthorized sign in attempt by: ${profile.login}`);
        return false;
      }
      
      console.log(`Authorized sign in by: ${profile.login}`);
      return true;
    },
    async session({ session, token }) {
      // Add GitHub username to the session
      if (session?.user) {
        session.user.username = token.username;
      }
      return session;
    },
    async jwt({ token, account, profile }) {
      // Add GitHub username to the token
      if (profile) {
        token.username = profile.login;
      }
      return token;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  logger: {
    error(code, ...message) {
      console.error(code, message);
    },
    warn(code, ...message) {
      console.warn(code, message);
    },
    debug(code, ...message) {
      console.debug(code, message);
    },
  },
};

export default NextAuth(authOptions); 