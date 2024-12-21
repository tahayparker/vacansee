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
      setMinWidth(longestRoomName.length * 10);
    };

    fetchRooms();
  }, []);

  useEffect(() => {
    // Set the current time and day only on the client side
    const now = new Date();
    setCurrentTime(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setCurrentDay(now.toLocaleDateString('en-GB', { weekday: 'long' }));
  }, []);

  return (
    <div className="w-full flex flex-col items-center justify-start">
      <h1 className="text-4xl font-bold mb-4 text-center animate-[slideUp_0.5s_ease-out]">
        Currently Available Rooms
      </h1>
      <p className="text-lg mb-4 text-center animate-[fadeIn_0.5s_ease-out]">
        As of {currentDay}, {currentTime}
      </p>
      <ul
        className="w-full grid gap-4 px-4"
        style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))` }}
      >
        {rooms.map((room, index) => (
          <li
            key={index}
            className="bg-[#121212] rounded-lg shadow-lg p-4 border border-[#482f1f] hover-scale transition-all duration-300 list-animation"
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
  );
};

export default RoomList;