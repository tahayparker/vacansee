// src/pages/custom-graph.tsx
import { useState, useEffect, useMemo, useRef } from "react";
import Head from "next/head";
import { motion, AnimatePresence } from "framer-motion";
import {
  pageContainerVariants,
  headerSectionVariants,
  tableRowVariants,
  fadeVariants,
} from "@/lib/animations";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertCircle,
  Search,
  Download,
  Share2,
  FileImage,
  FileSpreadsheet,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { formatTime, cn } from "@/lib/utils";
import {
  useFormPersistence,
  useSearchPersistence,
} from "@/hooks/useFormPersistence";
import { montserrat } from "@/lib/fonts";
import { useTimeFormat } from "@/contexts/TimeFormatContext";
import { useToast } from "@/components/ui/toast";
import Fuse from "fuse.js";
import html2canvas from "html2canvas-pro";
import * as XLSX from "xlsx-js-style";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useRequireAuth } from "@/hooks/useRequireAuth";

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

// --- Main Page Component ---

// --- Helper Functions ---
const getRoomShortCode = (
  roomIdentifier: string | null | undefined,
): string => {
  if (!roomIdentifier) return "";
  // Split by dash or space, but preserve slashes for combined rooms (e.g. "2.62/63")
  return roomIdentifier.split(/[- ]/)[0];
};

const getCellColor = (avail: number) => {
  return avail === 1 ? "bg-green-500/70" : "bg-red-600/80";
};

