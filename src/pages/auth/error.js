import { useRouter } from 'next/router';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

const AuthError = () => {
  const router = useRouter();
  const { error } = router.query;

  const getErrorMessage = (error) => {
    switch (error) {
      case 'AccessDenied':
        return 'You are not authorized to access this page. Only specific GitHub users are allowed.';
      case 'Configuration':
        return 'There is a problem with the server configuration.';
      default:
        return 'An error occurred during authentication.';
    }
  };

  return (
    <div className="min-h-screen flex flex-col page-transition">
      <Header />
      <main className="flex-grow flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
              Authentication Error
            </h2>
            <p className="mt-2 text-center text-sm text-red-400">
              {getErrorMessage(error)}
            </p>
          </div>
          <div className="mt-8">
            <button
              onClick={() => router.push('/')}
              className="w-full flex justify-center py-3 px-4 border-2 border-[#006D5B] text-[#006D5B] font-medium rounded-full hover:bg-[#006D5B]/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#006D5B] transition-all duration-200"
            >
              Return to Home
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AuthError; 