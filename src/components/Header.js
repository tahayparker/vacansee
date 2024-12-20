import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/CurrentlyAvailable', label: 'Currently Available' },
    { path: '/CheckAvailability', label: 'Check Availability' },
    { path: '/Graph', label: 'Graph' },
  ];

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  return (
    <header className="w-full h-16 bg-background text-foreground fixed top-0 left-0 z-10 backdrop-blur-md bg-opacity-60">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center gap-4">
          <Link href="/" legacyBehavior>
            <a className="flex items-center gap-2">
              <Image src="/logo.png" alt="Logo" width={112} height={96} />
              <span className="sr-only">Home</span>
            </a>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <button
            className="md:hidden flex items-center px-3 py-2 border rounded text-foreground border-foreground"
            onClick={toggleMenu}
          >
            <svg
              className="fill-current h-3 w-3"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <title>Menu</title>
              <path d="M0 3h20v2H0V3zm0 6h20v2H0V9zm0 6h20v2H0v-2z" />
            </svg>
          </button>
          <nav className="hidden md:flex items-center gap-4">
            {navLinks.map((link) => (
              <Link key={link.path} href={link.path} legacyBehavior>
                <a
                  className={`px-3 py-1 rounded-full transition-all duration-200 ease-in-out ${
                    router.pathname === link.path
                      ? 'bg-foreground/10'
                      : 'hover:bg-foreground/5'
                  }`}
                >
                  <span className="text-sm font-semibold">{link.label}</span>
                </a>
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <div
        className={`md:hidden fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 transition-opacity duration-300 ${
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={toggleMenu}
      />
      <nav
        className={`md:hidden fixed top-16 left-0 w-full bg-background text-foreground transition-transform duration-300 ${
          menuOpen ? 'transform translate-y-0' : 'transform -translate-y-full'
        }`}
      >
        <div className="flex flex-col items-center gap-4 mt-4 p-4">
          {navLinks.map((link) => (
            <Link key={link.path} href={link.path} legacyBehavior>
              <a
                className={`px-3 py-1 rounded-full transition-all duration-200 ease-in-out ${
                  router.pathname === link.path
                    ? 'bg-foreground/10'
                    : 'hover:bg-foreground/5'
                }`}
                onClick={() => setMenuOpen(false)}
              >
                <span className="text-sm font-semibold">{link.label}</span>
              </a>
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
};

export default Header;