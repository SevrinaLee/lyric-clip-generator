import type { Metadata } from "next";
import "./globals.css";
import { AuthStatus } from "./AuthStatus";

export const metadata: Metadata = {
  title: "Lyric Clip Generator",
  description: "Audio in, 3 platform-ready lyric clips out.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthStatus />
        {children}
      </body>
    </html>
  );
}
