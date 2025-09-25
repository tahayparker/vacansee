// src/pages/docs.tsx
import React from "react";
import Head from "next/head";
import Link from "next/link";
import { motion } from "framer-motion";
// Updated icons to match the consistent style
import {
  ListChecks,
  Cpu,
  Terminal,
  GitBranch,
  Mail,
  Info,
  Target,
  Settings,
} from "lucide-react";

export default function DocsPage() {
  const sectionVariant = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  } as const;

  const listItemVariant = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  } as const;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 pt-20 md:pt-24 flex-grow flex flex-col text-white">
      <Head>
        <title>Documentation - vacansee</title>
      </Head>

      <motion.div
        initial="hidden"
        animate="visible"
  variants={{ visible: { transition: { staggerChildren: 0.1 } } } as const}
        className="space-y-10" // Increased spacing between sections slightly
      >
        {/* --- Header Section (Slightly adjusted) --- */}
        <motion.div variants={sectionVariant} className="text-center mb-12">
          {" "}
          {/* Increased mb */}
          {/* Using Settings icon for general info */}
          <Settings className="mx-auto h-12 w-12 text-purple-400 mb-4" />
          <h1 className="text-4xl md:text-5xl font-bold text-white/95">
            vacansee Documentation
          </h1>
          <p className="text-lg text-white/70 mt-2">
            Overview, Features, and Setup Information.
          </p>
        </motion.div>

        {/* --- What is vacansee? Section (Styled Consistently) --- */}
        <motion.section variants={sectionVariant} className="space-y-4">
          <div className="flex items-center gap-3 border-b border-white/20 pb-2 mb-3">
            <Info className="h-6 w-6 text-purple-400 flex-shrink-0" />
            <h2 className="text-2xl font-semibold text-white/90">
              What is vacansee?
            </h2>
          </div>
          <p className="text-white/80 text-lg">
            vacansee is a modern web application designed to provide real-time
            information about room availability and scheduling within the
            university campus.
          </p>
          <p className="text-white/80 text-lg">
            It aims to replace legacy systems with a faster, more intuitive, and
            visually appealing interface.
          </p>
        </motion.section>

        {/* --- Our Goal Section (Styled Consistently) --- */}
        <motion.section variants={sectionVariant} className="space-y-4">
          <div className="flex items-center gap-3 border-b border-white/20 pb-2 mb-3">
            <Target className="h-6 w-6 text-purple-400 flex-shrink-0" />
            <h2 className="text-2xl font-semibold text-white/90">Our Goal</h2>
          </div>
          <p className="text-white/80 text-lg">
            The primary goal is to make finding an available room quick and
            effortless. Whether you need a quiet place to study, a room for a
            group meeting, or just want to see the campus schedule at a glance,
            vacansee provides the necessary tools.
          </p>
        </motion.section>

        {/* Features Section (Unchanged structure, content updated slightly) */}
        <motion.section variants={sectionVariant} className="space-y-4">
          <div className="flex items-center gap-3 border-b border-white/20 pb-2 mb-3">
            <ListChecks className="h-6 w-6 text-purple-400 flex-shrink-0" />
            <h2 className="text-2xl font-semibold text-white/90">Features</h2>
          </div>
          <ul className="list-disc list-inside space-y-2 text-white/80 pl-1 text-lg">
            <motion.li variants={listItemVariant}>
              Real-time &quot;Available Now&quot; Check
            </motion.li>
            <motion.li variants={listItemVariant}>
              &quot;Available Soon&quot; Projections (30m, 1h, etc.)
            </motion.li>
            <motion.li variants={listItemVariant}>
              Specific Time Slot Availability Check
            </motion.li>
            <motion.li variants={listItemVariant}>
              Room Details List (Name, Code, Capacity)
            </motion.li>
            <motion.li variants={listItemVariant}>
              Interactive Schedule Graph View
            </motion.li>
            <motion.li variants={listItemVariant}>
              Fuzzy Search for Rooms (Check & Custom Graph)
            </motion.li>
            <motion.li variants={listItemVariant}>
              Automatic Timetable Updates
            </motion.li>
            <motion.li variants={listItemVariant}>
              Mobile Responsive Design
            </motion.li>
            <motion.li variants={listItemVariant}>
              Secure Authentication (Google/GitHub)
            </motion.li>
          </ul>
        </motion.section>

        {/* Tech Stack Section (Unchanged structure) */}
        <motion.section variants={sectionVariant} className="space-y-4">
          <div className="flex items-center gap-3 border-b border-white/20 pb-2 mb-3">
            <Cpu className="h-6 w-6 text-purple-400 flex-shrink-0" />
            <h2 className="text-2xl font-semibold text-white/90">Tech Stack</h2>
          </div>
          <ul className="list-disc list-inside space-y-2 text-white/80 pl-1 text-lg">
            <motion.li variants={listItemVariant}>
              <strong>Frontend:</strong> Next.js (Pages Router), TypeScript,
              Tailwind CSS, Shadcn UI, Framer Motion
            </motion.li>
            <motion.li variants={listItemVariant}>
              <strong>Backend:</strong> Next.js API Routes, Prisma ORM
            </motion.li>
            <motion.li variants={listItemVariant}>
              <strong>Database:</strong> PostgreSQL (hosted on Supabase)
            </motion.li>
            <motion.li variants={listItemVariant}>
              <strong>Authentication:</strong> Supabase Auth (OAuth)
            </motion.li>
            <motion.li variants={listItemVariant}>
              <strong>Deployment & Analytics:</strong> Vercel
            </motion.li>
            <motion.li variants={listItemVariant}>
              <strong>Styling:</strong> Tailwind CSS, CSS Modules
            </motion.li>
            <motion.li variants={listItemVariant}>
              <strong>Data Handling:</strong> Python scripts (Scraping &
              Schedule Generation)
            </motion.li>
            <motion.li variants={listItemVariant}>
              <strong>Libraries:</strong> Fuse.js, Luxon, date-fns, Lucide Icons
            </motion.li>
          </ul>
        </motion.section>

        {/* Getting Started Section (Unchanged structure) */}
        <motion.section variants={sectionVariant} className="space-y-4">
          <div className="flex items-center gap-3 border-b border-white/20 pb-2 mb-3">
            <Terminal className="h-6 w-6 text-purple-400 flex-shrink-0" />
            <h2 className="text-2xl font-semibold text-white/90">
              Getting Started (Development)
            </h2>
          </div>
          <p className="text-white/80 text-lg">
            To set up the project locally:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-white/80 pl-1 text-lg">
            <motion.li variants={listItemVariant}>
              Clone the repository from GitHub.
            </motion.li>
            <motion.li variants={listItemVariant}>
              Install dependencies using `npm install` or `yarn install`.
            </motion.li>
            <motion.li variants={listItemVariant}>
              Create a `.env` file with Supabase/Prisma connection details.
            </motion.li>
            <motion.li variants={listItemVariant}>
              Initialize the database schema: `npx prisma db push`.
            </motion.li>
            <motion.li variants={listItemVariant}>
              Run the development server: `npm run dev`.
            </motion.li>
          </ol>
          <p className="text-sm text-white/70">
            Refer to the project&apos;s{" "}
            <Link
              href="https://github.com/tahayparker/vacansee"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline"
            >
              README on GitHub
            </Link>{" "}
            for detailed setup.
          </p>
        </motion.section>

        {/* --- MODIFIED: Automatic Updates Section --- */}
        <motion.section variants={sectionVariant} className="space-y-4">
          <div className="flex items-center gap-3 border-b border-white/20 pb-2 mb-3">
            <GitBranch className="h-6 w-6 text-purple-400 flex-shrink-0" />
            <h2 className="text-2xl font-semibold text-white/90">
              Automatic Updates
            </h2>
          </div>
          <p className="text-white/80 text-lg">
            {/* Updated frequency */}
            The core timetable data powering the application is automatically
            updated every 4 hours via a GitHub Actions workflow. This ensures
            the schedule information remains reasonably current throughout the
            day.
          </p>
          <p className="text-sm text-white/70">
            The workflow involves scraping the source timetable, updating the
            database, generating static schedule files, and committing changes.
          </p>
        </motion.section>
        {/* --- END MODIFICATION --- */}

        {/* Contact Section (Unchanged structure) */}
        <motion.section variants={sectionVariant} className="space-y-4">
          <div className="flex items-center gap-3 border-b border-white/20 pb-2 mb-3">
            <Mail className="h-6 w-6 text-purple-400 flex-shrink-0" />
            <h2 className="text-2xl font-semibold text-white/90">Contact</h2>
          </div>
          <p className="text-white/80 text-lg">
            For inquiries about the project, please contact Taha Parker via his
            <Link
              href="https://tahayparker.vercel.app/contact"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline ml-1"
            >
              website
            </Link>
            .
          </p>
          <p className="text-white/80 text-lg">
            Project Link:{" "}
            <Link
              href="https://github.com/tahayparker/vacansee"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline"
            >
              https://github.com/tahayparker/vacansee
            </Link>
          </p>
        </motion.section>
      </motion.div>
    </div>
  );
}
