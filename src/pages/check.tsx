// src/pages/check.tsx
import { useState, useEffect, useCallback, useMemo } from "react";
import Head from "next/head";
import { motion, AnimatePresence } from "framer-motion";
// --- Import AlertCircle with other icons ---
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Search,
  X,
  Calendar,
  ChevronsUpDown,
  CircleX,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  format,
  getDay,
  setHours,
  setMinutes,
  startOfDay,
  addMinutes,
} from "date-fns";
import Fuse from "fuse.js";
import { Montserrat } from "next/font/google";

// --- Data Structures (Unchanged) ---
interface RoomListData {
  name: string;
  shortCode: string;
  capacity: number | null;
}
interface ConflictDetails {
  subject: string;
  professor: string;
  startTime: string;
  endTime: string;
  room: string;
  classType: string;
}
interface CheckResult {
  available: boolean;
  checked: {
    roomName: string;
    day: string;
    startTime: string;
    endTime: string;
  };
  classes?: ConflictDetails[];
}

// --- Constants (Unchanged) ---
const daysOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const MIN_HOUR = 7;
const MAX_HOUR = 23;

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["300", "400", "500", "600", "700", "800"],
});

// --- Helper Functions (Unchanged) ---
function generateTimeSlots(): string[] {
  const slots: string[] = [];
  const referenceDate = startOfDay(new Date());
  const start = setMinutes(setHours(referenceDate, MIN_HOUR), 0);
  const end = setMinutes(setHours(referenceDate, MAX_HOUR), 0);
  let current = start;
  while (current <= end) {
    slots.push(format(current, "HH:mm"));
    current = addMinutes(current, 30);
  }
  return slots;
}
const timeSlots = generateTimeSlots();

