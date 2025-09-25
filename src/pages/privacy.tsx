// src/pages/privacy.tsx
import React from "react";
import Head from "next/head";
import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

export default function PrivacyPage() {
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
        <title>Privacy Policy - vacansee</title>
      </Head>

      <motion.div
        initial="hidden"
        animate="visible"
  variants={{ visible: { transition: { staggerChildren: 0.1 } } } as const}
        className="space-y-8"
      >
        <motion.div variants={sectionVariant} className="text-center mb-10">
          <ShieldCheck className="mx-auto h-12 w-12 text-purple-400 mb-4" />
          <h1 className="text-4xl md:text-5xl font-bold text-white/95">
            Privacy Policy
          </h1>
          <p className="text-lg text-white/70 mt-2">
            Last Updated: 22 April 2025
          </p>
        </motion.div>

        <motion.section variants={sectionVariant} className="space-y-3">
          <h2 className="text-2xl font-semibold text-white/90 border-b border-white/20 pb-2">
            1. Introduction
          </h2>
          <p className="text-white/80">
            This Privacy Policy explains how vacansee (&quot;we&quot;,
            &quot;us&quot;, or &quot;our&quot;) collects, uses, and discloses
            information about you when you access or use our application (the
            &quot;Service&quot;).
          </p>
        </motion.section>

        <motion.section variants={sectionVariant} className="space-y-3">
          <h2 className="text-2xl font-semibold text-white/90 border-b border-white/20 pb-2">
            2. Information We Collect
          </h2>
          <p className="text-white/80">
            We collect information in the following ways:
          </p>
          <ul className="list-disc list-inside space-y-1 text-white/80 pl-4">
            <li>
              <strong>Authentication Information:</strong> When you log in via
              Google or GitHub OAuth using Supabase Auth, we receive your name,
              email address, and profile picture URL. This information is used
              solely for identity verification within the Service.
            </li>
            <li>
              <strong>Usage Data:</strong> We collect data such as pages
              visited, time spent, and interactions to understand engagement and
              performance. This is collected via Vercel Analytics and Vercel
              Speed Insights.
            </li>
            <li>
              <strong>Cookies:</strong> Supabase uses HttpOnly cookies to manage
              login sessions securely. We do not use cookies for third-party
              tracking or advertising purposes.
            </li>
          </ul>
        </motion.section>

        <motion.section variants={sectionVariant} className="space-y-3">
          <h2 className="text-2xl font-semibold text-white/90 border-b border-white/20 pb-2">
            3. How We Use Information
          </h2>
          <ul className="list-disc list-inside space-y-1 text-white/80 pl-4">
            <li>To authenticate users and manage session state.</li>
            <li>To provide, maintain, and improve the Service.</li>
            <li>
              To analyze how the Service is used and identify areas for
              enhancement.
            </li>
            <li>To protect against security threats and technical issues.</li>
          </ul>
        </motion.section>

        <motion.section variants={sectionVariant} className="space-y-3">
          <h2 className="text-2xl font-semibold text-white/90 border-b border-white/20 pb-2">
            4. Sharing of Information
          </h2>
          <p className="text-white/80">
            We do not sell your personal information. We may share data only in
            these cases:
          </p>
          <ul className="list-disc list-inside space-y-1 text-white/80 pl-4">
            <li>
              <strong>Service Providers:</strong> We use Supabase (for
              authentication and database services) and Vercel (for hosting and
              analytics). These providers access only what&apos;s necessary to
              deliver their services.
            </li>
            <li>
              <strong>Legal Requirements:</strong> We may disclose data if
              required to comply with a legal obligation or protect the rights,
              safety, or property of users or the public.
            </li>
          </ul>
        </motion.section>

        <motion.section variants={sectionVariant} className="space-y-3">
          <h2 className="text-2xl font-semibold text-white/90 border-b border-white/20 pb-2">
            5. Data Security
          </h2>
          <p className="text-white/80">
            We use Supabase’s managed security systems and Vercel’s secure
            hosting to protect your information. This includes encryption at
            rest and in transit, access control, and routine monitoring.
            However, no system can be 100% secure.
          </p>
        </motion.section>

        <motion.section variants={sectionVariant} className="space-y-3">
          <h2 className="text-2xl font-semibold text-white/90 border-b border-white/20 pb-2">
            6. Data Retention
          </h2>
          <p className="text-white/80">
            Authentication data is stored as long as your account is active.
            Analytics and logs may be retained in aggregate form to monitor
            performance and detect abuse.
          </p>
        </motion.section>

        <motion.section variants={sectionVariant} className="space-y-3">
          <h2 className="text-2xl font-semibold text-white/90 border-b border-white/20 pb-2">
            7. Your Rights
          </h2>
          <p className="text-white/80">
            Depending on your location, you may have rights such as access,
            correction, or deletion of your data. For most data, managing your
            Google or GitHub account is sufficient. You may also{" "}
            <a
              href="https://tahayparker.vercel.app/contact"
              className="underline text-purple-400"
            >
              contact us
            </a>{" "}
            directly for any requests related to your data stored within
            vacansee.
          </p>
        </motion.section>

        <motion.section variants={sectionVariant} className="space-y-3">
          <h2 className="text-2xl font-semibold text-white/90 border-b border-white/20 pb-2">
            8. Updates to This Policy
          </h2>
          <p className="text-white/80">
            This Privacy Policy may be updated periodically. Changes will be
            reflected on this page with the revised &quot;Last Updated&quot;
            date.
          </p>
        </motion.section>

        <motion.section variants={sectionVariant} className="space-y-3">
          <h2 className="text-2xl font-semibold text-white/90 border-b border-white/20 pb-2">
            9. Contact Us
          </h2>
          <p className="text-white/80">
            For questions or concerns about this Privacy Policy, please reach
            out at{" "}
            <a
              href="https://tahayparker.vercel.app/contact"
              className="underline text-purple-400"
            >
              https://tahayparker.vercel.app/contact
            </a>
            .
          </p>
        </motion.section>
      </motion.div>
    </div>
  );
}
