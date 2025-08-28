import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WAV Chatbot - Anti-Bullshit AI Assistant",
  description: "WAV Anti-Bullshit Chatbot - Mieux vaut dire 'Je ne sais pas' que de raconter n'importe quoi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
