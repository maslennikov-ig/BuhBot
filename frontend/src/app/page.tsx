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

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--buh-background)] flex flex-col overflow-x-hidden selection:bg-[var(--buh-accent)] selection:text-white">
      <Header />
      <main className="flex-grow">
        <section id="hero">
          <Hero />
        </section>
        <section id="pain-points">
          <PainPoints />
        </section>
        <section id="features">
          <Features />
        </section>
        <section id="how-it-works">
          <HowItWorks />
        </section>
        <section id="benefits">
          <Benefits />
        </section>
        <section id="testimonials">
          <Testimonials />
        </section>
        <section id="contact">
          <ContactForm />
        </section>
      </main>
      <Footer />
    </div>
  );
}