import { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const styles = {
  timeInput: {
    WebkitAppearance: 'none',
    MozAppearance: 'textfield',
    "&::-webkit-calendar-picker-indicator": {
      filter: "invert(1)",
      marginRight: "-12px"
    }
  },
  selectInput: {
    paddingRight: "30px",
    marginRight: "1rem",
    backgroundPosition: "right 1rem center",
    backgroundRepeat: "no-repeat",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='white' class='bi bi-chevron-down' viewBox='0 0 16 16'%3E%3Cpath fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/%3E%3C/svg%3E")`,
    MozAppearance: "none",
    WebkitAppearance: "none"
  },
  glowButton: {
    position: "relative",
    overflow: "hidden"
  }
};

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
        button.removeEventListener('mousemove', () => { });
        button.removeEventListener('mouseleave', () => { });
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
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow w-full max-w-3xl mx-auto mt-32 pb-12">
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
              className="w-full px-6 py-3 border border-[#482f1f] rounded-md bg-[#121212] text-white"
              style={styles.selectInput}
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
              className="w-full px-6 py-3 border border-[#482f1f] rounded-md bg-[#121212] text-white"
              style={styles.timeInput}
            />
          </div>
          <div>
            <label htmlFor="endTime" className="block text-sm font-medium text-gray-300">End time</label>
            <input
              type="time"
              id="endTime"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-6 py-3 border border-[#482f1f] rounded-md bg-[#121212] text-white"
              style={styles.timeInput}
            />
          </div>
          <div className="col-span-2 flex justify-between">
            <button 
              type="submit" 
              className="glow-button w-1/2 px-4 py-2 border-2 border-green-700 text-green-700 rounded-md hover:text-green-700 transition duration-200"
              style={styles.glowButton}
            >
              Check Availability
            </button>
            <button type="button" onClick={handleNow} className="glow-button w-1/4 px-4 py-2 border-2 border-[#482f1f] text-white rounded-md hover:text-white transition duration-200 mx-2" style={styles.glowButton}>
              Now
            </button>
            <button type="button" onClick={handleReset} className="glow-button w-1/4 px-4 py-2 border-2 border-red-700 text-red-700 rounded-md hover:text-red-700 transition duration-200" style={styles.glowButton}>
              Reset
            </button>
          </div>
        </form>
        {error && (
          <div className="mt-8 p-4 rounded-md bg-yellow-100 border-yellow-500 border-l-4">
            <div className="flex items-center">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* SVG content */}
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
                    {/* SVG content */}
                  </svg>
                  <p className="text-green-900 ml-2">Room is available</p>
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* SVG content */}
                  </svg>
                  <p className="text-red-900 ml-2">Room is not available</p>
                </>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
      <style jsx>{`
        input[type="time"]::-webkit-calendar-picker-indicator {
          filter: invert(1);
          margin-right: -12px;
        }
        input[type="time"] {
          color-scheme: dark;
        }
      `}</style>
    </div>
  );
};

export default CheckAvailability;