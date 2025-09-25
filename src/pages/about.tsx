// src/pages/about.tsx
import React from "react";
import Head from "next/head";
import { motion } from "framer-motion";
import Link from "next/link";
import { Info, Target, Cpu, Mail } from "lucide-react";

export default function AboutPage() {
  const sectionVariant = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  } as const;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 pt-20 md:pt-24 flex-grow flex flex-col items-center text-white">
      <Head>
        <title>About - vacansee</title>
      </Head>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        className="space-y-10 text-center md:text-left"
      >
        <motion.h1
          variants={sectionVariant}
          className="text-4xl md:text-5xl font-bold mb-6 text-center bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent"
        >
          About vacansee
        </motion.h1>

        <motion.section
          variants={sectionVariant}
          className="space-y-3 text-lg text-white/80 max-w-3xl mx-auto text-center"
        >
          <Info className="mx-auto h-10 w-10 text-purple-400 mb-3" />
          <h2 className="text-2xl font-semibold text-white/90">
            What is vacansee?
          </h2>
          <p>
            vacansee is a modern web application designed to provide real-time
            information about room availability and scheduling within the
            university campus.
          </p>
          <p>
            It aims to replace legacy systems with a faster, more intuitive, and
            visually appealing interface.
          </p>
        </motion.section>

        <motion.section
          variants={sectionVariant}
          className="space-y-3 text-lg text-white/80 max-w-3xl mx-auto text-center"
        >
          <Target className="mx-auto h-10 w-10 text-purple-400 mb-3" />
          <h2 className="text-2xl font-semibold text-white/90">Our Goal</h2>
          <p>
            The primary goal is to make finding an available room quick and
            effortless. Whether you need a quiet place to study, a room for a
            group meeting, or just want to see the campus schedule at a glance,
            vacansee provides the necessary tools.
          </p>
        </motion.section>

        <motion.section
          variants={sectionVariant}
          className="space-y-3 text-lg text-white/80 max-w-3xl mx-auto text-center"
        >
          <Cpu className="mx-auto h-10 w-10 text-purple-400 mb-3" />
          <h2 className="text-2xl font-semibold text-white/90">Technology</h2>
          <p>
            Built using modern web technologies including Next.js, React,
            TypeScript, Tailwind CSS, and Supabase for backend services,
            vacansee prioritizes performance and user experience.
          </p>
        </motion.section>

        <motion.section
          variants={sectionVariant}
          className="space-y-3 text-lg text-white/80 max-w-3xl mx-auto text-center"
        >
          <Mail className="mx-auto h-10 w-10 text-purple-400 mb-3" />
          <h2 className="text-2xl font-semibold text-white/90">Contact</h2>
          <p>
            For questions or feedback, please reach out to the project
            administrator.
          </p>
          <p className="text-sm text-white/60">
            <Link
              href="https://tahayparker.vercel.app/contact"
              target="_blank"
              className="text-purple-400 hover:underline"
            >
              Contact Me
            </Link>
          </p>
        </motion.section>
      </motion.div>
    </div>
  );
}
