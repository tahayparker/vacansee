import { useState, useEffect } from 'react';
import RoomList from '../components/RoomList';
import Header from '../components/Header';
import Footer from '../components/Footer';

const CurrentlyAvailable = () => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    const fetchData = async () => {
      // Set loading to true before fetching
      setLoading(true);
      // Simulate a delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      // Set loading to false after fetching
      setLoading(false);
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen flex flex-col page-transition">
      <Header />
      <main className="flex-grow w-full max-w-6xl mx-auto px-0 sm:px-4 pb-16 pt-24">
        <div className="w-full flex items-center justify-center">
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin mt-12 rounded-full h-12 w-12 border-b-2 border-[#006D5B]"></div>
            </div>
          ) : (
            <RoomList />
          )}
        </div>
      </main>
      <Footer className="mt-auto" />
    </div>
  );
};

export default CurrentlyAvailable;