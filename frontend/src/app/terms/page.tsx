import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link href="/">
            <Image
              src="/images/logo/logo-small.png"
              alt="BuhBot"
              width={100}
              height={30}
              className="h-7 w-auto object-contain"
            />
          </Link>
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">Login</Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto py-12 px-4 prose prose-slate">
        <h1>Terms of Service</h1>
        <p>Last updated: November 25, 2025</p>
        
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using BuhBot, you agree to be bound by these Terms of Service and all applicable laws and regulations.
        </p>

        <h2>2. Use License</h2>
        <p>
          Permission is granted to temporarily download one copy of the materials (information or software) on BuhBot&apos;s website for personal, non-commercial transitory viewing only.
        </p>

        <h2>3. Disclaimer</h2>
        <p>
          The materials on BuhBot&apos;s website are provided on an &apos;as is&apos; basis. BuhBot makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties.
        </p>

        <h2>4. Limitations</h2>
        <p>
          In no event shall BuhBot or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on BuhBot&apos;s website.
        </p>
      </main>
    </div>
  );
}