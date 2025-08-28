import ChatInterface from "@/components/ChatInterface";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto py-8 px-4">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            WAV Chatbot
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-4">
            Assistant IA Anti-Bullshit
          </p>
          <div className="inline-flex items-center px-4 py-2 bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 rounded-full">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span className="text-sm font-medium text-green-800 dark:text-green-200">
              Certifié Anti-Bullshit WAV
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 italic">
            &ldquo;Mieux vaut dire &lsquo;Je ne sais pas&rsquo; que de raconter n&rsquo;importe quoi&rdquo;
          </p>
          <div className="mt-4">
            <Link
              href="/admin"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              🔧 Panneau d&apos;administration
            </Link>
          </div>
        </header>
        
        <ChatInterface />
      </div>
    </div>
  );
}
