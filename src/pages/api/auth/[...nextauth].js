import NextAuth from 'next-auth';
import GithubProvider from 'next-auth/providers/github';

// Add your GitHub username(s) here
const ALLOWED_USERS = ['tahayparker'];

export default NextAuth({
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
          login: profile.login, // Add GitHub username to profile
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      // Check if it's a GitHub sign in
      if (account?.provider === 'github') {
        const isAllowed = ALLOWED_USERS.includes(profile.login);
        console.log(`Sign in attempt by: ${profile.login}, allowed: ${isAllowed}`);
        return isAllowed;
      }
      return false; // Deny all other providers
    },
    async jwt({ token, account, profile }) {
      // Add GitHub username to the token on first sign in
      if (account?.provider === 'github') {
        token.login = profile.login;
      }
      return token;
    },
    async session({ session, token }) {
      // Add GitHub username to the session
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
  debug: process.env.NODE_ENV === 'development',
}); 