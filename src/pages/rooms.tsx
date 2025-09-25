// src/pages/rooms.tsx
import { useState, useEffect, useMemo } from "react";
import Head from "next/head";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input"; // Shadcn Input
import { AlertCircle, Search, ArrowUp, ArrowDown } from "lucide-react"; // Icons
import Fuse from "fuse.js";
import { cn } from "@/lib/utils"; // Utility for conditional classes

// --- Data Structures ---
interface RoomData {
  name: string;
  shortCode: string;
  capacity: number | null;
}

// Define valid sort keys
type SortKey = keyof RoomData;

// Define sort configuration state
interface SortConfig {
  key: SortKey | null;
  direction: "asc" | "desc";
}

// --- Main Page Component ---
export default function RoomDetailsPage() {
  // State
  const [allRooms, setAllRooms] = useState<RoomData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: null,
    direction: "asc",
  });

  const isSearching = searchQuery.trim() !== "";

  // --- Fetch All Rooms ---
  useEffect(() => {
    const fetchRooms = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/rooms");
        if (!response.ok) {
          let errorMsg = `HTTP error! status: ${response.status}`;
          try {
            const errData = await response.json();
            errorMsg = errData.error || errorMsg;
          } catch {
            /* ignore */
          }
          throw new Error(errorMsg);
        }
        const data: RoomData[] = await response.json();
        setAllRooms(data);
      } catch (err: any) {
        console.error("Error fetching room details:", err);
        setError(err.message || "Failed to load room details.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchRooms();
  }, []);

  // --- Fuzzy Search Logic ---
  const fuse = useMemo(() => {
    if (allRooms.length === 0) return null;
    return new Fuse(allRooms, {
      keys: [
        { name: "name", weight: 0.7 },
        { name: "shortCode", weight: 0.3 },
      ],
      threshold: 0.4,
      includeScore: false,
    });
  }, [allRooms]);

  // --- Combined Filter & Sort Logic ---
  const processedRooms = useMemo(() => {
    let results: RoomData[];
    if (!fuse || !isSearching) {
      results = [...allRooms];
    } else {
      results = fuse.search(searchQuery).map((result) => result.item);
    }

    results = results.filter(
      (room) =>
        !room.name.toLowerCase().includes("consultation") &&
        !room.name.toLowerCase().includes("online"),
    );

    if (sortConfig.key !== null && !isSearching) {
      const key = sortConfig.key;
      results.sort((a, b) => {
        let comparison = 0;
        if (key === "capacity") {
          const aCap = a.capacity === null ? -Infinity : a.capacity;
          const bCap = b.capacity === null ? -Infinity : b.capacity;
          comparison = aCap - bCap;
        } else if (key === "name" || key === "shortCode") {
          const aStr = a[key];
          const bStr = b[key];
          comparison = aStr.localeCompare(bStr, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        }
        return sortConfig.direction === "asc" ? comparison : comparison * -1;
      });
    }
    return results;
  }, [searchQuery, isSearching, allRooms, fuse, sortConfig]);

  // --- Sorting Handler ---
  const handleSort = (key: SortKey) => {
    if (isSearching) return;
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // --- Get Sort Icon ---
  const getSortIcon = (key: SortKey) => {
    if (isSearching || sortConfig.key !== key) {
      return null;
    }
    if (sortConfig.direction === "asc") {
      return (
        <ArrowUp className="ml-1.5 h-4 w-4 text-purple-400 flex-shrink-0" />
      );
    }
    return (
      <ArrowDown className="ml-1.5 h-4 w-4 text-purple-400 flex-shrink-0" />
    );
  };

  // --- Animation Variants ---
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.03, delayChildren: 0.1 },
    },
  } as const;
  const itemVariant = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, ease: "easeOut" },
    },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
  } as const;
  const pageHeaderVariant = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { delay: 0.1, duration: 0.4, ease: "easeOut" },
    },
  } as const;
  const searchBarVariant = {
    hidden: { opacity: 0, y: -10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { delay: 0.2, duration: 0.4, ease: "easeOut" },
    },
  } as const;
  const tableContainerVariant = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { delay: 0.3, duration: 0.5, ease: "easeOut" },
    },
  } as const;

  // --- Render Page ---
  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 pt-20 md:pt-24 flex flex-col min-h-screen items-center">
      <Head>
        <title>Room Details - vacansee</title>
      </Head>

      <motion.div
        variants={pageHeaderVariant}
        initial="hidden"
        animate="visible"
        className="flex-shrink-0"
      >
        <h1 className="text-3xl md:text-4xl font-bold mb-8 text-center text-white">
          {" "}
          Room Details{" "}
        </h1>
      </motion.div>

      <motion.div
        variants={searchBarVariant}
        initial="hidden"
        animate="visible"
        className="relative mb-6 flex-shrink-0 w-full max-w-4xl"
      >
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <Input
          type="text"
          placeholder={`Search from ${allRooms.length} rooms by name or code...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 h-11 py-2.5 bg-black/30 border-white/25 text-white placeholder:text-gray-500 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 rounded-full"
        />
      </motion.div>

      <motion.div
        variants={tableContainerVariant}
        initial="hidden"
        animate="visible"
        className="border border-white/20 rounded-lg shadow-lg overflow-hidden bg-black/60 backdrop-blur-md flex flex-col min-h-0 w-full max-w-4xl mb-auto"
      >
        <div className="overflow-y-auto hide-scrollbar max-h-[65vh]">
          <table className="w-full border-collapse table-fixed">
            <thead className="sticky top-0 z-10 bg-gradient-to-b from-black/90 via-black/80 to-black/70 backdrop-blur-lg">
              <tr>
                {/* Room Name Header - Adjusted Width & Border */}
                <th
                  className={cn(
                    // Wider on mobile (70%), narrower on desktop (50%)
                    "group w-[70%] md:w-[50%] px-6 py-3 text-left text-base font-semibold text-white border-b border-white/20",
                    // Border right only on desktop (when short code is visible)
                    "md:border-r",
                    !isSearching && "cursor-pointer",
                    isSearching && "cursor-default",
                  )}
                  onClick={() => handleSort("name")}
                  aria-sort={
                    isSearching || sortConfig.key !== "name"
                      ? "none"
                      : sortConfig.direction === "asc"
                        ? "ascending"
                        : "descending"
                  }
                >
                  <div className="flex items-center">
                    {" "}
                    Room Name {getSortIcon("name")}{" "}
                  </div>
                </th>
                {/* Short Code Header - Hidden on Mobile */}
                <th
                  className={cn(
                    // Hidden by default, shown as table-cell on desktop
                    "hidden md:table-cell",
                    // Takes 25% width only on desktop
                    "md:w-[25%]",
                    "group px-6 py-3 text-center text-base font-semibold text-white border-b border-r border-white/20",
                    !isSearching && "cursor-pointer",
                    isSearching && "cursor-default",
                  )}
                  onClick={() => handleSort("shortCode")}
                  aria-sort={
                    isSearching || sortConfig.key !== "shortCode"
                      ? "none"
                      : sortConfig.direction === "asc"
                        ? "ascending"
                        : "descending"
                  }
                >
                  {/* Also hide inner div content on mobile */}
                  <div className="hidden md:flex items-center justify-center">
                    {" "}
                    Short Code {getSortIcon("shortCode")}{" "}
                  </div>
                </th>
                {/* Capacity Header - Adjusted Width */}
                <th
                  className={cn(
                    // Wider on mobile (30%), narrower on desktop (25%)
                    "group w-[30%] md:w-[25%]",
                    "px-6 py-3 text-center text-base font-semibold text-white border-b border-white/20", // No right border ever
                    !isSearching && "cursor-pointer",
                    isSearching && "cursor-default",
                  )}
                  onClick={() => handleSort("capacity")}
                  aria-sort={
                    isSearching || sortConfig.key !== "capacity"
                      ? "none"
                      : sortConfig.direction === "asc"
                        ? "ascending"
                        : "descending"
                  }
                >
                  <div className="flex items-center justify-center">
                    {" "}
                    Capacity {getSortIcon("capacity")}{" "}
                  </div>
                </th>
              </tr>
            </thead>
            <motion.tbody
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="divide-y divide-white/15"
            >
              {/* Loading State - Responsive ColSpan */}
              {isLoading && (
                <>
                  <tr className="md:hidden">
                    {" "}
                    {/* Mobile view */}
                    <td
                      colSpan={2}
                      className="h-40 text-center text-gray-400 py-4 px-6 border-b border-white/15"
                    >
                      {" "}
                      <div className="flex justify-center items-center">
                        {" "}
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>{" "}
                      </div>{" "}
                    </td>
                  </tr>
                  <tr className="hidden md:table-row">
                    {" "}
                    {/* Desktop view */}
                    <td
                      colSpan={3}
                      className="h-40 text-center text-gray-400 py-4 px-6 border-b border-white/15"
                    >
                      {" "}
                      <div className="flex justify-center items-center">
                        {" "}
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>{" "}
                      </div>{" "}
                    </td>
                  </tr>
                </>
              )}
              {/* Error State - Responsive ColSpan */}
              {!isLoading && error && (
                <>
                  <tr className="md:hidden">
                    {" "}
                    {/* Mobile view */}
                    <td
                      colSpan={2}
                      className="h-24 text-center p-4 py-4 px-6 border-b border-white/15"
                    >
                      {" "}
                      <div className="flex items-center justify-center text-red-400 gap-2 bg-red-950/40 border border-red-500/50 p-3 rounded-md max-w-md mx-auto">
                        {" "}
                        <AlertCircle className="w-5 h-5" />{" "}
                        <span>Error: {error}</span>{" "}
                      </div>{" "}
                    </td>
                  </tr>
                  <tr className="hidden md:table-row">
                    {" "}
                    {/* Desktop view */}
                    <td
                      colSpan={3}
                      className="h-24 text-center p-4 py-4 px-6 border-b border-white/15"
                    >
                      {" "}
                      <div className="flex items-center justify-center text-red-400 gap-2 bg-red-950/40 border border-red-500/50 p-3 rounded-md max-w-md mx-auto">
                        {" "}
                        <AlertCircle className="w-5 h-5" />{" "}
                        <span>Error: {error}</span>{" "}
                      </div>{" "}
                    </td>
                  </tr>
                </>
              )}
              {/* No Results State - Responsive ColSpan */}
              {!isLoading && !error && processedRooms.length === 0 && (
                <>
                  <tr className="md:hidden">
                    {" "}
                    {/* Mobile view */}
                    <td
                      colSpan={2}
                      className="h-24 text-center text-gray-400 italic py-4 px-6 border-b border-white/15"
                    >
                      {" "}
                      {isSearching
                        ? "No rooms found matching your search."
                        : "No room data available."}{" "}
                    </td>
                  </tr>
                  <tr className="hidden md:table-row">
                    {" "}
                    {/* Desktop view */}
                    <td
                      colSpan={3}
                      className="h-24 text-center text-gray-400 italic py-4 px-6 border-b border-white/15"
                    >
                      {" "}
                      {isSearching
                        ? "No rooms found matching your search."
                        : "No room data available."}{" "}
                    </td>
                  </tr>
                </>
              )}
              {/* Data Rows */}
              {!isLoading && !error && processedRooms.length > 0 && (
                <AnimatePresence>
                  {processedRooms.map((room) => (
                    <motion.tr
                      key={room.shortCode}
                      variants={itemVariant}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      layout
                      className="hover:bg-white/10 transition-colors duration-150"
                    >
                      {/* Room Name Cell - Responsive Border */}
                      <td
                        className={cn(
                          "font-medium text-white py-4 px-6 border-b border-white/15 text-left",
                          "md:border-r", // Border right only on desktop
                        )}
                      >
                        {room.name}
                      </td>
                      {/* Short Code Cell - Hidden on Mobile */}
                      <td className="hidden md:table-cell text-gray-300 py-4 px-6 border-b border-r border-white/15 text-center">
                        {room.shortCode}
                      </td>
                      {/* Capacity Cell */}
                      <td className="text-gray-300 py-4 px-6 border-b border-white/15 text-center">
                        {room.capacity !== null ? (
                          room.capacity
                        ) : (
                          <span className="text-gray-500">--</span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
              {/* "End of results" Indicator - Responsive ColSpan */}
              {!isLoading &&
                !error &&
                processedRooms.length > 0 &&
                isSearching && (
                  <>
                    <tr className="md:hidden bg-transparent">
                      {" "}
                      {/* Mobile view */}
                      <td
                        colSpan={2}
                        className="text-center text-xs text-gray-400 py-3 px-6 border-t border-white/15"
                      >
                        {" "}
                        End of search results{" "}
                      </td>
                    </tr>
                    <tr className="hidden md:table-row bg-transparent">
                      {" "}
                      {/* Desktop view */}
                      <td
                        colSpan={3}
                        className="text-center text-xs text-gray-400 py-3 px-6 border-t border-white/15"
                      >
                        {" "}
                        End of search results{" "}
                      </td>
                    </tr>
                  </>
                )}
            </motion.tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
