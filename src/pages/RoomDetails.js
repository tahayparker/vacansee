import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const scrollbarHideStyles = `
  .scrollbar-hide {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;     /* Firefox */
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;            /* Chrome, Safari and Opera */
  }
`;

const RoomDetails = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const capacityMap = {
    '3.42': '37',
    '3.44': '110',
    '3.45': '42',
    '3.46': '50',
    '3.48': '40',
    '4.44': '110',
    '4.45': '40',
    '4.467': '100',
    '4.48': '40',
    '4.50': '42',
    '4.51': '25',
    '4.52': '35',
    '4.53': '12',
    '5.08': '16',
    '5.10': '37',
    '5.11': '110',
    '5.12': '35',
    '5.134': '100',
    '5.17': '42',
    '5.18': '45',
    '5.19': '70',
    '6.28': '25',
    '6.29': '25',
    '6.30': '25',
    '6.32': '110',
    '6.33': '35',
    '6.345': '110',
    '6.38': '42',
    '6.39': '60'
  };

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/room');
        if (!response.ok) {
          throw new Error('Failed to fetch rooms');
        }
        const roomNames = await response.json();
        
        // Process rooms to include code and capacity
        const processedRooms = roomNames
          .filter(roomName => !roomName.includes('Consultation') && !roomName.includes('Online'))
          .map(roomName => {
          const code = roomName.includes('-') ? roomName.split('-')[0] : roomName;
          return {
            code,
            name: roomName,
            capacity: capacityMap[code] || '--'
          };
        });

        // Sort by room name
        processedRooms.sort((a, b) => {
          const aNum = parseFloat(a.name);
          const bNum = parseFloat(b.name);
          return aNum - bNum;
        });

        setRooms(processedRooms);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, []);

  useEffect(() => {
    // Add the styles to the document
    const styleSheet = document.createElement("style");
    styleSheet.innerText = scrollbarHideStyles;
    document.head.appendChild(styleSheet);

    // Cleanup function
    return () => {
      document.head.removeChild(styleSheet);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col page-transition">
        <Header />
        <main className="flex-grow w-full max-w-6xl mx-auto px-4 pb-16 pt-24">
          <div className="flex items-center justify-center">
            <div className="animate-spin mt-12 rounded-full h-12 w-12 border-b-2 border-[#006D5B]"></div>
          </div>
        </main>
        <Footer className="mt-auto" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col page-transition">
        <Header />
        <main className="flex-grow w-full max-w-6xl mx-auto px-4 pb-16 pt-24">
          <div className="text-red-600 text-center">
            Error loading rooms: {error}
          </div>
        </main>
        <Footer className="mt-auto" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col page-transition">
      <Header />
      <main className="flex-grow w-full max-w-6xl mx-auto px-4 pb-16 pt-24 flex flex-col items-center">
        <h1 className="text-4xl font-bold mb-8 mt-12 text-center text-white animate-[slideUp_0.5s_ease-out]">Room Details</h1>
        <div className="overflow-x-auto rounded-lg border border-[#482F1F] w-full max-w-4xl scrollbar-hide">
          <table className="min-w-full shadow-lg">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-sm font-bold text-gray-300 uppercase tracking-wider border-b border-[#482F1F] border-r border-r-[#482F1F]">
                  Name
                </th>
                <th className="px-6 py-3 text-center text-sm font-bold text-gray-300 uppercase tracking-wider border-b border-[#482F1F] border-r border-r-[#482F1F]">
                  Room Code
                </th>
                <th className="px-6 py-3 text-center text-sm font-bold text-gray-300 uppercase tracking-wider border-b border-[#482F1F]">
                  Capacity
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#482F1F]">
              {rooms.map((room, index) => (
                <tr 
                  key={index} 
                  className="hover:shadow-[0_0_10px_rgba(0,109,91,0.3)] transition-all duration-150"
                  style={{
                    animation: 'fadeIn 0.5s ease-out forwards',
                    animationDelay: `${index * 0.05}s`,
                    opacity: 0
                  }}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 border-r border-[#482F1F] text-left">
                    {room.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 border-r border-[#482F1F] text-center">
                    {room.code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 text-center">
                    {room.capacity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      <Footer className="mt-auto" />
    </div>
  );
};

// Add the keyframes for the animations
const styles = `
  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

// Add the styles to the document
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

export default RoomDetails; 