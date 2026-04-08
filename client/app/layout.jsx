import React from "react";
import { ClerkProvider, SignedIn, SignedOut, UserButton, RedirectToSignIn } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import ReduxProvider from "./components/ReduxProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Smart Research - AI-Powered PDF Analysis",
  description: "Enterprise-grade RAG system for intelligent document research and analysis",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <ReduxProvider>

            <SignedOut>
              <RedirectToSignIn />
            </SignedOut>

            <SignedIn>
              <UserButton />
              {children}
            </SignedIn>

          </ReduxProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}