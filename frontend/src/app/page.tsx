import {
  Header,
  Hero,
  PainPoints,
  Features,
  HowItWorks,
  Benefits,
  Testimonials,
  ContactForm,
  Footer,
} from '@/components/landing';
import { CursorGlow } from '@/components/CursorGlow';
import { SectionDivider } from '@/components/SectionDivider';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'BuhBot - Автоматизация коммуникаций для бухгалтерских фирм',
  description:
    'SLA-мониторинг ответов бухгалтеров в Telegram. Автоматические напоминания о приближении дедлайна. Контролируйте время реакции на обращения клиентов.',
  keywords: [
    'бухгалтерия',
    'telegram бот',
    'sla мониторинг',
    'автоматизация бухгалтерии',
    'контроль времени ответа',
  ],
  openGraph: {
    title: 'BuhBot - Контроль времени ответа бухгалтеров',
    description: 'Автоматическое отслеживание SLA в Telegram-чатах с умными алертами',
    url: 'https://buhbot.aidevteam.ru',
    siteName: 'BuhBot',
    locale: 'ru_RU',
    type: 'website',
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--buh-background)] flex flex-col overflow-x-hidden selection:bg-[var(--buh-accent)] selection:text-white">
      <CursorGlow />
      <Header />
      <main className="flex-grow">
        <section id="hero">
          <Hero />
        </section>
        <SectionDivider />
        <section id="pain-points">
          <PainPoints />
        </section>
        <SectionDivider />
        <section id="features">
          <Features />
        </section>
        <SectionDivider />
        <section id="how-it-works">
          <HowItWorks />
        </section>
        <SectionDivider />
        <section id="benefits">
          <Benefits />
        </section>
        <SectionDivider />
        <section id="testimonials">
          <Testimonials />
        </section>
        <SectionDivider />
        <section id="contact">
          <ContactForm />
        </section>
      </main>
      <Footer />
    </div>
  );
}
