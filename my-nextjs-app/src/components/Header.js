import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';

const Header = () => {
  const [currentPath, setCurrentPath] = useState('/');
  const router = useRouter();

  useEffect(() => {
    setCurrentPath(router.pathname);
  }, [router.pathname]);

  return (
    <header className="w-full h-16 bg-background text-foreground fixed top-0 left-0 z-10 backdrop-blur-md bg-opacity-60 mt-4">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Logo" width={112} height={96} />
            <svg width="76" height="24" viewBox="0 0 76 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              {/* SVG content */}
            </svg>
            <span className="sr-only">Home</span>
          </Link>
        </div>
        <nav className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-4">
          <Link href="/" className={`px-3 py-1 rounded-full transition-all duration-200 ease-in-out ${currentPath === '/' ? 'bg-foreground/10' : 'hover:bg-foreground/5'}`}>
            <span className="text-sm font-semibold">Home</span>
          </Link>
          <Link href="/CurrentlyAvailable" className={`px-3 py-1 rounded-full transition-all duration-200 ease-in-out ${currentPath === '/CurrentlyAvailable' ? 'bg-foreground/10' : 'hover:bg-foreground/5'}`}>
            <span className="text-sm font-semibold">Currently Available</span>
          </Link>
          <Link href="/CheckAvailability" className={`px-3 py-1 rounded-full transition-all duration-200 ease-in-out ${currentPath === '/CheckAvailability' ? 'bg-foreground/10' : 'hover:bg-foreground/5'}`}>
            <span className="text-sm font-semibold">Check Availability</span>
          </Link>
          <Link href="/Graph" className={`px-3 py-1 rounded-full transition-all duration-200 ease-in-out ${currentPath === '/Graph' ? 'bg-foreground/10' : 'hover:bg-foreground/5'}`}>
            <span className="text-sm font-semibold">Graph</span>
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;