// src/pages/legal.tsx
import React from "react";
import Head from "next/head";
import { motion } from "framer-motion";
import { Scale } from "lucide-react";

export default function LegalPage() {
  const sectionVariant = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  } as const;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 pt-20 md:pt-24 flex-grow flex flex-col text-white">
      <Head>
        <title>Legal - Terms of Service - vacansee</title>
      </Head>

      <motion.div
        initial="hidden"
        animate="visible"
  variants={{ visible: { transition: { staggerChildren: 0.1 } } } as const}
        className="space-y-8"
      >
        <motion.div variants={sectionVariant} className="text-center mb-10">
          <Scale className="mx-auto h-12 w-12 text-purple-400 mb-4" />
          <h1 className="text-4xl md:text-5xl font-bold text-white/95">
            Terms of Service
          </h1>
          <p className="text-lg text-white/70 mt-2">
            Last Updated: 22 April 2025
          </p>
        </motion.div>

        <motion.section variants={sectionVariant} className="space-y-3">
          <h2 className="text-2xl font-semibold text-white/90 border-b border-white/20 pb-2">
            1. Acceptance of Terms
          </h2>
          <p className="text-white/80">
            By accessing or using the vacansee platform (&quot;Service&quot;),
            you agree to be bound by these Terms of Service (&quot;Terms&quot;).
            If you do not agree with any part of the Terms, you must not use the
            Service.
          </p>
        </motion.section>

        <motion.section variants={sectionVariant} className="space-y-3">
          <h2 className="text-2xl font-semibold text-white/90 border-b border-white/20 pb-2">
            2. Service Description
          </h2>
          <p className="text-white/80">
            vacansee is a web-based tool that provides room availability and
            schedule information based on data obtained from university systems.
            We strive for accuracy, but we do not guarantee the completeness,
            accuracy, or timeliness of the data presented.
          </p>
        </motion.section>

        <motion.section variants={sectionVariant} className="space-y-3">
          <h2 className="text-2xl font-semibold text-white/90 border-b border-white/20 pb-2">
            3. User Conduct
          </h2>
          <p className="text-white/80">
            You agree to use the Service only for lawful purposes. You may not:
            <ul className="list-disc pl-5 mt-2">
              <li>
                Attempt to interfere with or compromise the Service&apos;s
                integrity or security.
              </li>
              <li>Scrape, copy, or redistribute data without permission.</li>
              <li>Use the Service to harass, abuse, or harm others.</li>
              <li>Gain unauthorized access to the Service or its systems.</li>
            </ul>
          </p>
        </motion.section>

        <motion.section variants={sectionVariant} className="space-y-3">
          <h2 className="text-2xl font-semibold text-white/90 border-b border-white/20 pb-2">
            4. Authentication
          </h2>
          <p className="text-white/80">
            Certain features require authentication via Google or GitHub OAuth,
            managed securely through Supabase Auth. You are responsible for
            safeguarding your login credentials and agree not to share your
            access with others.
          </p>
        </motion.section>

        <motion.section variants={sectionVariant} className="space-y-3">
          <h2 className="text-2xl font-semibold text-white/90 border-b border-white/20 pb-2">
            5. Intellectual Property
          </h2>
          <p className="text-white/80">
            All content and functionality of the Service—including but not
            limited to code, design, text, graphics, and branding—are the
            exclusive property of Taha Parker and/or the vacansee team and are
            protected by applicable copyright and intellectual property laws.
          </p>
        </motion.section>

        <motion.section variants={sectionVariant} className="space-y-3">
          <h2 className="text-2xl font-semibold text-white/90 border-b border-white/20 pb-2">
            6. Disclaimers and Limitation of Liability
          </h2>
          <p className="text-white/80">
            The Service is provided on an &quot;AS IS&quot; and &quot;AS
            AVAILABLE&quot; basis. We make no warranties, express or implied,
            and disclaim all responsibility for:
            <ul className="list-disc pl-5 mt-2">
              <li>
                Any loss or damage resulting from reliance on data provided.
              </li>
              <li>Service interruptions, inaccuracies, or omissions.</li>
            </ul>
            Under no circumstances shall vacansee or its affiliates be liable
            for any indirect, incidental, or consequential damages arising from
            your use of the Service.
          </p>
        </motion.section>

        <motion.section variants={sectionVariant} className="space-y-3">
          <h2 className="text-2xl font-semibold text-white/90 border-b border-white/20 pb-2">
            7. Governing Law
          </h2>
          <p className="text-white/80">
            These Terms shall be governed and construed in accordance with the
            laws of the United Arab Emirates, without regard to its conflict of
            law principles.
          </p>
        </motion.section>

        <motion.section variants={sectionVariant} className="space-y-3">
          <h2 className="text-2xl font-semibold text-white/90 border-b border-white/20 pb-2">
            8. Changes to Terms
          </h2>
          <p className="text-white/80">
            We reserve the right to update or modify these Terms at any time.
            Any changes will be effective immediately upon posting. You are
            advised to review this page periodically. Continued use of the
            Service after any changes constitutes acceptance of the new Terms.
          </p>
        </motion.section>

        <motion.section variants={sectionVariant} className="space-y-3">
          <h2 className="text-2xl font-semibold text-white/90 border-b border-white/20 pb-2">
            9. Contact Us
          </h2>
          <p className="text-white/80">
            For any questions regarding these Terms, please contact us{" "}
            <a
              href="mailto:https://tahayparker.vercel.app/contact"
              className="underline text-purple-400"
            >
              here
            </a>
            .
          </p>
        </motion.section>
      </motion.div>
    </div>
  );
}
