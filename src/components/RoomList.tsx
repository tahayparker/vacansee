import { useState, useEffect } from 'react';

const RoomList = () => {
  const [rooms, setRooms] = useState([]);
  const [minWidth, setMinWidth] = useState(0);
  const [currentTime, setCurrentTime] = useState('');
  const [currentDay, setCurrentDay] = useState('');

  useEffect(() => {
    const fetchRooms = async () => {
      const response = await fetch('/api/rooms');
      const data = await response.json();
      setRooms(data);

      const longestRoomName = data.reduce((max: string, room: string) => (room.length > max.length ? room : max), '');
      setMinWidth(longestRoomName.length * 6);
    };

    fetchRooms();
  }, []);

  useEffect(() => {
    const now = new Date();
    setCurrentTime(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setCurrentDay(now.toLocaleDateString('en-GB', { weekday: 'long' }));
  }, []);

  return (
    <div className="w-full flex flex-col items-center justify-start">
      <h1 className="text-4xl text-white font-bold mb-4 mt-12 text-center animate-[slideUp_0.5s_ease-out]">
        Currently Available Rooms
      </h1>
      <p className="text-lg mb-4 text-center animate-[fadeIn_0.5s_ease-out] text-white">
        As of {currentDay}, {currentTime}
      </p>
      <div className="w-full max-w-6xl mx-auto px-4">
        <ul
          className="grid gap-4"
          style={{ 
            gridTemplateColumns: `repeat(auto-fit, minmax(${Math.max(minWidth, 140)}px, 1fr))`,
          }}
        >
          {rooms.map((room, index) => (
            <li
              key={index}
              className="bg-[#00000000] text-white md:text-left text-center rounded-lg shadow-lg p-3 border border-[#482f1f] hover-scale transition-all duration-300 list-animation"
              style={{ 
                animationDelay: `${index * 0.05}s`,
                transform: 'translateY(0)',
                opacity: 1
              }}
            >
              {room}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default RoomList;