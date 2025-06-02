// src/pages/maintenance.tsx
import React from "react";
import Head from "next/head";
import { Settings } from "lucide-react";
import type { GetServerSideProps, NextPage } from "next"; // Import GetServerSideProps

interface MaintenancePageProps {} // eslint-disable-line @typescript-eslint/no-empty-object-type

const MaintenancePage: NextPage<MaintenancePageProps> = () => {
  return (
    <>
      <Head>
        <title>Maintenance Mode - vacansee</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="relative flex flex-col flex-grow items-center justify-center text-center z-10 w-full px-4 sm:px-8 text-white">
        <div className="max-w-xl">
          <Settings className="mx-auto h-16 w-16 text-purple-400 mb-6" />
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Maintenance Mode
          </h1>
          <p className="text-lg text-white/80 mb-2 font-bold">
            vacansee is currently undergoing scheduled maintenance.
          </p>
          <p className="text-md text-white/70">
            We&apos;re working hard to improve your experience and will be back
            online shortly. Thank you for your patience!
          </p>
        </div>
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps<
  MaintenancePageProps
> = async () => {
  const isMaintenanceModeActive =
    process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";

  if (!isMaintenanceModeActive) {
    // If maintenance mode is OFF, redirect to the homepage
    console.log(
      "[Maintenance Page GSSP] Maintenance mode is OFF. Redirecting to /.",
    );
    return {
      redirect: {
        destination: "/",
        permanent: false, // Use false as this state can change
      },
    };
  }

  // If maintenance mode is ON, render the page normally
  console.log(
    "[Maintenance Page GSSP] Maintenance mode is ON. Rendering maintenance page.",
  );
  return {
    props: {}, // No specific props needed for the maintenance page itself
  };
};

export default MaintenancePage;
