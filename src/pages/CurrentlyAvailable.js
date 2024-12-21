import RoomList from '../components/RoomList';
import Header from '../components/Header';
import Footer from '../components/Footer';

const CurrentlyAvailable = () => {
  return (
    <div className="min-h-screen flex flex-col page-transition">
      <Header />
      <main className="flex-grow w-full max-w-6xl mx-auto px-0 sm:px-4 pb-16 pt-24">
        <div className="w-full flex items-center justify-center">
          <RoomList />
        </div>
      </main>
      <Footer className="mt-auto" />
    </div>
  );
};

export default CurrentlyAvailable;