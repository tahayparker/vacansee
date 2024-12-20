import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import './Graph.module.css';

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const timeIntervals = [
  '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', 
  '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', 
  '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', 
  '20:30', '21:00', '21:30', '22:00', '22:30'
];

const Graph = () => {
  const [scheduleData, setScheduleData] = useState([]);
  const [selectedDay, setSelectedDay] = useState(0);  // Default to Monday

  useEffect(() => {
    fetch('/api/schedule')
      .then((response) => response.json())
      .then((data) => setScheduleData(data))
      .catch((error) => console.error('Error fetching schedule:', error));
  }, []);

  const getCellColor = (avail) => {
    return avail === 1 ? 'bg-green-700' : 'bg-red-700';
  };

  const getRoomName = (room) => room.split('-')[0];

  return (
    <div className="min-h-screen flex flex-col items-center justify-start text-foreground pt-32 pb-12">
      <Header />
      <main className="flex-grow w-full max-w-6xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-12">Room Availability</h1>
        <div className="tabs mb-8 flex justify-center space-x-2">
          {daysOfWeek.map((day, index) => (
            <button
              key={index}
              className={`px-4 py-2 rounded-full transition-all duration-200 ease-in-out ${selectedDay === index ? 'bg-blue-700 text-white' : 'bg-[#121212] text-gray-300 hover:bg-gray-600'}`}
              onClick={() => setSelectedDay(index)}
            >
              {day}
            </button>
          ))}
        </div>
        {scheduleData.length > 0 && (
          <div className="table-container overflow-auto">
            <table className="min-w-full border-collapse table-fixed">
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 bg-black text-white z-20 w-24">Room</th>
                  {timeIntervals.map((time) => (
                    <th key={time} className="sticky top-0 bg-black text-white z-10 px-2 py-1 border w-24">{time}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scheduleData[selectedDay].rooms
                  .sort((a, b) => getRoomName(a.room).localeCompare(getRoomName(b.room)))
                  .map((roomData, index) => (
                    <tr key={index}>
                      <td className="sticky left-0 bg-black text-white z-10 px-2 py-1 border w-24">{getRoomName(roomData.room)}</td>
                      {roomData.availability.map((avail, idx) => (
                        <td key={idx} className={`px-2 py-1 border w-24 ${getCellColor(avail)}`}></td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <Footer className={styles.Footer} />
    </div>
  );
};

export default Graph;