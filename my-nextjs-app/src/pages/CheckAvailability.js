import { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import '../styles/CheckAvailability.css';

const CheckAvailability = () => {
  const [room, setRoom] = useState('');
  const [day, setDay] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [availability, setAvailability] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [filteredRooms, setFilteredRooms] = useState([]);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [error, setError] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    // Fetch room names from the database or a predefined list
    const fetchRooms = async () => {
      const response = await fetch('/api/room');
      const data = await response.json();
      setRooms(data);
    };

    fetchRooms();
  }, []);

  useEffect(() => {
    // Filter rooms based on user input
    setFilteredRooms(
      rooms.filter((r) => r.toLowerCase().includes(room.toLowerCase()))
    );
  }, [room, rooms]);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownRef]);

  useEffect(() => {
    const buttons = document.querySelectorAll('.glow-button');

    buttons.forEach(button => {
      button.addEventListener('mousemove', (e) => {
        const rect = button.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        button.style.setProperty('--x', `${x}px`);
        button.style.setProperty('--y', `${y}px`);
      });

      button.addEventListener('mouseleave', () => {
        button.style.setProperty('--x', `50%`);
        button.style.setProperty('--y', `50%`);
      });
    });

    return () => {
      buttons.forEach(button => {
        button.removeEventListener('mousemove', () => {});
        button.removeEventListener('mouseleave', () => {});
      });
    };
  }, []);

  const handleCheck = async (e) => {
    e.preventDefault();
    if (!room || !day || !startTime || !endTime) {
      setError('Please fill out all fields.');
      return;
    }
    setError('');
    const response = await fetch(`/api/check-availability?room=${room}&day=${day}&startTime=${startTime}&endTime=${endTime}`);
    const data = await response.json();
    setAvailability(data);
  };

  const handleReset = () => {
    setRoom('');
    setDay('');
    setStartTime('');
    setEndTime('');
    setAvailability(null);
    setError('');
  };

  const handleNow = () => {
    const now = new Date();
    const dayOptions = { weekday: 'long' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
    setDay(now.toLocaleDateString('en-US', dayOptions));
    setStartTime(now.toLocaleTimeString('en-US', timeOptions).slice(0, 5));
    setEndTime(now.toLocaleTimeString('en-US', timeOptions).slice(0, 5));
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start text-foreground pt-32 pb-12">
      <Header />
      <main className="flex-grow w-full max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-12 text-center">Check Room Availability</h1>
        <form onSubmit={handleCheck} className="grid grid-cols-2 gap-4">
          <div className="relative" ref={dropdownRef}>
            <label htmlFor="room" className="block text-sm font-medium text-gray-300">Room</label>
            <input
              type="text"
              id="room"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              onFocus={() => setDropdownVisible(true)}
              placeholder="Enter room name"
              className="w-full px-6 py-3 border border-[#482f1f] rounded-md bg-[#121212] text-white"
            />
            {dropdownVisible && filteredRooms.length > 0 && (
              <ul className="absolute z-10 w-full bg-[#121212] border border-[#482f1f] rounded-md mt-1 max-h-48 overflow-y-auto scrollbar-hide">
                {filteredRooms.map((r, index) => (
                  <li
                    key={index}
                    onClick={() => {
                      setRoom(r);
                      setDropdownVisible(false);
                    }}
                    className="px-6 py-2 cursor-pointer hover:bg-gray-700"
                  >
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label htmlFor="day" className="block text-sm font-medium text-gray-300">Day</label>
            <select
              id="day"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="w-full px-6 py-3 border border-[#482f1f] rounded-md bg-[#121212] text-white select-input"
            >
              <option value="">Select a day</option>
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
              <option value="Friday">Friday</option>
              <option value="Saturday">Saturday</option>
              <option value="Sunday">Sunday</option>
            </select>
          </div>
          <div>
            <label htmlFor="startTime" className="block text-sm font-medium text-gray-300">Start time</label>
            <input
              type="time"
              id="startTime"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-6 py-3 border border-[#482f1f] rounded-md bg-[#121212] text-white time-input"
            />
          </div>
          <div>
            <label htmlFor="endTime" className="block text-sm font-medium text-gray-300">End time</label>
            <input
              type="time"
              id="endTime"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-6 py-3 border border-[#482f1f] rounded-md bg-[#121212] text-white time-input"
            />
          </div>
          <div className="col-span-2 flex justify-between">
            <button type="submit" className="glow-button w-1/2 px-4 py-2 border-2 border-green-700 text-green-700 rounded-md hover:text-green-700 transition duration-200">
              Check Availability
            </button>
            <button type="button" onClick={handleNow} className="glow-button w-1/4 px-4 py-2 border-2 border-[#482f1f] text-white rounded-md hover:text-white transition duration-200 mx-2">
              Now
            </button>
            <button type="button" onClick={handleReset} className="glow-button w-1/4 px-4 py-2 border-2 border-red-700 text-red-700 rounded-md hover:text-red-700 transition duration-200">
              Reset
            </button>
          </div>
        </form>
        {error && (
          <div className="mt-8 p-4 rounded-md bg-yellow-100 border-yellow-500 border-l-4">
            <div className="flex items-center">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8.4449 0.608765C8.0183 -0.107015 6.9817 -0.107015 6.55509 0.608766L0.161178 11.3368C-0.275824 12.07 0.252503 13 1.10608 13H13.8939C14.7475 13 15.2758 12.07 14.8388 11.3368L8.4449 0.608765ZM7.4141 1.12073C7.45288 1.05566 7.54712 1.05566 7.5859 1.12073L13.9798 11.8488C14.0196 11.9154 13.9715 12 13.8939 12H1.10608C1.02849 12 0.980454 11.9154 1.02018 11.8488L7.4141 1.12073ZM6.8269 4.48611C6.81221 4.10423 7.11783 3.78663 7.5 3.78663C7.88217 3.78663 8.18778 4.10423 8.1731 4.48612L8.01921 8.48701C8.00848 8.766 7.7792 8.98664 7.5 8.98664C7.2208 8.98664 6.99151 8.766 6.98078 8.48701L6.8269 4.48611ZM8.24989 10.476C8.24989 10.8902 7.9141 11.226 7.49989 11.226C7.08567 11.226 6.74989 10.8902 6.74989 10.476C6.74989 10.0618 7.08567 9.72599 7.49989 9.72599C7.9141 9.72599 8.24989 10.0618 8.24989 10.476Z" fill="#b45309" fill-rule="evenodd" clip-rule="evenodd"></path>
              </svg>
              <p className="text-yellow-900 ml-2">{error}</p>
            </div>
          </div>
        )}
        {availability !== null && (
          <div className={`mt-8 p-4 rounded-md ${availability.available ? 'bg-green-100 border-green-500' : 'bg-red-100 border-red-500'} border-l-4`}>
            <div className="flex items-center">
              {availability.available ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7.49991 0.877045C3.84222 0.877045 0.877075 3.84219 0.877075 7.49988C0.877075 11.1575 3.84222 14.1227 7.49991 14.1227C11.1576 14.1227 14.1227 11.1575 14.1227 7.49988C14.1227 3.84219 11.1576 0.877045 7.49991 0.877045ZM1.82708 7.49988C1.82708 4.36686 4.36689 1.82704 7.49991 1.82704C10.6329 1.82704 13.1727 4.36686 13.1727 7.49988C13.1727 10.6329 10.6329 13.1727 7.49991 13.1727C4.36689 13.1727 1.82708 10.6329 1.82708 7.49988ZM10.1589 5.53774C10.3178 5.31191 10.2636 5.00001 10.0378 4.84109C9.81194 4.68217 9.50004 4.73642 9.34112 4.96225L6.51977 8.97154L5.35681 7.78706C5.16334 7.59002 4.84677 7.58711 4.64973 7.78058C4.45268 7.97404 4.44978 8.29061 4.64325 8.48765L6.22658 10.1003C6.33054 10.2062 6.47617 10.2604 6.62407 10.2483C6.77197 10.2363 6.90686 10.1591 6.99226 10.0377L10.1589 5.53774Z" fill="#15803d" fill-rule="evenodd" clip-rule="evenodd"></path>
                  </svg>
                  <p className="text-green-900 ml-2">Room is available</p>
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0.877075 7.49988C0.877075 3.84219 3.84222 0.877045 7.49991 0.877045C11.1576 0.877045 14.1227 3.84219 14.1227 7.49988C14.1227 11.1575 11.1576 14.1227 7.49991 14.1227C3.84222 14.1227 0.877075 11.1575 0.877075 7.49988ZM7.49991 1.82704C4.36689 1.82704 1.82708 4.36686 1.82708 7.49988C1.82708 10.6329 4.36689 13.1727 7.49991 13.1727C10.6329 13.1727 13.1727 10.6329 13.1727 7.49988C13.1727 4.36686 10.6329 1.82704 7.49991 1.82704ZM9.85358 5.14644C10.0488 5.3417 10.0488 5.65829 9.85358 5.85355L8.20713 7.49999L9.85358 9.14644C10.0488 9.3417 10.0488 9.65829 9.85358 9.85355C9.65832 10.0488 9.34173 10.0488 9.14647 9.85355L7.50002 8.2071L5.85358 9.85355C5.65832 10.0488 5.34173 10.0488 5.14647 9.85355C4.95121 9.65829 4.95121 9.3417 5.14647 9.14644L6.79292 7.49999L5.14647 5.85355C4.95121 5.65829 4.95121 5.3417 5.14647 5.14644C5.34173 4.95118 5.65832 4.95118 5.85358 5.14644L7.50002 6.79289L9.14647 5.14644C9.34173 4.95118 9.65832 4.95118 9.85358 5.14644Z" fill="#b91c1c" fill-rule="evenodd" clip-rule="evenodd"></path>
                  </svg>
                  <p className="text-red-900 ml-2">Room is not available</p>
                </>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default CheckAvailability;