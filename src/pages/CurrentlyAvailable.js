import RoomList from '../components/RoomList';
import Header from '../components/Header';
import Footer from '../components/Footer';

const CurrentlyAvailable = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4">
        <RoomList />
      </main>
      <Footer />
    </div>
  );
};

export default CurrentlyAvailable;