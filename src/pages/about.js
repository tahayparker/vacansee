import Header from '../components/Header';
import Footer from '../components/Footer';

const About = () => {
  return (
    <div className="min-h-screen flex flex-col page-transition">
      <Header />
      <main className="flex-grow w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <h1 className="text-4xl font-bold mb-8 mt-12 text-center text-white">About Vacan.see</h1>
        <p className="text-lg mb-4 text-gray-300">
          Vacan.see is a comprehensive platform designed to help students find available rooms on campus. The goal is to make it easier for everyone to locate rooms for study sessions, meetings, or other activities.
        </p>
        <p className="text-lg mb-4 text-gray-300">
          The platform offers several features to enhance your experience:
        </p>
        <ul className="list-disc list-inside text-lg mb-4 text-gray-300">
          <li>Check the current availability of rooms in real-time.</li>
          <li>View detailed schedules and availability for each room.</li>
          <li>Visualize room availability using interactive graphs.</li>
        </ul>
        <section className="mt-16">
          <h2 className="text-3xl font-bold mb-4 text-white">Instructions</h2>
          <ul className="list-disc list-inside text-lg mb-4 text-gray-300">
            <li>Navigate to the &quot;Currently Available&quot; page to view a list of rooms that are available right now.</li>
            <li>Use the &quot;Check Availability&quot; page to search for rooms based on your specific requirements.</li>
            <li>Visit the &quot;Graph&quot; page to see a visual representation of room availability throughout the week.</li>
          </ul>
          <p className="text-lg mb-4 text-gray-300">
            If you encounter any issues or have any questions, please contact me.
          </p>
        </section>
      </main>
      <Footer className="mt-auto" />
    </div>
  );
};

export default About;