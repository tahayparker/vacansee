// src/components/SiteHeader.tsx
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { motion, AnimatePresence } from "framer-motion";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  DoorOpen,
  Clock,
  Search,
  Grid3x3,
  BadgeInfo,
  LogIn,
  UserRound,
  LogOut,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import localFont from "next/font/local";

// Configure the local font loader
const qurovaFont = localFont({
  src: "../../public/fonts/Qurova-SemiBold.otf", // Adjust the path as necessary
  weight: "600", // Corresponds to Semibold
  display: "swap", // Good practice for font loading
});

// --- Navigation Items ---
const navItems = [
  { name: "Currently Available", href: "/available-now", icon: DoorOpen },
  { name: "Available Soon", href: "/available-soon", icon: Clock },
  { name: "Check Availability", href: "/check", icon: Search },
  { name: "Graph", href: "/graph", icon: Grid3x3 },
  { name: "Room Details", href: "/rooms", icon: BadgeInfo },
];
type NavItemType = (typeof navItems)[0];

// --- NavLink Component ---
const NavLink = React.forwardRef<
  React.ElementRef<"li">,
  Omit<React.ComponentPropsWithoutRef<typeof Link>, "href" | "children"> & {
    item: NavItemType;
    isMobile?: boolean;
    isDesktop?: boolean;
    currentPath: string;
    isHovered: boolean;
    onHoverStart: () => void;
    onHoverEnd: () => void;
    onClick?: () => void;
  }
