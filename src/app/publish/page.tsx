import type { Metadata } from "next";
import { PublishContinue } from "@/components/publish-continue";

export const metadata: Metadata = {
  title: "Copy & continue · Rant to X",
  description:
    "Copy your article to the clipboard, then open X Articles to paste.",
};

export default function PublishPage() {
  return (
    <main className="flex-1">
      <PublishContinue />
    </main>
  );
}
