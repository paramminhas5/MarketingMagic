import type { AnyProduct, ProductId } from "@mm/core";
import intake from "@mm/intake";
import auditor from "@mm/auditor";
import planner from "@mm/planner";
import proof from "@mm/proof";
import scout from "@mm/scout";
import strategist from "@mm/strategist";
import architect from "@mm/architect";
import studio from "@mm/studio";
import voice from "@mm/voice";
import social from "@mm/social";
import search from "@mm/search";
import pages from "@mm/pages";
import mediaBuyer from "@mm/media-buyer";
import hunter from "@mm/hunter";
import lifecycle from "@mm/lifecycle";
import leadDesk from "@mm/lead-desk";
import gatekeeper from "@mm/gatekeeper";
import analyst from "@mm/analyst";

export const PRODUCTS: Record<ProductId, AnyProduct> = {
  intake,
  auditor,
  planner,
  scout,
  strategist,
  architect,
  studio,
  voice,
  social,
  search,
  pages,
  "media-buyer": mediaBuyer,
  hunter,
  lifecycle,
  "lead-desk": leadDesk,
  gatekeeper,
  analyst,
  proof,
};

export function product(id: string): AnyProduct {
  const p = PRODUCTS[id as ProductId];
  if (!p) throw new Error(`Unknown product "${id}". Products: ${Object.keys(PRODUCTS).join(", ")}`);
  return p;
}

/** The order products run in during onboarding and campaigns. */
export const ONBOARDING: ProductId[] = ["intake", "scout", "strategist", "architect", "auditor", "planner"];
export const PRODUCTION: ProductId[] = ["studio", "voice", "social", "search", "lifecycle", "hunter"];
