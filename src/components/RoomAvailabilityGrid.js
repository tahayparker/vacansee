import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 8; hour <= 22; hour++) {
    for (let min of [30, 0]) {
      // Skip 8:00
      if (hour === 8 && min === 0) continue;
      // Skip 22:30
      if (hour === 22 && min === 30) continue;
      
      const timeString = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      slots.push(timeString);
    }
  }
  return slots;
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_SLOTS = generateTimeSlots();

const RoomAvailabilityGrid = ({ data }) => {
  // Function to extract room number from full room name
  const getRoomNumber = (roomName) => {
    const match = roomName.match(/(\d+\.?\d*)/);
    return match ? match[1] : roomName;
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4">
      <Tabs defaultValue="Monday">
        <TabsList className="mb-4">
          {DAYS.map((day) => (
            <TabsTrigger key={day} value={day} className="px-4 py-2">
              {day}
            </TabsTrigger>
          ))}
        </TabsList>

        {DAYS.map((day) => (
          <TabsContent key={day} value={day}>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-white border p-2 min-w-[100px]">
                      Room
                    </th>
                    {TIME_SLOTS.map((time) => (
                      <th key={time} className="border p-2 min-w-[80px]">
                        {time}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data[day]?.rooms?.map((room) => (
                    <tr key={room.name}>
                      <td className="sticky left-0 z-10 bg-white border p-2 font-medium">
                        {getRoomNumber(room.name)}
                      </td>
                      {TIME_SLOTS.map((time) => (
                        <td
                          key={`${room.name}-${time}`}
                          className={`border p-2 text-center ${
                            room.availability[time] ? 'bg-green-200' : 'bg-red-200'
                          }`}
                        >
                          &nbsp;
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default RoomAvailabilityGrid;