// --- Main Page Component ---
export default function CustomGraphPage() {
  // Check authentication first
  const { loading: authLoading, isAuthenticated } = useRequireAuth();
  
  const [scheduleData, setScheduleData] = useState<FrontendScheduleDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTableContained, setIsTableContained] = useState(true);

  // Check if we have URL params
  const hasUrlParams =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).toString().length > 0;
  const { use24h } = useTimeFormat();
  const { success, error: showError } = useToast();

  // Helper to check if an array is a continuous range
  const isConsecutiveRange = (arr: number[]): boolean => {
    if (arr.length <= 1) return false;
    const sorted = [...arr].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) return false;
    }
    return true;
  };

  // Parse URL params BEFORE initializing persistence
  const getInitialFilters = () => {
    const defaults = {
      selectedDays: [] as number[],
      selectedTimeSlots: [] as number[],
      selectedRooms: [] as string[],
      groupBy: "rooms" as "rooms" | "date",
      dayMode: "range" as "range" | "individual",
      timeMode: "range" as "range" | "individual",
      dayRangeStart: null as number | null,
      dayRangeEnd: null as number | null,
      timeRangeStart: null as number | null,
      timeRangeEnd: null as number | null,
    };

    if (typeof window === "undefined" || !hasUrlParams) {
      return defaults;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const result = { ...defaults };

    // Parse days
    const days = urlParams.get("days");
    if (days) {
      const dayIndices = days
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      if (dayIndices.length > 0) {
        result.selectedDays = dayIndices;
        if (isConsecutiveRange(dayIndices)) {
          const sorted = [...dayIndices].sort((a, b) => a - b);
          result.dayMode = "range";
          result.dayRangeStart = sorted[0];
          result.dayRangeEnd = sorted[sorted.length - 1];
        } else {
          result.dayMode = "individual";
        }
      }
    }

    // Parse times
    const times = urlParams.get("times");
    if (times) {
      const timeIndices = times
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n));
      if (timeIndices.length > 0) {
        result.selectedTimeSlots = timeIndices;
        if (isConsecutiveRange(timeIndices)) {
          const sorted = [...timeIndices].sort((a, b) => a - b);
          result.timeMode = "range";
          result.timeRangeStart = sorted[0];
          result.timeRangeEnd = sorted[sorted.length - 1];
        } else {
          result.timeMode = "individual";
        }
      }
    }

    // Parse rooms
    const rooms = urlParams.get("rooms");
    if (rooms) {
      result.selectedRooms = rooms.split(",");
    }

    // Parse groupBy
    const groupBy = urlParams.get("groupBy");
    if (groupBy && (groupBy === "rooms" || groupBy === "date")) {
      result.groupBy = groupBy;
    }

    return result;
  };

  // Filter state - only persist if no URL params
  const filters = useFormPersistence(getInitialFilters(), {
    persist: !hasUrlParams,
  });

  // Room search with persistence and debouncing
  const roomSearch = useSearchPersistence("", {
    debounceDelay: 300,
    storageKey: "custom-graph-room-search",
  });

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
                errData.error || `HTTP error! status: ${response.status}`,
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

  // When switching TO range mode, update range values to match current selections if they form a consecutive range
  useEffect(() => {
    if (
      filters.values.dayMode === "range" &&
      filters.values.selectedDays.length > 0
    ) {
      // Check if current selections form a consecutive range
      if (isConsecutiveRange(filters.values.selectedDays)) {
        const sorted = [...filters.values.selectedDays].sort((a, b) => a - b);
        const newStart = sorted[0];
        const newEnd = sorted[sorted.length - 1];

        // Only update if different from current range values
        if (
          filters.values.dayRangeStart !== newStart ||
          filters.values.dayRangeEnd !== newEnd
        ) {
          filters.setField("dayRangeStart", newStart);
          filters.setField("dayRangeEnd", newEnd);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.values.dayMode]);

  useEffect(() => {
    if (
      filters.values.timeMode === "range" &&
      filters.values.selectedTimeSlots.length > 0
    ) {
      // Check if current selections form a consecutive range
      if (isConsecutiveRange(filters.values.selectedTimeSlots)) {
        const sorted = [...filters.values.selectedTimeSlots].sort(
          (a, b) => a - b,
        );
        const newStart = sorted[0];
        const newEnd = sorted[sorted.length - 1];

        // Only update if different from current range values
        if (
          filters.values.timeRangeStart !== newStart ||
          filters.values.timeRangeEnd !== newEnd
        ) {
          filters.setField("timeRangeStart", newStart);
          filters.setField("timeRangeEnd", newEnd);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.values.timeMode]);

  // Update selections based on range mode when range values change
  useEffect(() => {
    if (
      filters.values.dayMode === "range" &&
      filters.values.dayRangeStart !== null &&
      filters.values.dayRangeEnd !== null
    ) {
      const start = Math.min(
        filters.values.dayRangeStart,
        filters.values.dayRangeEnd,
      );
      const end = Math.max(
        filters.values.dayRangeStart,
        filters.values.dayRangeEnd,
      );
      const newDays = Array.from(
        { length: end - start + 1 },
        (_, i) => start + i,
      );

      // Only update if different
      if (
        JSON.stringify(newDays) !== JSON.stringify(filters.values.selectedDays)
      ) {
        filters.setField("selectedDays", newDays);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.values.dayRangeStart, filters.values.dayRangeEnd]);

  useEffect(() => {
    if (
      filters.values.timeMode === "range" &&
      filters.values.timeRangeStart !== null &&
      filters.values.timeRangeEnd !== null
    ) {
      const start = Math.min(
        filters.values.timeRangeStart,
        filters.values.timeRangeEnd,
      );
      const end = Math.max(
        filters.values.timeRangeStart,
        filters.values.timeRangeEnd,
      );
      const newSlots = Array.from(
        { length: end - start + 1 },
        (_, i) => start + i,
      );

      // Only update if different
      if (
        JSON.stringify(newSlots) !==
        JSON.stringify(filters.values.selectedTimeSlots)
      ) {
        filters.setField("selectedTimeSlots", newSlots);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.values.timeRangeStart, filters.values.timeRangeEnd]);

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
    if (!roomSearch.query.trim()) return allRooms;
    if (!roomFuse) return allRooms;
    return roomFuse.search(roomSearch.query).map((result) => result.item);
  }, [allRooms, roomSearch.query, roomFuse]);

  // Generate filtered time intervals
  const filteredTimeIntervals = useMemo(() => {
    return filters.values.selectedTimeSlots
      .sort((a, b) => a - b)
      .map((idx) => allTimeIntervals[idx]);
  }, [filters.values.selectedTimeSlots]);

  // Generate table rows based on grouping
  const tableRows = useMemo(() => {
    const rows: TableRow[] = [];

    filters.values.selectedDays.forEach((dayIndex) => {
      const dayData = scheduleData[dayIndex];
      if (!dayData) return;

      dayData.rooms.forEach((roomData) => {
        if (!roomData || !filters.values.selectedRooms.includes(roomData.room))
          return;

        // Filter availability based on selected time slots
        const filteredAvailability = filters.values.selectedTimeSlots
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
    if (filters.values.groupBy === "rooms") {
      // Sort by room first, then by day
      rows.sort((a, b) => {
        const roomCompare = getRoomShortCode(a.room).localeCompare(
          getRoomShortCode(b.room),
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
  }, [
    scheduleData,
    filters.values.selectedDays,
    filters.values.selectedRooms,
    filters.values.selectedTimeSlots,
    filters.values.groupBy,
  ]);

  // --- Toggle handlers ---
  const toggleDay = (dayIndex: number) => {
    const currentDays = filters.values.selectedDays;
    const newDays = currentDays.includes(dayIndex)
      ? currentDays.filter((d) => d !== dayIndex)
      : [...currentDays, dayIndex].sort((a, b) => a - b);
    filters.setField("selectedDays", newDays);
  };

  const toggleTimeSlot = (slotIndex: number) => {
    const currentSlots = filters.values.selectedTimeSlots;
    const newSlots = currentSlots.includes(slotIndex)
      ? currentSlots.filter((t) => t !== slotIndex)
      : [...currentSlots, slotIndex].sort((a, b) => a - b);
    filters.setField("selectedTimeSlots", newSlots);
  };

  const toggleRoom = (room: string) => {
    const currentRooms = filters.values.selectedRooms;
    const newRooms = currentRooms.includes(room)
      ? currentRooms.filter((r) => r !== room)
      : [...currentRooms, room];
    filters.setField("selectedRooms", newRooms);
  };

  // --- Export Graph as PNG ---
  const exportGraphAsPNG = async () => {
    if (!graphRef.current) return;

    try {
      // Create a temporary container for the graph with footer
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      tempContainer.style.background = "#000000";
      document.body.appendChild(tempContainer);

      // Clone the graph
      const graphClone = graphRef.current.cloneNode(true) as HTMLElement;

      // Set minimum width for the container
      graphClone.style.minWidth = "720px";
      graphClone.style.width = "auto";

      // Optimize table for export
      const table = graphClone.querySelector("table");
      if (table) {
        const tableEl = table as HTMLElement;

        // Let the table expand to fit the container
        tableEl.style.width = "100%";
        tableEl.style.minWidth = "720px";

        // Style header row cells to adjust naturally
        const headerRow = table.querySelector("thead tr");
        if (headerRow) {
          const headerCells = headerRow.querySelectorAll("th");
          headerCells.forEach((th, index) => {
            const thEl = th as HTMLElement;
            if (index === 0) {
              // Room column header - keep fixed
              thEl.style.width = "120px";
              thEl.style.minWidth = "120px";
              thEl.style.maxWidth = "120px";
              thEl.style.textAlign = "center";
            } else {
              // Time column headers - let them expand to fill available space
              thEl.style.width = "auto";
              thEl.style.minWidth = "0";
              thEl.style.textAlign = "center";
              thEl.style.paddingLeft = "8px";
              thEl.style.paddingRight = "8px";
            }
          });
        }

        // Style body rows
        const bodyRows = table.querySelectorAll("tbody tr");
        bodyRows.forEach((tr) => {
          const cells = tr.querySelectorAll("td");
          cells.forEach((td, index) => {
            const tdEl = td as HTMLElement;
            if (index === 0) {
              // Room name cells - keep fixed
              tdEl.style.width = "120px";
              tdEl.style.minWidth = "120px";
              tdEl.style.maxWidth = "120px";
            } else {
              // Data cells - let them expand to fill available space
              tdEl.style.width = "auto";
              tdEl.style.minWidth = "0";
            }
          });
        });
      }

      tempContainer.appendChild(graphClone);

      // Add footer
      const footer = document.createElement("div");
      footer.style.width = "100%";
      footer.style.padding = "16px 24px";
      footer.style.background = "#000000";
      footer.style.borderTop = "2px solid rgba(255, 255, 255, 0.15)";
      footer.style.display = "flex";
      footer.style.justifyContent = "space-between";
      footer.style.alignItems = "center";
      footer.style.fontFamily = "Montserrat, sans-serif";
      footer.style.color = "#ffffff";

      const leftText = document.createElement("span");
      leftText.textContent = "vacansee - vacancy, instantly.";
      leftText.style.fontWeight = "500";
      leftText.style.fontSize = "14px";

      const rightText = document.createElement("span");
      rightText.textContent = "Built with 🖤 by TP";
      rightText.style.fontWeight = "500";
      rightText.style.fontSize = "12px";

      footer.appendChild(leftText);
      footer.appendChild(rightText);
      tempContainer.appendChild(footer);

      // Capture the image (html2canvas-pro supports modern CSS including oklab)
      const canvas = await html2canvas(tempContainer, {
        backgroundColor: "#000000",
        scale: 2,
        logging: false,
      });

      // Clean up
      document.body.removeChild(tempContainer);

      // Download with formatted datetime
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      const datetime = `${year}${month}${day}-${hours}${minutes}${seconds}`;

      const link = document.createElement("a");
      link.download = `vacansee-custom-graph-${datetime}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Error exporting graph:", error);
      alert("Failed to export graph. Please try again.");
    }
  };

  // --- Export Graph as CSV ---
  const exportGraphAsCSV = () => {
    if (tableRows.length === 0) return;

    try {
      const now = new Date();
      const csvRows: string[] = [];

      // Add metadata as comments
      csvRows.push("# vacansee - Custom Graph Export");
      csvRows.push(`# Generated: ${now.toLocaleString()}`);
      csvRows.push(
        `# Days: ${filters.values.selectedDays.map((d) => daysOfWeek[d]).join(", ")}`,
      );
      csvRows.push(
        `# Time Range: ${formatTime(filteredTimeIntervals[0], use24h)} - ${formatTime(filteredTimeIntervals[filteredTimeIntervals.length - 1], use24h)}`,
      );
      csvRows.push(
        `# Rooms: ${filters.values.selectedRooms.length} room(s) selected`,
      );
      csvRows.push(
        `# Grouped By: ${filters.values.groupBy === "rooms" ? "Rooms" : "Days"}`,
      );
      csvRows.push("#");

      // Create CSV headers
      const headers = ["Room", "Day", "Time Slot", "Availability"];
      csvRows.push(headers.join(","));

      // Add data rows
      tableRows.forEach((row) => {
        const dayName = daysOfWeek[row.dayIndex];
        const timeSlots = filteredTimeIntervals.map((interval, idx) => {
          const availability = row.availability[idx];
          const status = availability === 1 ? "Available" : "Occupied";
          return [row.room, dayName, interval, status].join(",");
        });
        csvRows.push(...timeSlots);
      });

      // Create and download CSV
      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const datetime = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      link.download = `vacansee-custom-graph-${datetime}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting CSV:", error);
      alert("Failed to export CSV. Please try again.");
    }
  };

  // --- Export Graph as XLSX ---
  const exportGraphAsXLSX = () => {
    if (tableRows.length === 0) return;

    try {
      // Create workbook
      const wb = XLSX.utils.book_new();

      // Add metadata to workbook
      const now = new Date();
      wb.Props = {
        Title: "vacansee - Custom Graph",
        Subject: "Custom Room Availability Graph",
        Author: "Taha Parker via vacansee",
        CreatedDate: now,
        Company: "vacansee",
        Comments: `Generated on ${now.toLocaleString()}. Days: ${filters.values.selectedDays.map((d) => daysOfWeek[d]).join(", ")}. Time Range: ${formatTime(filteredTimeIntervals[0], use24h)} - ${formatTime(filteredTimeIntervals[filteredTimeIntervals.length - 1], use24h)}. Grouped by: ${filters.values.groupBy === "rooms" ? "Rooms" : "Days"}.`,
        Keywords:
          "vacansee, custom graph, excel, xlsx, csv, export, download, rooms, days, times, availability, vacant, occupied, available, occupied, tp, taha parker, garfield, lasagna",
      };

      // === MAIN SHEET (All Data) ===
      const mainWsData: any[][] = [];

      // Header row: Room/Day + time slots
      const headerRow = [
        "Room/Day",
        ...filteredTimeIntervals.map((time) => formatTime(time, use24h)),
      ];
      mainWsData.push(headerRow);

      // Data rows: one row per room-day combination
      tableRows.forEach((row) => {
        const rowData = [
          `${getRoomShortCode(row.room)} - ${row.day.substring(0, 3)}`,
          ...row.availability.map((val) =>
            val === 1 ? "Available" : "Occupied",
          ),
        ];
        mainWsData.push(rowData);
      });

      const mainWs = XLSX.utils.aoa_to_sheet(mainWsData);

      // Set column widths for main sheet
      const mainColWidths = [
        { wch: 18 }, // Room/Day column
        ...filteredTimeIntervals.map(() => ({ wch: 12 })), // Time columns
      ];
      mainWs["!cols"] = mainColWidths;

      // Apply styles to main sheet
      const mainRange = XLSX.utils.decode_range(mainWs["!ref"] || "A1");

      // Define border style
      const borderStyle = {
        top: { style: "thin", color: { rgb: "000000" } as any },
        bottom: { style: "thin", color: { rgb: "000000" } as any },
        left: { style: "thin", color: { rgb: "000000" } as any },
        right: { style: "thin", color: { rgb: "000000" } as any },
      } as any;

      // Style header row
      for (let col = mainRange.s.c; col <= mainRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!mainWs[cellAddress]) continue;
        mainWs[cellAddress].s = {
          font: { bold: true, color: { rgb: "000000" } },
          fill: {
            patternType: "solid",
            fgColor: { rgb: "FFFFFF" },
            bgColor: { rgb: "FFFFFF" },
          },
          alignment: { horizontal: "center", vertical: "center" },
          border: borderStyle,
        };
      }

      // Style data cells
      for (let row = mainRange.s.r + 1; row <= mainRange.e.r; row++) {
        for (let col = mainRange.s.c; col <= mainRange.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!mainWs[cellAddress]) continue;

          if (col === 0) {
            // First column: Room/Day labels with white background
            mainWs[cellAddress].s = {
              font: { bold: true, color: { rgb: "000000" } },
              fill: {
                patternType: "solid",
                fgColor: { rgb: "FFFFFF" },
                bgColor: { rgb: "FFFFFF" },
              },
              alignment: { horizontal: "right", vertical: "center" },
              border: borderStyle,
            };
          } else {
            // Data cells: color based on availability
            const value = mainWs[cellAddress].v;
            const isAvailable = value === "Available";
            mainWs[cellAddress].s = {
              fill: {
                patternType: "solid",
                fgColor: { rgb: isAvailable ? "90EE90" : "FF6B6B" },
                bgColor: { rgb: isAvailable ? "90EE90" : "FF6B6B" },
              },
              alignment: { horizontal: "center", vertical: "center" },
              border: borderStyle,
            };
          }
        }
      }

      XLSX.utils.book_append_sheet(wb, mainWs, "All Data");

      // === GROUPED SHEETS ===
      if (filters.values.groupBy === "date") {
        // Group by days: Create a sheet for each day
        const sortedDays = [...filters.values.selectedDays].sort(
          (a, b) => a - b,
        );
        sortedDays.forEach((dayIndex) => {
          const dayName = daysOfWeek[dayIndex];
          const dayRows = tableRows.filter((row) => row.dayIndex === dayIndex);

          if (dayRows.length === 0) return;

          const dayWsData: any[][] = [];

          // Header: Room + time slots
          dayWsData.push([
            "Room",
            ...filteredTimeIntervals.map((time) => formatTime(time, use24h)),
          ]);

          // Data rows: one per room
          dayRows.forEach((row) => {
            dayWsData.push([
              getRoomShortCode(row.room),
              ...row.availability.map((val) =>
                val === 1 ? "Available" : "Occupied",
              ),
            ]);
          });

          const dayWs = XLSX.utils.aoa_to_sheet(dayWsData);
          dayWs["!cols"] = mainColWidths;

          // Apply styles
          const dayRange = XLSX.utils.decode_range(dayWs["!ref"] || "A1");

          // Header row
          for (let col = dayRange.s.c; col <= dayRange.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
            if (!dayWs[cellAddress]) continue;
            dayWs[cellAddress].s = {
              font: { bold: true, color: { rgb: "000000" } },
              fill: {
                patternType: "solid",
                fgColor: { rgb: "FFFFFF" },
                bgColor: { rgb: "FFFFFF" },
              },
              alignment: { horizontal: "center", vertical: "center" },
              border: borderStyle,
            };
          }

          // Data cells
          for (let row = dayRange.s.r + 1; row <= dayRange.e.r; row++) {
            for (let col = dayRange.s.c; col <= dayRange.e.c; col++) {
              const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
              if (!dayWs[cellAddress]) continue;

              if (col === 0) {
                dayWs[cellAddress].s = {
                  font: { bold: true, color: { rgb: "000000" } },
                  fill: {
                    patternType: "solid",
                    fgColor: { rgb: "FFFFFF" },
                    bgColor: { rgb: "FFFFFF" },
                  },
                  alignment: { horizontal: "right", vertical: "center" },
                  border: borderStyle,
                };
              } else {
                const value = dayWs[cellAddress].v;
                const isAvailable = value === "Available";
                dayWs[cellAddress].s = {
                  fill: {
                    patternType: "solid",
                    fgColor: { rgb: isAvailable ? "90EE90" : "FF6B6B" },
                    bgColor: { rgb: isAvailable ? "90EE90" : "FF6B6B" },
                  },
                  alignment: { horizontal: "center", vertical: "center" },
                  border: borderStyle,
                };
              }
            }
          }

          // Clean sheet name (max 31 chars, no special chars)
          const cleanSheetName = dayName
            .substring(0, 31)
            .replace(/[\\/?*\[\]]/g, "");
          XLSX.utils.book_append_sheet(wb, dayWs, cleanSheetName);
        });
      } else {
        // Group by rooms: Create a sheet for each room
        const sortedRooms = [...filters.values.selectedRooms].sort((a, b) => {
          return getRoomShortCode(a).localeCompare(getRoomShortCode(b));
        });
        sortedRooms.forEach((room) => {
          const roomRows = tableRows.filter((row) => row.room === room);

          if (roomRows.length === 0) return;

          const roomWsData: any[][] = [];

          // Header: Day + time slots
          roomWsData.push([
            "Day",
            ...filteredTimeIntervals.map((time) => formatTime(time, use24h)),
          ]);

          // Data rows: one per day
          roomRows.forEach((row) => {
            roomWsData.push([
              row.day.substring(0, 3),
              ...row.availability.map((val) =>
                val === 1 ? "Available" : "Occupied",
              ),
            ]);
          });

          const roomWs = XLSX.utils.aoa_to_sheet(roomWsData);
          roomWs["!cols"] = mainColWidths;

          // Apply styles
          const roomRange = XLSX.utils.decode_range(roomWs["!ref"] || "A1");

          // Header row
          for (let col = roomRange.s.c; col <= roomRange.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
            if (!roomWs[cellAddress]) continue;
            roomWs[cellAddress].s = {
              font: { bold: true, color: { rgb: "000000" } },
              fill: {
                patternType: "solid",
                fgColor: { rgb: "FFFFFF" },
                bgColor: { rgb: "FFFFFF" },
              },
              alignment: { horizontal: "center", vertical: "center" },
              border: borderStyle,
            };
          }

          // Data cells
          for (let row = roomRange.s.r + 1; row <= roomRange.e.r; row++) {
            for (let col = roomRange.s.c; col <= roomRange.e.c; col++) {
              const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
              if (!roomWs[cellAddress]) continue;

              if (col === 0) {
                roomWs[cellAddress].s = {
                  font: { bold: true, color: { rgb: "000000" } },
                  fill: {
                    patternType: "solid",
                    fgColor: { rgb: "FFFFFF" },
                    bgColor: { rgb: "FFFFFF" },
                  },
                  alignment: { horizontal: "right", vertical: "center" },
                  border: borderStyle,
                };
              } else {
                const value = roomWs[cellAddress].v;
                const isAvailable = value === "Available";
                roomWs[cellAddress].s = {
                  fill: {
                    patternType: "solid",
                    fgColor: { rgb: isAvailable ? "90EE90" : "FF6B6B" },
                    bgColor: { rgb: isAvailable ? "90EE90" : "FF6B6B" },
                  },
                  alignment: { horizontal: "center", vertical: "center" },
                  border: borderStyle,
                };
              }
            }
          }

          // Clean sheet name (max 31 chars, no special chars)
          const cleanSheetName = getRoomShortCode(room)
            .substring(0, 31)
            .replace(/[\\/?*\[\]]/g, "");
          XLSX.utils.book_append_sheet(wb, roomWs, cleanSheetName);
        });
      }

      // Generate filename with timestamp
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      const datetime = `${year}${month}${day}-${hours}${minutes}${seconds}`;

      // Write file with BookType explicitly set
      XLSX.writeFile(wb, `vacansee-custom-graph-${datetime}.xlsx`, {
        bookType: "xlsx",
        cellStyles: true,
      });
    } catch (error) {
      console.error("Error exporting XLSX:", error);
      alert("Failed to export XLSX. Please try again.");
    }
  };

  // --- Generate Shareable URL ---
  const generateShareableURL = async () => {
    const params = new URLSearchParams();

    // Always use simple arrays - no mode parameters needed
    // The receiver will auto-detect if it's a range or not
    if (filters.values.selectedDays.length > 0) {
      params.set("days", filters.values.selectedDays.join(","));
    }

    if (filters.values.selectedTimeSlots.length > 0) {
      params.set("times", filters.values.selectedTimeSlots.join(","));
    }

    if (filters.values.selectedRooms.length > 0) {
      params.set("rooms", filters.values.selectedRooms.join(","));
    }

    if (filters.values.groupBy) {
      params.set("groupBy", filters.values.groupBy);
    }

    const shareableURL = `${window.location.origin}${window.location.pathname}?${params.toString()}`;

    // Detect if device is mobile (not just if browser supports Web Share API)
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      ) ||
      (navigator.maxTouchPoints > 0 && window.innerWidth < 768);

    // On mobile: use native share if available
    if (isMobile && navigator.share) {
      try {
        await navigator.share({
          title: "vacansee Custom Graph",
          text: "Check out this custom room availability graph",
          url: shareableURL,
        });
      } catch (err) {
        if (
          !(
            err &&
            typeof err === "object" &&
            "name" in err &&
            (err as any).name === "AbortError"
          )
        ) {
          showError("Failed to open share sheet.");
        }
      }
      return;
    }

    // On desktop or mobile without share API: copy to clipboard and show toast
    try {
      await navigator.clipboard.writeText(shareableURL);
      success("Shareable URL has been copied to your clipboard!");
    } catch {
      showError("Failed to copy URL to clipboard.");
    }
  };

  // Show loading spinner while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  // Don't render page content if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // --- Render Page Content ---
  // Only use full height container if there are enough rows (more than 6)
  const shouldUseFullHeight = isTableContained && tableRows.length > 6;

  return (
    <motion.div
      variants={pageContainerVariants}
      initial="hidden"
      animate="visible"
      className={`w-full max-w-full mx-auto px-0 py-6 pt-20 md:pt-24 flex flex-col ${shouldUseFullHeight ? "h-screen" : ""}`}
    >
      <Head>
        <title>Custom Graph - vacansee</title>
      </Head>

      {/* Header Section */}
      <motion.div
        variants={headerSectionVariants}
        className="px-4 md:px-6 flex flex-col gap-4 mb-6 flex-shrink-0"
      >
        <h1 className="text-3xl md:text-4xl font-bold text-center md:text-left text-white">
          Custom Graph
        </h1>

        {/* Filter Accordion */}
        <div className="bg-black/20 backdrop-blur-sm border border-white/15 rounded-lg p-4 pt-2 pb-2">
          <Accordion
            type="single"
            defaultValue={hasUrlParams ? undefined : "days"}
            collapsible
            className="w-full"
          >
            {/* Days Filter */}
            <AccordionItem value="days" className="border-white/10">
              <AccordionTrigger className="text-white hover:text-white/80 text-lg font-bold py-2">
                Select Days
              </AccordionTrigger>
              <AccordionContent className="pt-3 pb-3">
                <Tabs
                  value={filters.values.dayMode}
                  onValueChange={(val) =>
                    filters.setField("dayMode", val as "range" | "individual")
                  }
                  className="w-full"
                >
                  <TabsList className="bg-black/40 border border-white/10">
                    <TabsTrigger
                      value="range"
                      className="text-white data-[state=active]:bg-purple-500 data-[state=active]:text-white"
                    >
                      Range
                    </TabsTrigger>
                    <TabsTrigger
                      value="individual"
                      className="text-white data-[state=active]:bg-purple-500 data-[state=active]:text-white"
                    >
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
                            value={
                              filters.values.dayRangeStart !== null
                                ? filters.values.dayRangeStart.toString()
                                : undefined
                            }
                            onValueChange={(val) =>
                              filters.setField("dayRangeStart", parseInt(val))
                            }
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
                                  className="focus:bg-purple-500/30 focus:text-white"
                                >
                                  {day}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex gap-3 items-center flex-1">
                        <label className="text-sm text-gray-300 whitespace-nowrap">
                          To:
                        </label>
                        <div className="flex-1">
                          <Select
                            value={
                              filters.values.dayRangeEnd !== null
                                ? filters.values.dayRangeEnd.toString()
                                : undefined
                            }
                            onValueChange={(val) =>
                              filters.setField("dayRangeEnd", parseInt(val))
                            }
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
                                  className="focus:bg-purple-500/30 focus:text-white"
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
                            filters.values.selectedDays.includes(idx)
                              ? "bg-purple-500 border-purple-500 text-white hover:bg-purple-500 hover:border-purple-500"
                              : "bg-black/20 border-white/20 text-white hover:bg-white/10",
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
                  value={filters.values.timeMode}
                  onValueChange={(val) =>
                    filters.setField("timeMode", val as "range" | "individual")
                  }
                  className="w-full"
                >
                  <TabsList className="bg-black/40 border border-white/10">
                    <TabsTrigger
                      value="range"
                      className="text-white data-[state=active]:bg-purple-500 data-[state=active]:text-white"
                    >
                      Range
                    </TabsTrigger>
                    <TabsTrigger
                      value="individual"
                      className="text-white data-[state=active]:bg-purple-500 data-[state=active]:text-white"
                    >
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
                            value={
                              filters.values.timeRangeStart !== null
                                ? filters.values.timeRangeStart.toString()
                                : undefined
                            }
                            onValueChange={(val) =>
                              filters.setField("timeRangeStart", parseInt(val))
                            }
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
                                  className="focus:bg-purple-500/30 focus:text-white"
                                >
                                  {formatTime(time, use24h)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex gap-3 items-center flex-1">
                        <label className="text-sm text-gray-300 whitespace-nowrap">
                          To:
                        </label>
                        <div className="flex-1">
                          <Select
                            value={
                              filters.values.timeRangeEnd !== null
                                ? filters.values.timeRangeEnd.toString()
                                : undefined
                            }
                            onValueChange={(val) =>
                              filters.setField("timeRangeEnd", parseInt(val))
                            }
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
                                  className="focus:bg-purple-500/30 focus:text-white"
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
                            filters.values.selectedTimeSlots.includes(idx)
                              ? "bg-purple-500 border-purple-500 text-white hover:bg-purple-500 hover:border-purple-500"
                              : "bg-black/20 border-white/20 text-white hover:bg-white/10",
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
                  {/* Search Bar with Select All button */}
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        type="text"
                        placeholder="Search rooms..."
                        value={roomSearch.query}
                        onChange={(e) => roomSearch.setQuery(e.target.value)}
                        className="pl-10 bg-black/20 border-white/20 text-white placeholder:text-gray-500 focus:border-purple-500 rounded-full"
                      />
                    </div>
                    {roomSearch.query && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const allFilteredSelected = filteredRooms.every(
                            (room) =>
                              filters.values.selectedRooms.includes(room),
                          );
                          if (allFilteredSelected) {
                            // Deselect all filtered rooms
                            filters.setField(
                              "selectedRooms",
                              filters.values.selectedRooms.filter(
                                (r) => !filteredRooms.includes(r),
                              ),
                            );
                          } else {
                            // Select all filtered rooms
                            const newRooms = [
                              ...new Set([
                                ...filters.values.selectedRooms,
                                ...filteredRooms,
                              ]),
                            ];
                            filters.setField("selectedRooms", newRooms);
                          }
                        }}
                        className={cn(
                          "rounded-full border-2 transition-all whitespace-nowrap",
                          filteredRooms.every((room) =>
                            filters.values.selectedRooms.includes(room),
                          ) && filteredRooms.length > 0
                            ? "bg-purple-500 border-purple-500 text-white hover:bg-purple-500 hover:border-purple-500"
                            : "bg-black/20 border-white/20 text-white hover:bg-white/10",
                        )}
                      >
                        {filteredRooms.every((room) =>
                          filters.values.selectedRooms.includes(room),
                        ) && filteredRooms.length > 0
                          ? "Deselect All"
                          : "Select All"}
                      </Button>
                    )}
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
                          filters.values.selectedRooms.includes(room)
                            ? "bg-purple-500 border-purple-500 text-white hover:bg-purple-500 hover:border-purple-500"
                            : "bg-black/20 border-white/20 text-white hover:bg-white/10",
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
                    pressed={filters.values.groupBy === "rooms"}
                    onPressedChange={(pressed) =>
                      pressed && filters.setField("groupBy", "rooms")
                    }
                    className="data-[state=on]:bg-purple-500 data-[state=on]:text-white text-white border border-white/20 rounded-full px-4"
                  >
                    Rooms
                  </Toggle>
                  <Toggle
                    pressed={filters.values.groupBy === "date"}
                    onPressedChange={(pressed) =>
                      pressed && filters.setField("groupBy", "date")
                    }
                    className="data-[state=on]:bg-purple-500 data-[state=on]:text-white text-white border border-white/20 rounded-full px-4"
                  >
                    Day
                  </Toggle>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        {/* View Toggle, Export and Share Buttons */}
        {filters.values.selectedDays.length > 0 &&
          filters.values.selectedTimeSlots.length > 0 &&
          filters.values.selectedRooms.length > 0 &&
          tableRows.length > 0 && (
            <div className="flex flex-nowrap justify-end gap-1.5 md:gap-3 mt-4">
              <Button
                onClick={() => setIsTableContained(!isTableContained)}
                variant="outline"
                className="bg-black/20 border-white/20 hover:bg-white/10 text-white font-semibold flex items-center gap-1 md:gap-2 rounded-full px-2 md:px-6 text-xs md:text-base whitespace-nowrap"
              >
                {isTableContained ? (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    Expand
                  </>
                ) : (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    Contain
                  </>
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-purple-500 hover:bg-purple-500 text-white font-semibold flex items-center gap-1 md:gap-2 rounded-full px-2 md:px-6 text-xs md:text-base whitespace-nowrap">
                    <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={exportGraphAsPNG}
                    className="cursor-pointer"
                  >
                    <FileImage className="w-4 h-4 mr-2" />
                    Export as PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={exportGraphAsXLSX}
                    className="cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export as XLSX
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={exportGraphAsCSV}
                    className="cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                onClick={generateShareableURL}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1 md:gap-2 rounded-full px-2 md:px-6 text-xs md:text-base whitespace-nowrap"
              >
                <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                Share
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
            <LoadingSpinner size="large" />
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
        ) : filters.values.selectedDays.length === 0 ||
          filters.values.selectedTimeSlots.length === 0 ||
          filters.values.selectedRooms.length === 0 ? (
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
            variants={fadeVariants}
            initial="hidden"
            animate={{
              opacity: 1,
              flexGrow: shouldUseFullHeight ? 1 : 0,
            }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            exit="exit"
            className={`relative flex flex-col px-4 ${shouldUseFullHeight ? "min-h-0 pb-4" : "mb-6"}`}
            ref={graphRef}
          >
            <motion.div
              animate={{
                flexGrow: shouldUseFullHeight ? 1 : 0,
              }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              className={`w-full overflow-auto hide-scrollbar border-l border-t border-b border-white/15 rounded-lg shadow-lg bg-black/20 backdrop-blur-sm ${shouldUseFullHeight ? "min-h-0" : ""}`}
            >
              <table className="border-separate border-spacing-0 w-full min-w-fit">
                <thead className="sticky top-0 z-30">
                  <tr>
                    <th className="sticky left-0 top-0 bg-black text-white z-40 px-2 md:px-3 py-3 border-r border-b border-white/15 text-center text-xs md:text-sm font-semibold whitespace-nowrap w-auto max-w-fit">
                      Room
                    </th>
                    {filteredTimeIntervals.map((time, index) => (
                      <th
                        key={time}
                        className={`sticky top-0 bg-black text-white z-30 px-6 md:px-6 py-3 md:py-3 border-b border-white/15 text-center text-xs md:text-sm font-medium whitespace-nowrap ${index === filteredTimeIntervals.length - 1 ? "" : "border-r border-white/15"}`}
                        style={{
                          minWidth: "75px",
                          width: "auto",
                          maxWidth: "fit-content",
                        }}
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
                            style={{
                              minWidth: "35px",
                              width: "auto",
                              maxWidth: "fit-content",
                            }}
                          >
                            <div className="h-5 md:h-6"></div>
                          </td>
                        ))}
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </motion.div>
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