// --- Main Page Component ---
export default function CheckAvailabilityPage() {
  // --- State (Unchanged) ---
  const [selectedRoom, setSelectedRoom] = useState<RoomListData | null>(null);
  const [day, setDay] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [allRooms, setAllRooms] = useState<RoomListData[]>([]);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [roomFetchError, setRoomFetchError] = useState<string | null>(null);

  // --- Fetch Rooms (Unchanged) ---
  useEffect(() => {
    const fetchRooms = async () => {
      setIsLoadingRooms(true);
      setRoomFetchError(null);
      setFormError(null);
      try {
        const response = await fetch("/api/rooms");
        if (!response.ok) {
          let errorMsg = "Failed to fetch rooms list";
          try {
            const errData = await response.json();
            errorMsg = errData.error || `API Error (${response.status})`;
          } catch {
            /* ignore parsing error */
          }
          throw new Error(errorMsg);
        }
        const data: RoomListData[] = await response.json();
        setAllRooms(data);
        setRoomFetchError(null);
      } catch (err: any) {
        console.error("Error fetching rooms:", err);
        setRoomFetchError(err.message || "Could not load room list.");
        setAllRooms([]);
      } finally {
        setIsLoadingRooms(false);
      }
    };
    fetchRooms();
  }, []);

  // --- Fuzzy Search (Unchanged) ---
  const fuse = useMemo(() => {
    if (allRooms.length === 0) return null;
    return new Fuse(allRooms, { keys: ["name", "shortCode"], threshold: 0.4 });
  }, [allRooms]);
  const filteredRooms = useMemo(() => {
    if (!fuse || searchQuery === "") return allRooms;
    return fuse.search(searchQuery).map((result) => result.item);
  }, [searchQuery, allRooms, fuse]);

  // --- Event Handlers (Unchanged) ---
  const handleNow = useCallback(() => {
    const now = new Date();
    const currentMinutes = now.getMinutes();
    const startMinutes = currentMinutes < 30 ? 0 : 30;
    const startTimeExact = setMinutes(
      setHours(now, now.getHours()),
      startMinutes,
    );
    const endMinutes = startMinutes === 0 ? 30 : 0;
    const endHour = startMinutes === 0 ? now.getHours() : now.getHours() + 1;
    const endTimeExact = setMinutes(setHours(now, endHour), endMinutes);
    const todayJsIndex = getDay(now);
    const todayAdjusted = todayJsIndex === 0 ? 6 : todayJsIndex - 1;
    if (!day) {
      setDay(daysOfWeek[todayAdjusted]);
    }
    setStartTime(format(startTimeExact, "HH:mm"));
    const endFormatted = format(endTimeExact, "HH:mm");
    if (timeSlots.includes(endFormatted)) {
      setEndTime(endFormatted);
    } else {
      setEndTime(timeSlots[timeSlots.length - 1]);
    }
    setFormError(null);
    setCheckResult(null);
  }, [day]);
  const handleAllDay = useCallback(() => {
    if (!day) {
      const todayJsIndex = getDay(new Date());
      const todayAdjusted = todayJsIndex === 0 ? 6 : todayJsIndex - 1;
      setDay(daysOfWeek[todayAdjusted]);
    }
    setStartTime(timeSlots[0]);
    setEndTime(timeSlots[timeSlots.length - 1]);
    setFormError(null);
    setCheckResult(null);
  }, [day]);
  const handleReset = useCallback(() => {
    setSelectedRoom(null);
    setSearchQuery("");
    setDay("");
    setStartTime("");
    setEndTime("");
    setFormError(null);
    setCheckResult(null);
    setComboboxOpen(false);
  }, []);
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);
      setCheckResult(null);
      if (roomFetchError) {
        setFormError("Cannot check availability: Room list failed to load.");
        return;
      }
      if (!selectedRoom || !day || !startTime || !endTime) {
        setFormError("Please select a room, day, start time, and end time.");
        return;
      }
      if (startTime >= endTime) {
        setFormError("End time must be after start time.");
        return;
      }
      setIsChecking(true);
      try {
        const response = await fetch("/api/check-availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName: selectedRoom.name,
            day: day,
            startTime: startTime,
            endTime: endTime,
          }),
        });
        if (!response.ok) {
          let errorMsg = `API Error: ${response.status}`;
          try {
            const errData = await response.json();
            errorMsg = errData.error || errorMsg;
          } catch {
            /* ignore */
          }
          throw new Error(errorMsg);
        }
        const data: CheckResult = await response.json();
        setCheckResult(data);
      } catch (err: any) {
        console.error("Check availability error:", err);
        setFormError(err.message || "Failed to check availability.");
        setCheckResult(null);
      } finally {
        setIsChecking(false);
      }
    },
    [selectedRoom, day, startTime, endTime, roomFetchError],
  );

  // --- Animation Variants (Unchanged) ---
  const formItemVariant = {
    hidden: { opacity: 0, y: 15 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.07,
        duration: 0.4,
        ease: "easeOut" as const,
      },
    }),
  } as const;
  const resultVariant = {
    hidden: { opacity: 0, scale: 0.95, y: -10 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      height: "auto",
      marginTop: "2rem",
      transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      y: 10,
      height: 0,
      marginTop: 0,
      transition: { duration: 0.2, ease: "easeIn" as const },
    },
  } as const;
  const alertVariants = {
    success: "bg-green-950/50 border-green-500/60",
    destructive: "bg-red-950/30 border-red-500/60",
  };

  // --- Render ---
  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 pt-20 md:pt-24 flex-grow flex flex-col">
      <Head>
        <title>Check Availability - vacansee</title>
      </Head>
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="text-3xl md:text-4xl font-bold mb-10 text-center text-white"
      >
        {" "}
        Check Room Availability{" "}
      </motion.h1>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5"
      >
        {/* --- Form Elements (Unchanged structure) --- */}
        <motion.div
          variants={formItemVariant}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          <label
            htmlFor="room-search"
            className="block text-sm font-medium text-gray-300 mb-1.5"
          >
            Room
          </label>
          <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={comboboxOpen}
                disabled={isLoadingRooms || !!roomFetchError}
                className="w-full justify-between bg-black/20 border-white/20 hover:bg-black/30 hover:border-white/30 text-white disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-between w-full">
                  <span className="truncate">
                    {" "}
                    {isLoadingRooms
                      ? "Loading rooms..."
                      : roomFetchError
                        ? "Error loading rooms"
                        : selectedRoom
                          ? `${selectedRoom.name}${selectedRoom.capacity !== null ? ` (${selectedRoom.capacity})` : ""}`
                          : "Select room..."}{" "}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className={`max-h-[--radix-popover-content-available-height] p-0 bg-black/80 backdrop-blur-md border-white/20 text-white font-sans ${montserrat.variable}`}
              style={{
                fontFamily: "inherit",
                width: "var(--radix-popover-trigger-width)",
              }}
            >
              {isLoadingRooms ? (
                <div className="flex items-center justify-center p-4 h-20">
                  {" "}
                  <Loader2 className="h-6 w-6 animate-spin text-purple-400" />{" "}
                </div>
              ) : roomFetchError ? (
                <div className="p-4 text-center text-sm text-red-300">
                  {" "}
                  {roomFetchError}{" "}
                </div>
              ) : (
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search room..."
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    className={`h-9 text-white placeholder:text-gray-400 border-0 border-b border-white/20 rounded-none ring-offset-0 focus-visible:ring-0 focus-visible:border-b-purple-500 font-sans ${montserrat.variable}`}
                  />
                  <CommandList className="hide-scrollbar">
                    {" "}
                    <CommandEmpty>No room found.</CommandEmpty>{" "}
                    <CommandGroup>
                      {" "}
                      {filteredRooms.map((room) => (
                        <CommandItem
                          key={room.shortCode}
                          value={room.name}
                          onSelect={(currentValue) => {
                            const foundRoom = allRooms.find(
                              (r) =>
                                r.name.toLowerCase() ===
                                currentValue.toLowerCase(),
                            );
                            setSelectedRoom(foundRoom || null);
                            setComboboxOpen(false);
                            setSearchQuery("");
                          }}
                          className="font-sans aria-selected:bg-purple-600/30 aria-selected:text-white text-sm cursor-pointer"
                        >
                          {" "}
                          {room.name}{" "}
                          {room.capacity !== null && (
                            <span className="ml-2 text-xs text-gray-400">
                              {" "}
                              ({room.capacity}){" "}
                            </span>
                          )}{" "}
                        </CommandItem>
                      ))}{" "}
                    </CommandGroup>{" "}
                  </CommandList>
                </Command>
              )}
            </PopoverContent>
          </Popover>
        </motion.div>
        <motion.div
          variants={formItemVariant}
          initial="hidden"
          animate="visible"
          custom={1}
        >
          <label
            htmlFor="day"
            className="block text-sm font-medium text-gray-300 mb-1.5"
          >
            Day
          </label>
          <Select value={day} onValueChange={setDay}>
            <SelectTrigger
              id="day"
              className="w-full bg-black/20 border-white/20 text-white focus:ring-purple-500 focus:border-purple-500"
            >
              {" "}
              <SelectValue placeholder="Select a day" />{" "}
            </SelectTrigger>
            <SelectContent
              className={`bg-black/80 backdrop-blur-md border-white/20 text-white font-sans ${montserrat.variable} max-h-60`}
            >
              {" "}
              {daysOfWeek.map((d) => (
                <SelectItem
                  key={d}
                  value={d}
                  className="font-sans focus:bg-purple-600/30 focus:text-white"
                >
                  {d}
                </SelectItem>
              ))}{" "}
            </SelectContent>
          </Select>
        </motion.div>
        <motion.div
          variants={formItemVariant}
          initial="hidden"
          animate="visible"
          custom={2}
        >
          <label
            htmlFor="startTime"
            className="block text-sm font-medium text-gray-300 mb-1.5"
          >
            Start Time
          </label>
          <Select value={startTime} onValueChange={setStartTime}>
            <SelectTrigger
              id="startTime"
              className="w-full bg-black/20 border-white/20 text-white focus:ring-purple-500 focus:border-purple-500"
            >
              {" "}
              <SelectValue placeholder="Select start time" />{" "}
            </SelectTrigger>
            <SelectContent
              className={`bg-black/80 backdrop-blur-md border-white/20 text-white max-h-60 font-sans ${montserrat.variable}`}
            >
              {" "}
              {timeSlots.map((t) => (
                <SelectItem
                  key={`start-${t}`}
                  value={t}
                  className="font-sans focus:bg-purple-600/30 focus:text-white"
                >
                  {t}
                </SelectItem>
              ))}{" "}
            </SelectContent>
          </Select>
        </motion.div>
        <motion.div
          variants={formItemVariant}
          initial="hidden"
          animate="visible"
          custom={3}
        >
          <label
            htmlFor="endTime"
            className="block text-sm font-medium text-gray-300 mb-1.5"
          >
            End Time
          </label>
          <Select value={endTime} onValueChange={setEndTime}>
            <SelectTrigger
              id="endTime"
              className="w-full bg-black/20 border-white/20 text-white focus:ring-purple-500 focus:border-purple-500"
            >
              {" "}
              <SelectValue placeholder="Select end time" />{" "}
            </SelectTrigger>
            <SelectContent
              className={`bg-black/80 backdrop-blur-md border-white/20 text-white max-h-60 font-sans ${montserrat.variable}`}
            >
              {" "}
              {timeSlots.map((t) => (
                <SelectItem
                  key={`end-${t}`}
                  value={t}
                  className="font-sans focus:bg-purple-600/30 focus:text-white"
                >
                  {t}
                </SelectItem>
              ))}{" "}
            </SelectContent>
          </Select>
        </motion.div>
        <motion.div
          variants={formItemVariant}
          initial="hidden"
          animate="visible"
          custom={4}
          className="md:col-span-2 grid grid-cols-2 md:flex md:flex-wrap gap-3 mt-3"
        >
          <Button
            type="submit"
            disabled={isChecking || isLoadingRooms || !!roomFetchError}
            className="md:flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-full px-5 py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {" "}
            {isChecking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}{" "}
            <span className="md:hidden">Check</span>
            <span className="hidden md:inline">Check Availability</span>{" "}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleNow}
            className="md:w-auto rounded-full border-white/30 bg-white/10 hover:bg-white/20 px-5 py-2.5 text-sm font-medium flex items-center justify-center gap-2"
          >
            {" "}
            <Clock className="w-4 h-4" /> Now{" "}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleAllDay}
            className="md:w-auto rounded-full border-white/30 bg-white/10 hover:bg-white/20 px-5 py-2.5 text-sm font-medium flex items-center justify-center gap-2"
          >
            {" "}
            <Calendar className="w-4 h-4" /> All Day{" "}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="text-red-400 hover:bg-red-950/50 hover:text-red-300 border-red-500/40 hover:border-red-500/60 bg-black/30 rounded-full px-5 py-2.5 text-sm font-medium flex items-center justify-center gap-2"
          >
            {" "}
            <X className="w-4 h-4" /> Reset{" "}
          </Button>
        </motion.div>
      </form>

      {/* --- Results Area --- */}
      <div className="mt-8">
        {formError && (
          <div key="form-error" className="mb-8">
            {/* --- MODIFICATION: Removed items-center, added self-start mt-1 to icon --- */}
            <Alert
              variant="destructive"
              className="bg-yellow-950/80 border-yellow-600/80 text-yellow-100"
            >
              {/* Icon size h-6 w-6, alignment self-start mt-1 */}
              <AlertCircle className="h-6 w-6 flex-shrink-0 self-start mt-1 text-yellow-300" />
              <div className="col-start-2">
                <AlertTitle className="text-lg font-semibold !text-yellow-100">
                  Input Error
                </AlertTitle>
                <AlertDescription className="text-yellow-100/90">
                  {formError}
                </AlertDescription>
              </div>
            </Alert>
            {/* --- END MODIFICATION --- */}
          </div>
        )}
        <AnimatePresence mode="wait">
          {checkResult && (
            <motion.div
              key="check-result"
              variants={resultVariant}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <Alert
                variant={checkResult.available ? undefined : "destructive"}
                className={cn(
                  "transition-colors duration-300",
                  checkResult.available
                    ? alertVariants.success +
                        " flex items-center gap-3 !grid-cols-[auto_1fr]"
                    : alertVariants.destructive + " items-start", // Keep items-start for destructive
                )}
              >
                {checkResult.available ? (
                  <>
                    <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-300" />
                    <span className="text-base text-green-100 mt-0.75">
                      {" "}
                      Room{" "}
                      <span className="font-semibold">
                        {checkResult.checked.roomName}
                      </span>{" "}
                      is available.{" "}
                    </span>
                  </>
                ) : (
                  <>
                    <CircleX className="h-6 w-6 flex-shrink-0 self-start mt-1 !text-red-300" />
                    <div className="col-start-2">
                      <span className="block text-base text-red-100 font-medium mt-0.5">
                        {" "}
                        Room{" "}
                        <span className="font-semibold">
                          {checkResult.checked.roomName}
                        </span>{" "}
                        is not available.{" "}
                      </span>
                      {Array.isArray(checkResult.classes) &&
                      checkResult.classes.length > 0 ? (
                        <div className="mt-2 border-t border-red-400/80 pt-2">
                          <ul className="space-y-2.5">
                            {checkResult.classes?.map((c, index) => (
                              <li key={index} className="text-red-200/90">
                                <div className="text-sm font-medium text-red-100">
                                  {" "}
                                  {c.subject} {c.classType} | {c.professor}{" "}
                                </div>
                                <div className="font-mono text-sm text-red-200/80">
                                  {" "}
                                  {c.startTime} - {c.endTime}{" "}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <AlertDescription className="text-sm text-red-200/90 pt-1">
                          {" "}
                          <span>
                            Between{" "}
                            <span className="font-semibold">
                              {checkResult.checked.startTime}
                            </span>{" "}
                            and{" "}
                            <span className="font-semibold">
                              {checkResult.checked.endTime}
                            </span>
                            .
                          </span>{" "}
                        </AlertDescription>
                      )}
                    </div>
                  </>
                )}
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
