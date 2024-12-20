import { useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Link from 'next/link';
import Image from 'next/image';
import logo from '../../public/logo.png';

const Home = () => {
  useEffect(() => {
    const buttons = document.querySelectorAll('.glow-button');

    buttons.forEach(button => {
      button.addEventListener('mousemove', (e) => {
        const rect = button.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        button.style.setProperty('--x', `${x}px`);
        button.style.setProperty('--y', `${y}px`);
      });

      button.addEventListener('mouseleave', () => {
        button.style.setProperty('--x', `50%`);
        button.style.setProperty('--y', `50%`);
      });
    });

    return () => {
      buttons.forEach(button => {
        button.removeEventListener('mousemove', () => {});
        button.removeEventListener('mouseleave', () => {});
      });
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-foreground pt-32 pb-12">
      <Header />
      <main className="flex-grow w-full max-w-3xl mx-auto text-center">
        <Image src={logo} alt="Logo" width={300} height={300} className="mx-auto mb-8" />
        <h1 className="text-4xl font-bold mb-4 text-white">Welcome to <span className="brandname">VACAN.SEE</span></h1>
        <p className="text-xl text-gray-300 mb-12">Your ultimate guide to finding empty rooms in uni</p>
        <div className="space-y-4">
          <Link href="/CurrentlyAvailable" legacyBehavior>
            <a className="glow-button block px-6 py-4 border-2 border-[#482f1f] text-white rounded-full text-2xl font-semibold transition duration-200 w-[30rem] mx-auto">
              Check Currently Available Rooms
            </a>
          </Link>
          <Link href="/CheckAvailability" legacyBehavior>
            <a className="glow-button block px-6 py-4 border-2 border-[#482f1f] text-white rounded-full text-2xl font-semibold transition duration-200 w-[30rem] mx-auto">
              Check Availability of Room
            </a>
          </Link>
          <Link href="/Graph" legacyBehavior>
            <a className="glow-button block px-6 py-4 border-2 border-[#482f1f] text-white rounded-full text-2xl font-semibold transition duration-200 w-[30rem] mx-auto">
              Graph All Rooms
            </a>
          </Link>
        </div>
      </main>
      <Footer />
      <Analytics />
    </div>
  );
};

export default Home;