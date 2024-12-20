import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { NextApiRequest, NextApiResponse } from 'next';

interface Room {
  Room: string;
}

const getFreeRooms = async (req: NextApiRequest, res: NextApiResponse) => {
  const db = await open({
    filename: 'classes.db',
    driver: sqlite3.Database
  });

  const freeRoomsQuery = `
SELECT DISTINCT Room
FROM Classes
WHERE Room NOT IN (
    SELECT Room
    FROM Classes
    WHERE 
        Day = CASE strftime('%w', 'now')
                  WHEN '0' THEN 'Sunday'
                  WHEN '1' THEN 'Monday'
                  WHEN '2' THEN 'Tuesday'
                  WHEN '3' THEN 'Wednesday'
                  WHEN '4' THEN 'Thursday'
                  WHEN '5' THEN 'Friday'
                  WHEN '6' THEN 'Saturday'
              END
        AND time('now', '+04:00') BETWEEN StartTime AND EndTime
)
ORDER BY Room ASC;
  `;
  const freeRooms: Room[] = await db.all(freeRoomsQuery);

  await db.close();

  res.status(200).json(freeRooms.map((room: Room) => room.Room));
};

export default getFreeRooms;