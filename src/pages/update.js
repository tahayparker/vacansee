import { useSession, signOut, getSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../components/Header';
import Footer from '../components/Footer';

export async function getServerSideProps(context) {
  const session = await getSession(context);

  if (!session) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    };
  }

  return {
    props: { session }
  };
}

export default function Update({ session: serverSession }) {
  const { data: clientSession, status } = useSession();
  const router = useRouter();
  const [updateStatus, setUpdateStatus] = useState('idle');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const handleUpdate = async () => {
    try {
      setUpdateStatus('updating');
      setError(null);

      const response = await fetch('/api/update-timetable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to update timetable');
      }

      setUpdateStatus('success');
    } catch (err) {
      console.error('Update failed:', err);
      setError(err.message);
      setUpdateStatus('error');
    }
  };

  // Show loading state while checking session
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-grow flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
        </main>
        <Footer />
      </div>
    );
  }

  // Use server session as fallback
  const session = clientSession || serverSession;

  // Redirect if no session
  if (!session) {
    if (typeof window !== 'undefined') {
      router.push('/auth/signin');
    }
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col page-transition">
      <Header />
      <main className="flex-grow w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">Update Timetables</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-300">Signed in as {session.user.name}</span>
            <button
              onClick={() => signOut()}
              className="px-4 py-2 border-2 border-red-700 text-red-700 rounded-full hover:bg-red-700/10 transition-all duration-200"
            >
              Sign Out
            </button>
          </div>
        </div>
        
        <div className="bg-[#121212] border border-[#482f1f] rounded-lg p-6 shadow-lg space-y-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Update Process</h2>
            <p className="text-gray-300">
              Click the button below to update the timetable data. Make sure you&apos;re logged into UOW Dubai in your browser.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <button
              onClick={handleUpdate}
              disabled={updateStatus === 'updating'}
              className={`w-full flex justify-center py-3 px-4 border-2 border-[#006D5B] text-[#006D5B] hover:bg-[#006D5B]/10 font-medium rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#006D5B] transition-all duration-200 ${
                updateStatus === 'updating' ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {updateStatus === 'updating' ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-[#006D5B]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </span>
              ) : 'Update Timetables'}
            </button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-red-900/50 border-l-4 border-red-600 text-red-200">
              {error}
            </div>
          )}

          {updateStatus === 'success' && (
            <div className="mt-4 p-4 bg-green-900/50 border-l-4 border-green-600 text-green-200">
              Timetable data has been successfully updated!
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
} 