>(
  (
    {
      className,
      item,
      isMobile,
      isDesktop,
      currentPath,
      isHovered,
      onHoverStart,
      onHoverEnd,
      onClick,
    },
    ref,
  ) => {
    const isActuallyActive = item.href === currentPath;
    const layoutTransition = { type: "spring", stiffness: 500, damping: 35 };
    const labelTransition = { duration: 0.2, ease: "easeInOut" };

    if (isMobile) {
      return (
        <li ref={ref}>
          <Link
            href={item.href}
            className={
              "flex items-center gap-3 w-full p-3 rounded-md transition-colors duration-200 ease-in-out " +
              (isActuallyActive
                ? "text-purple-300 font-semibold bg-white/5"
                : "text-white/80 hover:text-white hover:bg-white/10 ") +
              (className ?? "")
            }
            onClick={onClick}
            aria-current={isActuallyActive ? "page" : undefined}
          >
            {item.icon && <item.icon className="h-5 w-5 flex-shrink-0" />}
            <span className="flex-grow text-base">{item.name}</span>
          </Link>
        </li>
      );
    }

    if (isDesktop) {
      const showActiveState = isHovered || isActuallyActive;
      const textColorClass = isHovered
        ? "text-white"
        : isActuallyActive
          ? "text-white/90"
          : "text-white/70";

      return (
        <motion.li
          ref={ref}
          layout
          transition={layoutTransition}
          onHoverStart={onHoverStart}
          onHoverEnd={onHoverEnd}
          className="flex"
        >
          <Link
            href={item.href}
            aria-current={isActuallyActive ? "page" : undefined}
            className={
              `relative flex items-center justify-center rounded-full transition-colors duration-200 ease-in-out overflow-hidden ` +
              (showActiveState
                ? `bg-white/10 px-3 py-1.5 `
                : `p-2 hover:hover:bg-white/10 `) +
              textColorClass +
              (className ?? "")
            }
          >
            {item.icon && <item.icon className="h-5 w-5 flex-shrink-0" />}
            <AnimatePresence>
              {showActiveState && (
                <motion.span
                  key="label"
                  initial={{ width: 0, opacity: 0, marginLeft: 0 }}
                  animate={{
                    width: "auto",
                    opacity: 1,
                    marginLeft: "0.375rem",
                  }}
                  exit={{ width: 0, opacity: 0, marginLeft: 0 }}
                  transition={labelTransition}
                  className="text-sm font-medium whitespace-nowrap"
                  style={{ lineHeight: "normal" }}
                >
                  {item.name}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </motion.li>
      );
    }
    return <li ref={ref}></li>;
  },
);
NavLink.displayName = "NavLink";

// --- Header Component Props Interface ---
interface SiteHeaderProps {
  maintenanceMode?: boolean;
}

// --- Header Component ---
export default function SiteHeader({
  maintenanceMode = false,
}: SiteHeaderProps) {
  // --- State Variables ---
  const [isMounted, setIsMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hoveredHref, setHoveredHref] = useState<string | null>(null);
  const [isAuthHovered, setIsAuthHovered] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const router = useRouter();
  const currentPath = router.pathname;

  // --- Supabase Auth State ---
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const supabase = getSupabaseBrowserClient();

  // --- Effects ---
  useEffect(() => {
    setIsMounted(true);
    let isSubscribed = true;
    const fetchUserAndListen = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (isSubscribed) {
          setUser(session?.user ?? null);
          setLoadingAuth(false);
        }
      } catch (error) {
        console.error("Error fetching initial session:", error);
        if (isSubscribed) setLoadingAuth(false);
      }
      const { data: authListener } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          if (isSubscribed) {
            console.log("Auth state changed:", _event);
            setUser(session?.user ?? null);
            setLoadingAuth(false);
            if (_event === "SIGNED_IN" || _event === "SIGNED_OUT") {
              setIsMenuOpen(false);
              setIsPopoverOpen(false);
            }
          }
        },
      );
      return () => {
        authListener?.subscription.unsubscribe();
      };
    };

    let unsubscribeListener: (() => void) | undefined;
    fetchUserAndListen()
      .then((cleanup) => {
        unsubscribeListener = cleanup;
      })
      .catch((error) => {
        console.error("Error setting up auth listener:", error);
        if (isSubscribed) setLoadingAuth(false);
      });

    return () => {
      isSubscribed = false;
      unsubscribeListener?.();
    };
  }, [supabase]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [currentPath]);

  // --- Handlers ---
  const handleSignOut = async () => {
    setIsMenuOpen(false);
    setIsPopoverOpen(false);
    setLoadingAuth(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Error signing out:", error);
        setLoadingAuth(false);
      } else {
        console.log("Signed out successfully");
        router.push("/");
      }
    } catch (error) {
      console.error("Exception during sign out:", error);
      setLoadingAuth(false);
    }
  };

  // --- Constants ---
  const menuToggleTransition = { duration: 0.2 };
  const mobilePanelTransition = { duration: 0.2, ease: "easeOut" };
  const mobileBackdropTransition = { duration: 0.2, ease: "linear" };
  const authLayoutTransition = { type: "spring", stiffness: 400, damping: 30 };
  const authLabelTransition = { duration: 0.2, ease: "easeInOut" };
  const userDisplayName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const userEmail = user?.email || "No email provided";
  const showActiveAuthStyle = isAuthHovered || isPopoverOpen;

  // --- Component Return ---
  return (
    <>
      {/* --- Header Element --- */}
      <header
        className={
          "fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between px-4 sm:px-6 md:px-8 bg-black/5 backdrop-blur-lg border-b border-white/10"
        }
      >
        {/* Left side: Brand (Always Visible) */}
        <div className="flex-shrink-0 z-10 flex items-center">
          <Link
            href="/"
            className="flex items-center gap-2 text-white font-semibold transition-opacity hover:opacity-80"
            onClick={(e) => {
              if (maintenanceMode && router.pathname !== "/maintenance") {
                e.preventDefault();
                router.push("/maintenance");
              }
            }}
          >
            <DoorOpen className="h-6 w-6 text-purple-400" />
            <span className={`sm:inline text-xl mt-1 ${qurovaFont.className}`}>
              vacansee
            </span>
          </Link>
        </div>

        {/* Right side: Conditional rendering based on maintenanceMode */}
        {!maintenanceMode && isMounted && (
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Desktop Navigation */}
            <nav className="hidden md:flex">
              <ul className="flex items-center gap-x-1">
                {navItems.map((navItem) => (
                  <NavLink
                    key={navItem.href}
                    item={navItem}
                    isDesktop={true}
                    currentPath={currentPath}
                    isHovered={hoveredHref === navItem.href}
                    onHoverStart={() => setHoveredHref(navItem.href)}
                    onHoverEnd={() => setHoveredHref(null)}
                  />
                ))}
              </ul>
            </nav>

            {/* Auth Status - DESKTOP */}
            <div className="hidden md:flex items-center ml-2 h-10">
              <AnimatePresence mode="wait" initial={false}>
                {loadingAuth ? (
                  <motion.div
                    key="auth-loader"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-8 h-8 flex items-center justify-center"
                  >
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white/50"></div>
                  </motion.div>
                ) : user ? (
                  <motion.div
                    key="profile-container-desktop"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center"
                    onHoverStart={() => setIsAuthHovered(true)}
                    onHoverEnd={() => setIsAuthHovered(false)}
                  >
                    <Popover
                      open={isPopoverOpen}
                      onOpenChange={setIsPopoverOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          className={
                            `relative flex items-center justify-center rounded-full transition-colors duration-200 ease-in-out overflow-hidden ` +
                            (showActiveAuthStyle
                              ? `bg-white/10 px-3 py-1.5 `
                              : `p-2 hover:hover:bg-white/10 `) +
                            (showActiveAuthStyle
                              ? "text-white"
                              : "text-white/80")
                          }
                          aria-label="User menu"
                        >
                          <span className="flex items-center justify-center">
                            <UserRound className="h-5 w-5 flex-shrink-0" />
                            <AnimatePresence>
                              {showActiveAuthStyle && (
                                <motion.span
                                  key="profile-label"
                                  initial={{
                                    width: 0,
                                    opacity: 0,
                                    marginLeft: 0,
                                  }}
                                  animate={{
                                    width: "auto",
                                    opacity: 1,
                                    marginLeft: "0.375rem",
                                  }}
                                  exit={{
                                    width: 0,
                                    opacity: 0,
                                    marginLeft: 0,
                                  }}
                                  transition={authLabelTransition}
                                  className="text-sm font-medium whitespace-nowrap"
                                  style={{ lineHeight: "normal" }}
                                >
                                  Profile
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-60 bg-gradient-to-br from-[#100643]/65 to-black/60 backdrop-blur-3xl border border-white/15 text-white p-0 mr-4 shadow-xl z-[70]"
                        align="end"
                      >
                        <div className="p-4">
                          <p
                            className="font-semibold text-sm truncate"
                            title={userDisplayName}
                          >
                            {userDisplayName}
                          </p>
                          <p
                            className="text-xs text-white/70 truncate"
                            title={userEmail}
                          >
                            {userEmail}
                          </p>
                        </div>
                        <Separator className="bg-white/10" />
                        <Button
                          variant="ghost"
                          onClick={handleSignOut}
                          className="w-full justify-start p-4 text-red-400 hover:text-red-300 hover:bg-white/5 rounded-none rounded-b-md text-sm"
                        >
                          <LogOut className="h-4 w-4 mr-2" /> Sign Out
                        </Button>
                      </PopoverContent>
                    </Popover>
                  </motion.div>
                ) : (
                  <motion.div
                    key="signin-button-desktop"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={authLayoutTransition}
                    onHoverStart={() => setIsAuthHovered(true)}
                    onHoverEnd={() => setIsAuthHovered(false)}
                    className="flex"
                  >
                    <Link
                      href="/auth/login"
                      className={
                        `relative flex items-center justify-center rounded-full transition-colors duration-200 ease-in-out overflow-hidden ` +
                        (isAuthHovered
                          ? `bg-white/10 px-3 py-1.5 `
                          : `p-2 hover:hover:bg-white/10 `) +
                        (isAuthHovered ? "text-white" : "text-white/70")
                      }
                    >
                      <LogIn className="h-5 w-5 flex-shrink-0" />
                      <AnimatePresence>
                        {isAuthHovered && (
                          <motion.span
                            key="auth-label"
                            initial={{ width: 0, opacity: 0, marginLeft: 0 }}
                            animate={{
                              width: "auto",
                              opacity: 1,
                              marginLeft: "0.375rem",
                            }}
                            exit={{ width: 0, opacity: 0, marginLeft: 0 }}
                            transition={authLabelTransition}
                            className="text-sm font-medium whitespace-nowrap"
                            style={{ lineHeight: "normal" }}
                          >
                            Sign In
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile Menu Trigger */}
            <div className="flex md:hidden ml-1">
              <motion.button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="relative z-[65] flex flex-col justify-center items-center gap-[7px] p-2 rounded-full transition-colors"
                aria-label="Toggle menu"
                aria-expanded={isMenuOpen}
                whileTap={{ scale: 0.95 }}
              >
                <motion.span
                  className="w-5 h-px bg-white block rounded-full"
                  animate={
                    isMenuOpen ? { rotate: 45, y: 4 } : { rotate: 0, y: 0 }
                  }
                  transition={menuToggleTransition}
                />
                <motion.span
                  className="w-5 h-px bg-white block rounded-full"
                  animate={
                    isMenuOpen ? { rotate: -45, y: -4 } : { rotate: 0, y: 0 }
                  }
                  transition={menuToggleTransition}
                />
              </motion.button>
            </div>
          </div>
        )}
        {/* Placeholder if not mounted AND not in maintenance mode */}
        {!maintenanceMode && !isMounted && (
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="hidden md:block w-48 h-8 bg-white/5 rounded-full animate-pulse"></div>
            <div className="w-8 h-8 bg-white/5 rounded-full animate-pulse"></div>
            <div className="w-8 h-8 bg-white/5 rounded-full animate-pulse md:hidden"></div>
          </div>
        )}
      </header>

      {/* --- MODIFIED: Conditionally render mobile menu panel and backdrop --- */}
      {!maintenanceMode && (
        <>
          <AnimatePresence>
            {isMounted && isMenuOpen && (
              <motion.div
                key="mobile-backdrop"
                className="fixed inset-0 top-16 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={mobileBackdropTransition}
                onClick={() => setIsMenuOpen(false)}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {isMounted && isMenuOpen && (
              <motion.div
                key="mobile-menu-panel"
                className={
                  "fixed inset-x-4 top-20 z-50 md:hidden bg-gradient-to-br from-black/80 to-black/90 backdrop-blur-xl border border-white/15 shadow-xl rounded-lg overflow-hidden"
                }
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={mobilePanelTransition}
              >
                <div className="max-h-[calc(100vh-6rem)] overflow-y-auto p-4 flex flex-col">
                  <nav className="mb-4">
                    <ul className="flex flex-col gap-1">
                      {navItems.map((navItem) => (
                        <NavLink
                          key={navItem.href}
                          item={navItem}
                          isMobile={true}
                          currentPath={currentPath}
                          isHovered={false} // Not applicable for mobile list items
                          onHoverStart={() => {}} // Not applicable
                          onHoverEnd={() => {}} // Not applicable
                          onClick={() => setIsMenuOpen(false)}
                        />
                      ))}
                    </ul>
                  </nav>
                  <Separator className="bg-white/20 my-2" />
                  <div className="mt-auto pt-2">
                    {loadingAuth ? (
                      <div className="flex justify-center items-center p-3 h-[76px]">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white/50"></div>
                      </div>
                    ) : user ? (
                      <div className="space-y-3">
                        <div className="px-3">
                          <p
                            className="font-semibold text-sm text-white truncate"
                            title={userDisplayName}
                          >
                            {userDisplayName}
                          </p>
                          <p
                            className="text-xs text-white/60 truncate"
                            title={userEmail}
                          >
                            {userEmail}
                          </p>
                        </div>
                        <button
                          onClick={handleSignOut}
                          className="flex items-center gap-3 w-full p-3 rounded-md text-red-400 hover:text-red-300 hover:bg-white/10 transition-colors duration-200 ease-in-out"
                        >
                          <LogOut className="h-5 w-5 flex-shrink-0" />
                          <span className="flex-grow text-base text-left">
                            Sign Out
                          </span>
                        </button>
                      </div>
                    ) : (
                      <Link
                        href="/auth/login"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-3 w-full p-3 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors duration-200 ease-in-out"
                      >
                        <LogIn className="h-5 w-5 flex-shrink-0" />
                        <span className="flex-grow text-base">Sign In</span>
                      </Link>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </>
  );
}
