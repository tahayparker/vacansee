import Header from '../components/Header';
import Footer from '../components/Footer';

const Terms = () => {
  return (
    <div className="min-h-screen flex flex-col page-transition">
      <Header />
      <main className="flex-grow w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <h1 className="text-4xl font-bold mb-8 mt-12 text-center text-white">Terms and Conditions</h1>
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-white">1. Acceptance of Terms</h2>
          <p className="text-lg mb-4 text-gray-300">
            By using the Vacan.see platform, you agree to be bound by these terms and conditions. If you do not agree with any part of these terms, you must not use our services.
          </p>
        </section>
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-white">2. No Liability</h2>
          <p className="text-lg mb-4 text-gray-300">
            Vacan.see shall not be held liable for any damages or losses arising from the use of our platform. This includes, but is not limited to, any direct, indirect, incidental, or consequential damages.
          </p>
        </section>
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-white">3. &quot;As Is&quot; Basis</h2>
          <p className="text-lg mb-4 text-gray-300">
            The Vacan.see platform is provided on an &quot;as is&quot; and &quot;as available&quot; basis. We make no warranties, express or implied, regarding the operation or availability of our platform.
          </p>
        </section>
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-white">4. Data Accuracy</h2>
          <p className="text-lg mb-4 text-gray-300">
            While we strive to provide accurate and up-to-date information, Vacan.see does not guarantee the accuracy, completeness, or reliability of any data available on our platform. Users are responsible for verifying the information before making any decisions based on it.
          </p>
        </section>
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-white">5. Incorrect Room Information</h2>
          <p className="text-lg mb-4 text-gray-300">
            Vacan.see is not responsible for any incorrect room information, including but not limited to room availability and schedules. Users should verify the information before relying on it.
          </p>
        </section>
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-white">6. Changes to Terms</h2>
          <p className="text-lg mb-4 text-gray-300">
            We reserve the right to modify these terms and conditions at any time. Any changes will be effective immediately upon posting on our platform. Your continued use of the platform constitutes your acceptance of the revised terms.
          </p>
        </section>
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4 text-white">7. Contact Us</h2>
          <p className="text-lg mb-4 text-gray-300">
            If you have any questions or concerns about these terms and conditions, please contact me.
          </p>
        </section>
      </main>
      <Footer className="mt-auto" />
    </div>
  );
};

export default Terms;