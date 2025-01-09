import Header from '../components/Header';
import Footer from '../components/Footer';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/router';

const styles = {
  glowButton: {
    position: "relative",
    overflow: "hidden"
  }
};

const Unauthorized = () => {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/');
  };

  return (
    <>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center space-y-8 -mt-24">
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold text-white">Unauthorized Access</h1>
              <p className="text-gray-400 max-w-2xl">
                Your account is not authorized to access this system. 
                Please contact the administrator if you believe this is a mistake.
              </p>
            </div>
            
            <div className="flex flex-col gap-4 w-full max-w-md">
              <button
                onClick={handleSignOut}
                className="glow-button w-full px-6 py-3 border-2 border-red-700 text-red-700 rounded-full hover:text-red-700 transition-all duration-200 flex items-center justify-center whitespace-nowrap"
                style={styles.glowButton}
              >
                <svg className="w-5 h-5 mr-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="flex-shrink-0">Sign Out</span>
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </div>

      <style jsx>{`
        .glow-button::before {
          content: '';
          position: absolute;
          top: var(--y, 50%);
          left: var(--x, 50%);
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(220, 38, 38, 0.3) 0%, transparent 60%);
          transition: opacity 0.2s;
          transform: translate(-50%, -50%);
          pointer-events: none;
          opacity: 0;
          z-index: 0;
        }

        .glow-button:hover::before {
          opacity: 1;
        }

        .glow-button > * {
          position: relative;
          z-index: 1;
        }
      `}</style>
    </>
  );
};

export default Unauthorized; 