import RoomList from '../components/RoomList';
import Header from '../components/Header';
import Footer from '../components/Footer';

const CurrentlyAvailable = () => {
  return (
    <div className="min-h-screen flex flex-col page-transition">
      <Header />
      <main className="flex-grow w-full max-w-6xl mx-auto px-4 pb-16">
        <RoomList />
      </main>
      <Footer className="mt-auto" />
    </div>
  );
};

export default CurrentlyAvailable;