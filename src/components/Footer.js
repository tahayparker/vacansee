import Link from 'next/link';

const Footer = () => {
  return (
    <footer className="w-full h-16 bg-background text-foreground backdrop-blur-md bg-opacity-60">
      <div className="flex items-center justify-between h-full px-4">
        <div className="flex items-center gap-6">
          <Link href="/about" legacyBehavior>
            <a className="text-sm hover:underline hover:text-[#006D5B] transition-all duration-200 ease-in-out">
              About
            </a>
          </Link>
          <Link href="/terms" legacyBehavior>
            <a className="text-sm hover:underline hover:text-[#006D5B] transition-all duration-200 ease-in-out">
              Terms
            </a>
          </Link>
        </div>
        <div className="flex items-center">
          <p className="text-sm">
            Made with <span className="text-black">🖤</span> by TP
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;