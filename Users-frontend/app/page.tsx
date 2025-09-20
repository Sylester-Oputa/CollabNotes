import React from 'react';

export default function HomePage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Welcome to the Rebuilt Frontend</h2>
      <p className="text-gray-600 max-w-prose">
        This is the fresh Next.js + Tailwind foundation (v2). We will incrementally port features from the
        legacy React implementation into isolated, testable, type-safe modules.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
        {[
          'Overview Analytics',
          'User Management',
          'Department Management',
          'Communication Suite',
          'Settings & Security',
          'Auth / Access Control'
        ].map(item => (
          <div key={item} className="p-4 rounded-lg border bg-white shadow-sm hover:shadow transition">
            <span className="font-medium">{item}</span>
            <p className="text-xs text-gray-500 mt-1">Planned module scaffold</p>
          </div>
        ))}
      </div>
    </div>
  );
}
