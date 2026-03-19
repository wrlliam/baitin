import { type Metadata } from "next";
import CommandsClient from "~/components/commands/CommandsClient";
import Footer from "~/components/landing/Footer";
import Navbar from "~/components/landing/Navbar";
import { getCommands } from "~/lib/api";

export const metadata: Metadata = {
  title: "Commands — Baitin 🎣",
  description: "Full reference of all Baitin slash commands, organized by category.",
};

export default async function CommandsPage() {
  const data = await getCommands().catch(() => ({ total: 0, commands: [] }));
  const commands = data.commands.filter((c) => !c.devOnly);

  return (
    <>
      <Navbar />
      <main>
        <CommandsClient commands={commands} />
      </main>
      <Footer />
    </>
  );
}
