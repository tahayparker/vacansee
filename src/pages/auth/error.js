import { useRouter } from 'next/router';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export default function Error() {
  const router = useRouter();
  const { error } = router.query;

  let errorMessage = 'An error occurred during authentication.';
  if (error === 'AccessDenied') {
    errorMessage = 'Access denied. You are not authorized to access this page.';
  }

  return (
    <div className="min-h-screen flex flex-col page-transition">
      <Header />
      <main className="flex-grow flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-[#121212] border border-[#482f1f] rounded-lg p-8 shadow-lg space-y-6">
            <h1 className="text-2xl font-bold text-white text-center">Authentication Error</h1>
            <p className="text-gray-300 text-center">
              {errorMessage}
            </p>
            <button
              onClick={() => router.push('/auth/signin')}
              className="w-full flex justify-center py-3 px-4 border-2 border-[#006D5B] text-[#006D5B] hover:bg-[#006D5B]/10 font-medium rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#006D5B] transition-all duration-200"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
} 