// src/pages/graph.tsx
import { useState, useEffect } from "react";
import Head from "next/head";
import { motion, AnimatePresence } from "framer-motion"; // Import motion and AnimatePresence
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDay } from "date-fns"; // Import getDay function
import { AlertCircle } from "lucide-react"; // Import for error display
import { Montserrat } from "next/font/google";

// --- Data Structures ---
interface FrontendRoomData {
  room: string;
  availability: number[];
}
interface FrontendScheduleDay {
  day: string;
  rooms: FrontendRoomData[];
}
// --- End Data Structures ---

const daysOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]; // Your array starts Monday=0
const timeIntervals = [
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
  "22:00",
];

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat",
});

// --- Helper to get adjusted day index (Monday=0) ---
function getAdjustedDayIndex(): number {
  const todayJsIndex = getDay(new Date()); // 0=Sunday, 1=Monday, ..., 6=Saturday
  // Adjust so Monday is 0, Tuesday is 1, ..., Sunday is 6
  return todayJsIndex === 0 ? 6 : todayJsIndex - 1;
}

// --- Main Page Component ---
export default function GraphPage() {
  const [scheduleData, setScheduleData] = useState<FrontendScheduleDay[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(() =>
    getAdjustedDayIndex(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Data Fetching ---
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetch("/api/schedule") // Assumes API returns data matching FrontendScheduleDay[]
      .then((response) => {
        if (!response.ok) {
          // Try to parse error JSON, fallback to status text
          return response
            .json()
            .then((errData) => {
              throw new Error(
                errData.error || `HTTP error! status: ${response.status}`,
              );
            })
            .catch(() => {
              // Catch if response wasn't JSON
              throw new Error(`HTTP error! status: ${response.status}`);
            });
        }
        return response.json();
      })
      .then((data) => {
        console.log("Fetched schedule data:", data);
        // Basic validation
        if (!Array.isArray(data) || data.length !== daysOfWeek.length) {
          throw new Error("Invalid schedule data format received from API");
        }
        setScheduleData(data);
      })
      .catch((error) => {
        console.error("Error fetching schedule:", error);
        setError(error.message || "Failed to load schedule.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []); // Fetch only once on mount

  // --- Animation Variants ---
  const pageContainerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.4, ease: "easeOut" } },
  };

  const headerSectionVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { delay: 0.1, duration: 0.4, ease: "easeOut" },
    },
  };

  const tableContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { delay: 0.1, duration: 0.3, ease: "easeOut" },
    }, // Faster transition
    exit: { opacity: 0, transition: { duration: 0.2, ease: "easeIn" } },
  };

  const tableRowVariants = {
    hidden: { opacity: 0, x: -15 }, // Slightly less x offset
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: i * 0.025, // Faster stagger delay
        duration: 0.3,
        ease: "easeOut",
      },
    }),
    exit: { opacity: 0, x: 15, transition: { duration: 0.15, ease: "easeIn" } }, // Faster exit
  };
  // --- End Animation Variants ---

  // --- Helper Functions ---
  const getCellColor = (avail: number) => {
    return avail === 1 ? "bg-green-500/70" : "bg-red-600/80";
  };
  const getRoomName = (roomIdentifier: string | null | undefined): string => {
    return roomIdentifier || ""; // Return empty string if null/undefined
  };

  const currentDayData = scheduleData[selectedDayIndex];

  // --- Render Page Content ---
  return (
    <motion.div
      variants={pageContainerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-full mx-auto px-0 py-6 pt-20 md:pt-24 flex flex-col h-screen"
    >
      <Head>
        <title>Room Availability Graph - vacansee</title>
      </Head>

      {/* Header Section (Title + Dropdown) with animation */}
      <motion.div
        variants={headerSectionVariants}
        // initial/animate controlled by parent motion.div
        className="px-4 md:px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 flex-shrink-0"
      >
        <h1 className="text-3xl md:text-4xl font-bold text-center md:text-left text-white flex-shrink-0">
          {" "}
          Room Availability Graph{" "}
        </h1>
        {/* Day Selector Dropdown */}
        <div className="flex items-center justify-center md:justify-end gap-2 flex-grow">
          <label
            htmlFor="day-select"
            className="text-sm font-medium text-gray-300 hidden sm:block"
          >
            Select Day:
          </label>
          <Select
            value={selectedDayIndex.toString()}
            onValueChange={(value) => setSelectedDayIndex(parseInt(value, 10))}
          >
            <SelectTrigger
              id="day-select"
              className="w-full sm:w-[180px] bg-black/20 border-white/20 text-white focus:ring-purple-500 focus:border-purple-500"
            >
              <SelectValue placeholder="Select a day" />
            </SelectTrigger>
            <SelectContent
              className={`bg-black/80 backdrop-blur-md border-white/20 text-white font-sans ${montserrat.variable}`}
            >
              {daysOfWeek.map((day, index) => (
                <SelectItem
                  key={index}
                  value={index.toString()}
                  className="focus:bg-purple-600/30 focus:text-white"
                >
                  {" "}
                  {day}{" "}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Schedule Table Area */}
      {/* Use AnimatePresence to handle transitions between states (loading/error/data/empty) */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loader-graph"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-grow items-center justify-center pt-10"
          >
            {" "}
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>{" "}
          </motion.div>
        ) : error ? (
          <motion.div
            key="error-graph"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-7xl mx-auto px-4 py-10 text-center pt-10"
          >
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-6 text-red-300 max-w-md mx-auto flex flex-col items-center gap-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="font-medium">Error loading schedule:</p>
              <p className="text-sm">{error}</p>
              {/* Optionally add a retry button here if needed */}
            </div>
          </motion.div>
        ) : currentDayData?.rooms && currentDayData.rooms.length > 0 ? (
          // Container for the table with its own animation and key
          <motion.div
            key={`table-container-${selectedDayIndex}`} // Key changes when day changes
            variants={tableContainerVariants}
            initial="hidden"
            animate="visible"
            exit="exit" // Use defined exit variant
            className="relative flex-grow flex flex-col min-h-0 px-4 pb-4"
          >
            {/* Scrollable Container */}
            <div className="w-full overflow-auto flex-grow min-h-0 hide-scrollbar border-l border-t border-b border-white/15 rounded-lg shadow-lg bg-black/20 backdrop-blur-sm">
              <table className="border-separate border-spacing-0 w-full min-w-[1400px]">
                <thead className="sticky top-0 z-30">
                  <tr>
                    <th className="sticky left-0 top-0 bg-black text-white z-40 px-3 py-3 border-r border-b border-white/15 text-right text-sm font-semibold whitespace-nowrap">
                      {" "}
                      Room{" "}
                    </th>
                    {timeIntervals.map((time, index) => (
                      <th
                        key={time}
                        className={`sticky top-0 bg-black text-white z-30 px-3 py-3 border-b border-white/15 text-center text-xs md:text-sm font-medium whitespace-nowrap ${index === timeIntervals.length - 1 ? "" : "border-r border-white/15"}`}
                        style={{ minWidth: "65px" }}
                      >
                        {" "}
                        {time}{" "}
                      </th>
                    ))}
                  </tr>
                </thead>
                {/* AnimatePresence for rows within tbody */}
                <tbody className="relative z-0">
                  <AnimatePresence initial={false}>
                    {currentDayData.rooms
                      .sort((a, b) => {
                        const roomA = getRoomName(a?.room) ?? "";
                        const roomB = getRoomName(b?.room) ?? "";
                        return roomA.localeCompare(roomB);
                      })
                      .map((roomData, roomIndex) => {
                        if (!roomData || typeof roomData.room !== "string")
                          return null;
                        return (
                          // Animate each table row
                          <motion.tr
                            key={roomData.room} // Stable key based on room identifier
                            custom={roomIndex} // Pass index for stagger effect
                            variants={tableRowVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            layout="position" // Enable smooth layout animation for rows
                            className="group"
                          >
                            {/* Sticky Cell */}
                            <td
                              className={`sticky left-0 bg-black group-hover:bg-zinc-900 text-white z-20 px-3 py-1.5 border-r border-b border-white/10 text-right text-sm whitespace-nowrap transition-colors duration-100`}
                            >
                              {getRoomName(roomData.room)}
                            </td>
                            {/* Data Cells */}
                            {Array.isArray(roomData.availability) &&
                              roomData.availability.map((avail, idx) => (
                                <td
                                  key={idx}
                                  className={`relative z-0 border-b border-black/50 ${getCellColor(avail)} transition-colors duration-150 group-hover:brightness-110 ${idx === roomData.availability.length - 1 ? "" : "border-r border-black/100"}`}
                                  title={`${getRoomName(roomData.room)} - ${timeIntervals[idx]} - ${avail === 1 ? "Available" : "Occupied"}`}
                                  style={{ minWidth: "65px" }}
                                >
                                  <div className="h-6"></div>
                                </td>
                              ))}
                          </motion.tr>
                        );
                      })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          // Case for no rooms data for the selected day
          <motion.p
            key="empty-graph"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center text-gray-400 py-10 px-4"
          >
            No schedule data available for {daysOfWeek[selectedDayIndex]}.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
