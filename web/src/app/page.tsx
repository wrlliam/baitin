import Features from "~/components/landing/Features";
import Footer from "~/components/landing/Footer";
import Hero from "~/components/landing/Hero";
import Navbar from "~/components/landing/Navbar";
import { getFish } from "~/lib/api";

export default async function HomePage() {
  const fishData = await getFish().catch(() => ({ total: 0, fish: [] }));

  return (
    <>
      <Navbar />
      <main>
        <Hero fishCount={fishData.total} />
        <Features />
      </main>
      <Footer />
    </>
  );
}
