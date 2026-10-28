import type { Metadata } from "next";
import { ArenaClient } from "./ArenaClient";

export const metadata: Metadata = {
  title: "Arena",
  description: "Try to talk a real-money trading agent into a bad trade. Seven onchain rings decide.",
};

export default function ArenaPage() {
  return <ArenaClient />;
}
