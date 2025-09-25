import LiquidEtherBackground from "@/components/LiquidEtherBackground"; // Ensure this path is correct

// --- Test Page Component ---
export default function TestPage() {
  return (
  // Apply fonts and ensure LiquidEtherBackground is rendered behind content
    <div className={`relative min-h-screen`}>
  <LiquidEtherBackground /> {/* Render the gradient background */}
      {/* Centering container for the content */}
      <div className="relative z-10 grid min-h-screen place-items-center p-8">
        {/* Content Area */}
        <div className="w-full max-w-2xl space-y-6 text-white">
          {" "}
          {/* Max width for readability */}
          {/* Page Title */}
          <h1 className="text-4xl font-bold tracking-tight text-center">
            {" "}
            {/* Centered Title */}
            Test
          </h1>
          {/* Body Text */}
          <div className="space-y-4 text-lg text-gray-200">
            {" "}
            {/* Lighter text color for paragraphs */}
            <p>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
              enim ad minim veniam, quis nostrud exercitation ullamco laboris
              nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
              reprehenderit in voluptate velit esse cillum dolore eu fugiat
              nulla pariatur. Excepteur sint occaecat cupidatat non proident,
              sunt in culpa qui officia deserunt mollit anim id est laborum.
            </p>
            <p>
              Sed ut perspiciatis unde omnis iste natus error sit voluptatem
              accusantium doloremque laudantium, totam rem aperiam, eaque ipsa
              quae ab illo inventore veritatis et quasi architecto beatae vitae
              dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit
              aspernatur aut odit aut fugit, sed quia consequuntur magni dolores
              eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam
              est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci
              velit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
