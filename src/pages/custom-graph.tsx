// src/pages/custom-graph.tsx
import { useState, useEffect, useMemo, useRef } from "react";
import Head from "next/head";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { AlertCircle, Search, Download } from "lucide-react";
import { Montserrat } from "next/font/google";
import { useTimeFormat } from "@/contexts/TimeFormatContext";
import { formatTime, cn } from "@/lib/utils";
import Fuse from "fuse.js";
import html2canvas from "html2canvas-pro";

// --- Data Structures ---
interface FrontendRoomData {
  room: string;
  availability: number[];
}
interface FrontendScheduleDay {
  day: string;
  rooms: FrontendRoomData[];
}

interface TableRow {
  room: string;
  day: string;
  dayIndex: number;
  availability: number[];
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
];

const allTimeIntervals = [
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

// --- Helper Functions ---
const getRoomShortCode = (roomIdentifier: string | null | undefined): string => {
  if (!roomIdentifier) return "";
  return roomIdentifier.split(/[- /]/)[0];
};

const getCellColor = (avail: number) => {
  return avail === 1 ? "bg-green-500/70" : "bg-red-600/80";
};

// --- Main Page Component ---
export default function CustomGraphPage() {
  const [scheduleData, setScheduleData] = useState<FrontendScheduleDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { use24h } = useTimeFormat();

  // Filter state
  const [selectedDays, setSelectedDays] = useState<number[]>([]); // Empty by default
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<number[]>([]); // Empty by default
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]); // Empty = all rooms
  const [groupBy, setGroupBy] = useState<"rooms" | "date">("rooms");

  // Selection mode state
  const [dayMode, setDayMode] = useState<"range" | "individual">("range");
  const [timeMode, setTimeMode] = useState<"range" | "individual">("range");

  // Range state (start with null to require user selection)
  const [dayRangeStart, setDayRangeStart] = useState<number | null>(null);
  const [dayRangeEnd, setDayRangeEnd] = useState<number | null>(null);
  const [timeRangeStart, setTimeRangeStart] = useState<number | null>(null);
  const [timeRangeEnd, setTimeRangeEnd] = useState<number | null>(null);

  // Room search
  const [roomSearchQuery, setRoomSearchQuery] = useState("");

  // Graph ref for export
  const graphRef = useRef<HTMLDivElement>(null);

  // --- Data Fetching ---
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetch("/api/schedule")
      .then((response) => {
        if (!response.ok) {
          return response
            .json()
            .then((errData) => {
              throw new Error(
                errData.error || `HTTP error! status: ${response.status}`
              );
            })
            .catch(() => {
              throw new Error(`HTTP error! status: ${response.status}`);
            });
        }
        return response.json();
      })
      .then((data) => {
        console.log("Fetched schedule data:", data);
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
  }, []);

  // Get all unique rooms from schedule data
  const allRooms = useMemo(() => {
    const roomSet = new Set<string>();
    scheduleData.forEach((day) => {
      day.rooms.forEach((room) => {
        if (room?.room) roomSet.add(room.room);
      });
    });
    return Array.from(roomSet).sort((a, b) => {
      const roomA = getRoomShortCode(a);
      const roomB = getRoomShortCode(b);
      return roomA.localeCompare(roomB);
    });
  }, [scheduleData]);

  // No auto-initialization of rooms - user must select them

  // Clear selections when switching to range mode
  useEffect(() => {
    if (dayMode === "range") {
      setSelectedDays([]);
    }
  }, [dayMode]);

  useEffect(() => {
    if (timeMode === "range") {
      setSelectedTimeSlots([]);
    }
  }, [timeMode]);

  // Update selections based on range mode
  useEffect(() => {
    if (dayMode === "range" && dayRangeStart !== null && dayRangeEnd !== null) {
      const start = Math.min(dayRangeStart, dayRangeEnd);
      const end = Math.max(dayRangeStart, dayRangeEnd);
      setSelectedDays(Array.from({ length: end - start + 1 }, (_, i) => start + i));
    }
  }, [dayMode, dayRangeStart, dayRangeEnd]);

  useEffect(() => {
    if (timeMode === "range" && timeRangeStart !== null && timeRangeEnd !== null) {
      const start = Math.min(timeRangeStart, timeRangeEnd);
      const end = Math.max(timeRangeStart, timeRangeEnd);
      setSelectedTimeSlots(Array.from({ length: end - start + 1 }, (_, i) => start + i));
    }
  }, [timeMode, timeRangeStart, timeRangeEnd]);

  // Fuzzy search for rooms
  const roomFuse = useMemo(() => {
    if (allRooms.length === 0) return null;
    return new Fuse(allRooms, {
      threshold: 0.4,
      includeScore: false,
    });
  }, [allRooms]);

  // Filter rooms based on search
  const filteredRooms = useMemo(() => {
    if (!roomSearchQuery.trim()) return allRooms;
    if (!roomFuse) return allRooms;
    return roomFuse.search(roomSearchQuery).map((result) => result.item);
  }, [allRooms, roomSearchQuery, roomFuse]);

  // Generate filtered time intervals
  const filteredTimeIntervals = useMemo(() => {
    return selectedTimeSlots
      .sort((a, b) => a - b)
      .map((idx) => allTimeIntervals[idx]);
  }, [selectedTimeSlots]);

  // Generate table rows based on grouping
  const tableRows = useMemo(() => {
    const rows: TableRow[] = [];

    selectedDays.forEach((dayIndex) => {
      const dayData = scheduleData[dayIndex];
      if (!dayData) return;

      dayData.rooms.forEach((roomData) => {
        if (!roomData || !selectedRooms.includes(roomData.room)) return;

        // Filter availability based on selected time slots
        const filteredAvailability = selectedTimeSlots
          .sort((a, b) => a - b)
          .map((idx) => roomData.availability[idx]);

        rows.push({
          room: roomData.room,
          day: daysOfWeek[dayIndex],
          dayIndex,
          availability: filteredAvailability,
        });
      });
    });

    // Sort based on groupBy mode
    if (groupBy === "rooms") {
      // Sort by room first, then by day
      rows.sort((a, b) => {
        const roomCompare = getRoomShortCode(a.room).localeCompare(
          getRoomShortCode(b.room)
        );
        if (roomCompare !== 0) return roomCompare;
        return a.dayIndex - b.dayIndex;
      });
    } else {
      // Sort by day first, then by room
      rows.sort((a, b) => {
        if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
        return getRoomShortCode(a.room).localeCompare(getRoomShortCode(b.room));
      });
    }

    return rows;
  }, [scheduleData, selectedDays, selectedRooms, selectedTimeSlots, groupBy]);

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
    },
    exit: { opacity: 0, transition: { duration: 0.2, ease: "easeIn" } },
  };

  const tableRowVariants = {
    hidden: { opacity: 0, x: -15 },
    visible: (i: number) => ({
      opacity: 1,
      x: 0,
      transition: {
        delay: i * 0.025,
        duration: 0.3,
        ease: "easeOut",
      },
    }),
    exit: { opacity: 0, x: 15, transition: { duration: 0.15, ease: "easeIn" } },
  };

  // --- Toggle handlers ---
  const toggleDay = (dayIndex: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex].sort((a, b) => a - b)
    );
  };

  const toggleTimeSlot = (slotIndex: number) => {
    setSelectedTimeSlots((prev) =>
      prev.includes(slotIndex)
        ? prev.filter((t) => t !== slotIndex)
        : [...prev, slotIndex].sort((a, b) => a - b)
    );
  };

  const toggleRoom = (room: string) => {
    setSelectedRooms((prev) =>
      prev.includes(room) ? prev.filter((r) => r !== room) : [...prev, room]
    );
  };

  // --- Export Graph as PNG ---
  const exportGraphAsPNG = async () => {
    if (!graphRef.current) return;

    try {
      // Create a temporary container for the graph with footer
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.background = '#000000';
      document.body.appendChild(tempContainer);

      // Clone the graph
      const graphClone = graphRef.current.cloneNode(true) as HTMLElement;

      // Optimize table for export
      const table = graphClone.querySelector('table');
      if (table) {
        const tableEl = table as HTMLElement;

        // Remove the large min-width constraint
        tableEl.style.minWidth = 'auto';

        // Style header row cells
        const headerRow = table.querySelector('thead tr');
        if (headerRow) {
          const headerCells = headerRow.querySelectorAll('th');
          headerCells.forEach((th, index) => {
            const thEl = th as HTMLElement;
            if (index === 0) {
              // Room column header - centered
              thEl.style.minWidth = 'auto';
              thEl.style.width = '100px';
              thEl.style.maxWidth = '150px';
              thEl.style.textAlign = 'center';
            } else {
              // Time column headers - center and make compact with more padding
              thEl.style.minWidth = '50px';
              thEl.style.width = '50px';
              thEl.style.textAlign = 'center';
              thEl.style.paddingLeft = '8px';
              thEl.style.paddingRight = '8px';
            }
          });
        }

        // Style body rows
        const bodyRows = table.querySelectorAll('tbody tr');
        bodyRows.forEach((tr) => {
          const cells = tr.querySelectorAll('td');
          cells.forEach((td, index) => {
            const tdEl = td as HTMLElement;
            if (index === 0) {
              // Room name cells - keep tight
              tdEl.style.minWidth = 'auto';
              tdEl.style.width = '100px';
              tdEl.style.maxWidth = '150px';
            } else {
              // Data cells - compact
              tdEl.style.minWidth = '50px';
              tdEl.style.width = '50px';
            }
          });
        });
      }

      tempContainer.appendChild(graphClone);

      // Add footer with responsive text sizing
      // Adjust font size based on number of time slots
      const isNarrowGraph = filteredTimeIntervals.length < 6;

      const footer = document.createElement('div');
      footer.style.width = '100%';
      footer.style.padding = '16px 24px';
      footer.style.background = '#000000';
      footer.style.borderTop = '2px solid rgba(255, 255, 255, 0.15)';
      footer.style.display = 'flex';
      footer.style.justifyContent = 'space-between';
      footer.style.alignItems = 'center';
      footer.style.fontFamily = 'Montserrat, sans-serif';
      footer.style.color = '#ffffff';

      const leftText = document.createElement('span');
      leftText.textContent = 'vacansee - The ultimate guide to finding empty rooms';
      leftText.style.fontWeight = '500';
      leftText.style.fontSize = isNarrowGraph ? '12px' : '14px';

      const rightText = document.createElement('span');
      rightText.textContent = 'Made by TP';
      rightText.style.fontWeight = '500';
      rightText.style.fontSize = '14px';

      footer.appendChild(leftText);
      footer.appendChild(rightText);
      tempContainer.appendChild(footer);

      // Capture the image (html2canvas-pro supports modern CSS including oklab)
      const canvas = await html2canvas(tempContainer, {
        backgroundColor: '#000000',
        scale: 2,
        logging: false,
      });

      // Clean up
      document.body.removeChild(tempContainer);

      // Download with formatted datetime
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const datetime = `${year}${month}${day}-${hours}${minutes}${seconds}`;

      const link = document.createElement('a');
      link.download = `vacansee-custom-graph-${datetime}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error exporting graph:', error);
      alert('Failed to export graph. Please try again.');
    }
  };

  // --- Render Page Content ---
  const hasGraph = selectedDays.length > 0 && selectedTimeSlots.length > 0 && selectedRooms.length > 0 && tableRows.length > 0;

  return (
    <motion.div
      variants={pageContainerVariants}
      initial="hidden"
      animate="visible"
      className={`w-full max-w-full mx-auto px-0 py-6 pt-20 md:pt-24 flex flex-col ${hasGraph ? 'min-h-screen' : ''}`}
    >
      <Head>
        <title>Custom Room Availability Graph - vacansee</title>
      </Head>

      {/* Header Section */}
      <motion.div
        variants={headerSectionVariants}
        className="px-4 md:px-6 flex flex-col gap-4 mb-6 flex-shrink-0"
      >
        <h1 className="text-3xl md:text-4xl font-bold text-center md:text-left text-white">
          Custom Room Availability Graph
        </h1>

        {/* Filter Accordion */}
        <div className="bg-black/20 backdrop-blur-sm border border-white/15 rounded-lg p-4 pt-2 pb-2">
          <Accordion type="single" defaultValue="days" collapsible className="w-full">
            {/* Days Filter */}
            <AccordionItem value="days" className="border-white/10">
              <AccordionTrigger className="text-white hover:text-white/80 text-lg font-bold py-2">
                Select Days
              </AccordionTrigger>
              <AccordionContent className="pt-3 pb-3">
                <Tabs
                  value={dayMode}
                  onValueChange={(val) => setDayMode(val as "range" | "individual")}
                  className="w-full"
                >
                  <TabsList className="bg-black/40 border border-white/10">
                    <TabsTrigger value="range" className="text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                      Range
                    </TabsTrigger>
                    <TabsTrigger value="individual" className="text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                      Individual
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="range" className="mt-4">
                    <div className="flex flex-col md:flex-row gap-3 md:items-center">
                      <div className="flex gap-3 items-center flex-1">
                        <label className="text-sm text-gray-300 whitespace-nowrap">
                          From:
                        </label>
                        <div className="flex-1">
                          <Select
                            value={dayRangeStart !== null ? dayRangeStart.toString() : undefined}
                            onValueChange={(val) => setDayRangeStart(parseInt(val))}
                          >
                            <SelectTrigger className="bg-black/20 border-white/20 text-white">
                              <SelectValue placeholder="Select start day" />
                            </SelectTrigger>
                            <SelectContent
                              className={`bg-black/80 backdrop-blur-md border-white/20 text-white ${montserrat.variable}`}
                            >
                              {daysOfWeek.map((day, idx) => (
                                <SelectItem
                                  key={idx}
                                  value={idx.toString()}
                                  className="focus:bg-purple-600/30 focus:text-white"
                                >
                                  {day}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex gap-3 items-center flex-1">
                        <label className="text-sm text-gray-300 whitespace-nowrap">To:</label>
                        <div className="flex-1">
                          <Select
                            value={dayRangeEnd !== null ? dayRangeEnd.toString() : undefined}
                            onValueChange={(val) => setDayRangeEnd(parseInt(val))}
                          >
                            <SelectTrigger className="bg-black/20 border-white/20 text-white">
                              <SelectValue placeholder="Select end day" />
                            </SelectTrigger>
                            <SelectContent
                              className={`bg-black/80 backdrop-blur-md border-white/20 text-white ${montserrat.variable}`}
                            >
                              {daysOfWeek.map((day, idx) => (
                                <SelectItem
                                  key={idx}
                                  value={idx.toString()}
                                  className="focus:bg-purple-600/30 focus:text-white"
                                >
                                  {day}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="individual" className="mt-4">
                    <div className="flex flex-wrap gap-2">
                      {daysOfWeek.map((day, idx) => (
                        <Button
                          key={idx}
                          type="button"
                          variant="outline"
                          onClick={() => toggleDay(idx)}
                          className={cn(
                            "rounded-full border-2 transition-all",
                            selectedDays.includes(idx)
                              ? "bg-purple-600 border-purple-600 text-white hover:bg-purple-700 hover:border-purple-700"
                              : "bg-black/20 border-white/20 text-white hover:bg-white/10"
                          )}
                        >
                          {day}
                        </Button>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </AccordionContent>
            </AccordionItem>

            {/* Time Slots Filter */}
            <AccordionItem value="times" className="border-white/10">
              <AccordionTrigger className="text-white hover:text-white/80 text-lg font-bold py-2">
                Select Time Slots
              </AccordionTrigger>
              <AccordionContent className="pt-3 pb-3">
                <Tabs
                  value={timeMode}
                  onValueChange={(val) => setTimeMode(val as "range" | "individual")}
                  className="w-full"
                >
                  <TabsList className="bg-black/40 border border-white/10">
                    <TabsTrigger value="range" className="text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                      Range
                    </TabsTrigger>
                    <TabsTrigger value="individual" className="text-white data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                      Individual
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="range" className="mt-4">
                    <div className="flex flex-col md:flex-row gap-3 md:items-center">
                      <div className="flex gap-3 items-center flex-1">
                        <label className="text-sm text-gray-300 whitespace-nowrap">
                          From:
                        </label>
                        <div className="flex-1">
                          <Select
                            value={timeRangeStart !== null ? timeRangeStart.toString() : undefined}
                            onValueChange={(val) => setTimeRangeStart(parseInt(val))}
                          >
                            <SelectTrigger className="bg-black/20 border-white/20 text-white">
                              <SelectValue placeholder="Select start time" />
                            </SelectTrigger>
                            <SelectContent
                              className={`bg-black/80 backdrop-blur-md border-white/20 text-white ${montserrat.variable}`}
                            >
                              {allTimeIntervals.map((time, idx) => (
                                <SelectItem
                                  key={idx}
                                  value={idx.toString()}
                                  className="focus:bg-purple-600/30 focus:text-white"
                                >
                                  {formatTime(time, use24h)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex gap-3 items-center flex-1">
                        <label className="text-sm text-gray-300 whitespace-nowrap">To:</label>
                        <div className="flex-1">
                          <Select
                            value={timeRangeEnd !== null ? timeRangeEnd.toString() : undefined}
                            onValueChange={(val) => setTimeRangeEnd(parseInt(val))}
                          >
                            <SelectTrigger className="bg-black/20 border-white/20 text-white">
                              <SelectValue placeholder="Select end time" />
                            </SelectTrigger>
                            <SelectContent
                              className={`bg-black/80 backdrop-blur-md border-white/20 text-white ${montserrat.variable}`}
                            >
                              {allTimeIntervals.map((time, idx) => (
                                <SelectItem
                                  key={idx}
                                  value={idx.toString()}
                                  className="focus:bg-purple-600/30 focus:text-white"
                                >
                                  {formatTime(time, use24h)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="individual" className="mt-4">
                    <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
                      {allTimeIntervals.map((time, idx) => (
                        <Button
                          key={idx}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => toggleTimeSlot(idx)}
                          className={cn(
                            "rounded-full border-2 transition-all",
                            selectedTimeSlots.includes(idx)
                              ? "bg-purple-600 border-purple-600 text-white hover:bg-purple-700 hover:border-purple-700"
                              : "bg-black/20 border-white/20 text-white hover:bg-white/10"
                          )}
                        >
                          {formatTime(time, use24h)}
                        </Button>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </AccordionContent>
            </AccordionItem>

            {/* Rooms Filter */}
            <AccordionItem value="rooms" className="border-white/10">
              <AccordionTrigger className="text-white hover:text-white/80 text-lg font-bold py-2">
                Select Rooms
              </AccordionTrigger>
              <AccordionContent className="pt-3 pb-3">
                <div className="space-y-4">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      type="text"
                      placeholder="Search rooms..."
                      value={roomSearchQuery}
                      onChange={(e) => setRoomSearchQuery(e.target.value)}
                      className="pl-10 bg-black/20 border-white/20 text-white placeholder:text-gray-500 focus:border-purple-500 rounded-full"
                    />
                  </div>

                  {/* Room Buttons */}
                  <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
                    {filteredRooms.map((room) => (
                      <Button
                        key={room}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toggleRoom(room)}
                        className={cn(
                          "rounded-full border-2 transition-all",
                          selectedRooms.includes(room)
                            ? "bg-purple-600 border-purple-600 text-white hover:bg-purple-700 hover:border-purple-700"
                            : "bg-black/20 border-white/20 text-white hover:bg-white/10"
                        )}
                      >
                        {room}
                      </Button>
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Group By Section */}
            <AccordionItem value="groupby" className="border-white/10">
              <AccordionTrigger className="text-white hover:text-white/80 text-lg font-bold py-2">
                Group By
              </AccordionTrigger>
              <AccordionContent className="pt-3 pb-3">
                <div className="flex gap-2">
                  <Toggle
                    pressed={groupBy === "rooms"}
                    onPressedChange={(pressed) => pressed && setGroupBy("rooms")}
                    className="data-[state=on]:bg-purple-600 data-[state=on]:text-white text-white border border-white/20 rounded-full px-4"
                  >
                    Rooms
                  </Toggle>
                  <Toggle
                    pressed={groupBy === "date"}
                    onPressedChange={(pressed) => pressed && setGroupBy("date")}
                    className="data-[state=on]:bg-purple-600 data-[state=on]:text-white text-white border border-white/20 rounded-full px-4"
                  >
                    Day
                  </Toggle>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Save Graph Button */}
        {selectedDays.length > 0 && selectedTimeSlots.length > 0 && selectedRooms.length > 0 && tableRows.length > 0 && (
          <div className="flex justify-end mt-4">
            <Button
              onClick={exportGraphAsPNG}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center gap-2 rounded-full px-12"
            >
              <Download className="w-4 h-4" />
              Save Graph
            </Button>
          </div>
        )}
      </motion.div>

      {/* Schedule Table Area */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loader-custom-graph"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-grow items-center justify-center pt-10"
          >
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400"></div>
          </motion.div>
        ) : error ? (
          <motion.div
            key="error-custom-graph"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-7xl mx-auto px-4 py-10 text-center pt-10"
          >
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-6 text-red-300 max-w-md mx-auto flex flex-col items-center gap-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="font-medium">Error loading schedule:</p>
              <p className="text-sm">{error}</p>
            </div>
          </motion.div>
        ) : selectedDays.length === 0 || selectedTimeSlots.length === 0 || selectedRooms.length === 0 ? (
          <motion.div
            key="no-selection"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-8"
          >
            <p className="text-gray-400 text-lg">
              Please select days, time slots, and rooms to view the schedule.
            </p>
          </motion.div>
        ) : tableRows.length > 0 ? (
          <motion.div
            key={`table-container-custom`}
            variants={tableContainerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative flex flex-col px-4 mb-6"
            ref={graphRef}
          >
            <div className="w-full overflow-auto hide-scrollbar border-l border-t border-b border-white/15 rounded-lg shadow-lg bg-black/20 backdrop-blur-sm">
              <table className="border-separate border-spacing-0 w-full min-w-[800px] md:min-w-[1400px]">
                <thead className="sticky top-0 z-30">
                  <tr>
                    <th className="sticky left-0 top-0 bg-black text-white z-40 px-2 md:px-3 py-3 border-r border-b border-white/15 text-center text-xs md:text-sm font-semibold whitespace-nowrap w-auto max-w-fit">
                      Room
                    </th>
                    {filteredTimeIntervals.map((time, index) => (
                      <th
                        key={time}
                        className={`sticky top-0 bg-black text-white z-30 px-1.5 md:px-3 py-2 md:py-3 border-b border-white/15 text-center text-xs md:text-sm font-medium whitespace-nowrap ${index === filteredTimeIntervals.length - 1 ? "" : "border-r border-white/15"}`}
                        style={{ minWidth: "45px", width: "auto" }}
                      >
                        {formatTime(time, use24h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="relative z-0">
                  <AnimatePresence initial={false}>
                    {tableRows.map((row, rowIndex) => (
                      <motion.tr
                        key={`${row.room}-${row.dayIndex}`}
                        custom={rowIndex}
                        variants={tableRowVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        layout="position"
                        className="group"
                      >
                        <td className="sticky left-0 bg-black group-hover:bg-zinc-900 text-white z-20 px-2 md:px-3 py-2 border-r border-b border-white/10 text-right text-sm whitespace-nowrap transition-colors duration-100 w-auto max-w-fit">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="font-semibold text-sm md:text-base">
                              {getRoomShortCode(row.room)}
                            </span>
                            <span className="text-xs md:text-sm text-gray-300 font-medium">
                              {row.day.substring(0, 3)}
                            </span>
                          </div>
                        </td>
                        {row.availability.map((avail, idx) => (
                          <td
                            key={idx}
                            className={`relative z-0 border-b border-black/50 ${getCellColor(avail)} transition-colors duration-150 group-hover:brightness-110 ${idx === row.availability.length - 1 ? "" : "border-r border-black/100"}`}
                            title={`${getRoomShortCode(row.room)} - ${row.day} - ${filteredTimeIntervals[idx]} - ${avail === 1 ? "Available" : "Occupied"}`}
                            style={{ minWidth: "45px", width: "auto" }}
                          >
                            <div className="h-5 md:h-6"></div>
                          </td>
                        ))}
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.p
            key="empty-custom-graph"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center text-gray-400 py-8 px-4"
          >
            No schedule data available for the selected filters.
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
