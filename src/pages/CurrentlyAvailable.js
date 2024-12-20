import RoomList from '../components/RoomList';
import Header from '../components/Header';
import Footer from '../components/Footer';

const CurrentlyAvailable = () => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        <RoomList />
      </main>
      <Footer />
    </div>
  );
};

export default CurrentlyAvailable;