import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link href="/">
            <Image
              src="/images/logo/logo-small-light.png"
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
        <h1>Privacy Policy</h1>
        <p>Last updated: November 25, 2025</p>
        
        <h2>1. Introduction</h2>
        <p>
          Welcome to BuhBot. We respect your privacy and are committed to protecting your personal data.
        </p>

        <h2>2. Data We Collect</h2>
        <p>
          We collect information you provide directly to us, such as when you create an account, update your profile, or communicate with us.
        </p>

        <h2>3. How We Use Your Data</h2>
        <p>
          We use your data to provide, maintain, and improve our services, including processing transactions and sending related information.
        </p>

        <h2>4. Contact Us</h2>
        <p>
          If you have any questions about this Privacy Policy, please contact us at privacy@buhbot.ru.
        </p>
      </main>
    </div>
  );
}