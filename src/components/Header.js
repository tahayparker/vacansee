'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Button from './Button';
import { useSession, signOut } from 'next-auth/react';

const styles = {
  glowButton: {
    position: "relative",
    overflow: "hidden"
  }
};

const Header = ({ hideLogoOnHome }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();
  const navLinks = [
    { path: '/CurrentlyAvailable', label: 'Currently Available' },
    { path: '/CheckAvailability', label: 'Check Availability' },
    { path: '/Graph', label: 'Graph' },
    { path: '/RoomDetails', label: 'Room Details' },
    { path: '/CustomGraph', label: 'Custom Graph' }
  ];

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
    // Toggle body scroll
    document.body.style.overflow = menuOpen ? 'auto' : 'hidden';
  };

  return (
    <>
      {/* Dark overlay for entire page */}
      <div
        className={`fixed inset-0 bg-black/80 backdrop-blur-lg transition-all duration-300 ${
          menuOpen ? 'opacity-100 visible z-[40]' : 'opacity-0 invisible -z-10'
        }`}
        onClick={toggleMenu}
      />

      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-black/30 border-b border-[#482f1f] h-[70px]">
        <div className="flex items-center justify-between h-[70px] px-4">
          <div className="flex items-center gap-4">
            {!hideLogoOnHome && (
              <Link href="/" legacyBehavior>
                <a className="flex items-center gap-2 relative z-[60]">
                  <Image src="/logo.png" alt="Logo" width={112} height={112} />
                  <span className="sr-only">Home</span>
                </a>
              </Link>
            )}
          </div>
          
          {/* Hamburger Button */}
          <button
            className="md:hidden z-[70] w-10 h-10 flex flex-col justify-center items-center gap-1.5"
            onClick={toggleMenu}
            aria-label="Toggle menu"
          >
            <span 
              className={`w-6 h-0.5 bg-white transition-all duration-300 ease-in-out ${
                menuOpen ? 'transform rotate-45 translate-y-2' : ''
              }`}
            />
            <span 
              className={`w-6 h-0.5 bg-white transition-all duration-300 ease-in-out ${
                menuOpen ? 'opacity-0' : ''
              }`}
            />
            <span 
              className={`w-6 h-0.5 bg-white transition-all duration-300 ease-in-out ${
                menuOpen ? 'transform -rotate-45 -translate-y-2' : ''
              }`}
            />
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-4">
            {navLinks.map((link) => (
              <Link key={link.path} href={link.path} legacyBehavior>
                <a>
                  <Button isActive={router.pathname === link.path}>
                    {link.label}
                  </Button>
                </a>
              </Link>
            ))}

            {session && (
              <div className="flex items-center space-x-4 ml-4 border-l border-[#482f1f] pl-4">
                <span className="text-gray-400 text-sm">{session.user?.email}</span>
                <button
                  onClick={() => signOut()}
                  className="glow-button px-4 py-2 border-2 border-red-700 text-red-700 rounded-full hover:text-red-700 transition-all duration-200 flex items-center text-sm"
                  style={styles.glowButton}
                >
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </nav>
          <style jsx>{`
            .nav-link {
              border-color: #482f1f;
              color: white;
            }
            .nav-link:hover {
              border-color: #006D5B;
            }
            .nav-link.active {
              border-color: #006D5B;
              color: #006D5B;
            }

            .glow-button::before {
              content: '';
              position: absolute;
              top: var(--y, 50%);
              left: var(--x, 50%);
              width: 200%;
              height: 200%;
              background: radial-gradient(circle, rgba(220, 38, 38, 0.3) 0%, transparent 60%);
              transition: opacity 0.2s;
              transform: translate(-50%, -50%);
              pointer-events: none;
              opacity: 0;
              z-index: 0;
            }

            .glow-button:hover::before {
              opacity: 1;
            }

            .glow-button > * {
              position: relative;
              z-index: 1;
            }
          `}</style>
        </div>

        {/* Mobile Navigation Menu */}
        <nav
          className={`fixed top-0 right-0 bottom-0 w-64 bg-[#1a1a1a] shadow-xl transform transition-transform duration-300 ease-in-out md:hidden z-[60] ${
            menuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex flex-col pt-20 px-4">
            {navLinks.map((link) => (
              <Link key={link.path} href={link.path} legacyBehavior>
                <a
                  className={`py-3 px-4 mb-2 rounded-lg transition-all duration-200 ease-in-out text-white ${
                    router.pathname === link.path
                      ? 'bg-[#006D5B]/20'
                      : 'hover:bg-[#006D5B]/10'
                  }`}
                  onClick={() => {
                    setMenuOpen(false);
                    document.body.style.overflow = 'auto';
                  }}
                >
                  <span className="text-lg font-semibold">{link.label}</span>
                </a>
              </Link>
            ))}

            {session && (
              <div className="mt-4 px-4">
                <span className="text-gray-400 text-sm block mb-2">{session.user?.email}</span>
                <button
                  onClick={() => {
                    signOut();
                    setMenuOpen(false);
                    document.body.style.overflow = 'auto';
                  }}
                  className="glow-button w-full px-4 py-2 border-2 border-red-700 text-red-700 rounded-full hover:text-red-700 transition-all duration-200 flex items-center justify-center text-sm"
                  style={styles.glowButton}
                >
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </nav>
      </header>
    </>
  );
};

export default Header;