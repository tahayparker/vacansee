// pages/index.tsx
import React from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import Link from "next/link";

// Main Page Component - Returns ONLY content, no layout wrappers
export default function Home() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  // Return the content block directly. _app.tsx handles centering.
  // Added py-10 for vertical spacing within the centered block
  return (
    <div className="relative text-center max-w-4xl py-10">
      {" "}
      {/* No flex, no grow, no centering. Added py-10 */}
      {/* Background Glow */}
      <motion.div
        className="absolute inset-0 -z-10 overflow-visible"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] bg-purple-800/30 rounded-full blur-[100px] sm:blur-[150px]" />
      </motion.div>
      {/* Content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.h1
          variants={itemVariants}
          className="text-5xl sm:text-6xl md:text-7xl font-bold mb-5 tracking-tight leading-tight bg-gradient-to-r from-purple-400 via-pink-500 to-orange-400 bg-clip-text text-transparent"
        >
          Find Open Rooms <br className="sm:hidden" /> Across Campus, Instantly.
        </motion.h1>
        <motion.p
          variants={itemVariants}
          className="text-lg sm:text-xl text-white/80 mb-10 max-w-2xl mx-auto"
        >
          Stop wandering the halls. vacansee scans university schedules to show
          you available rooms right when you need them.
        </motion.p>
        <motion.div
          variants={itemVariants}
          className="flex gap-4 items-center justify-center flex-col sm:flex-row"
        >
          <Link
            className="group relative inline-flex items-center justify-center rounded-full border border-solid border-transparent transition-colors bg-purple-600 text-white gap-2 shadow-lg hover:bg-purple-700 hover:shadow-purple-500/30 font-medium text-sm sm:text-base h-11 sm:h-12 px-6 sm:px-8 w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-background"
            href="/check"
          >
            <Search className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
            Check Availability Now
          </Link>
          <Link
            className="rounded-full border border-solid border-white/[.3] transition-colors flex items-center justify-center hover:bg-white/[.1] hover:border-white/[.5] font-medium text-sm sm:text-base h-11 sm:h-12 px-6 sm:px-8 w-full sm:w-auto text-white"
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn More
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
