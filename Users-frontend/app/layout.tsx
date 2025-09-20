import './globals.css';
import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'CollabNotes Admin',
  description: 'Next.js rebuilt admin frontend',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-gray-50 text-gray-900">
        <div className="min-h-screen flex flex-col">
          <header className="border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 sticky top-0 z-40">
            <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
              <h1 className="font-semibold text-lg">CollabNotes</h1>
              <nav className="text-sm text-gray-600">v2 Prototype</nav>
            </div>
          </header>
          <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
            {children}
          </main>
          <footer className="border-t bg-white text-xs text-gray-500 py-4 text-center">© {new Date().getFullYear()} CollabNotes</footer>
        </div>
      </body>
    </html>
  );
}
