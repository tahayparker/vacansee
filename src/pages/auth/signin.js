import { signIn } from 'next-auth/react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export default function SignIn() {
  const handleSignIn = async () => {
    try {
      const result = await signIn('github', { callbackUrl: '/update' });
      if (result?.error) {
        console.error('Sign in error:', result.error);
      }
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col page-transition">
      <Header />
      <main className="flex-grow flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-[#121212] border border-[#482f1f] rounded-lg p-8 shadow-lg space-y-6">
            <h1 className="text-2xl font-bold text-white text-center">Sign In Required</h1>
            <p className="text-gray-300 text-center">
              Please sign in with GitHub to access the update page.
            </p>
            <button
              onClick={handleSignIn}
              className="w-full flex justify justify-center py-3 px-4 border-2 border-[#006D5B] text-[#006D5B] hover:bg-[#006D5B]/10 font-medium rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#006D5B] transition-all duration-200"
            >
              Sign in with GitHub
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
} 