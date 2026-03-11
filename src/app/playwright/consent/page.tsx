// src/app/playwright/consent/page.tsx

import { notFound } from "next/navigation";
import ConsentPlaywrightHarness from "@/components/mirror-mode/ConsentPlaywrightHarness";

export default function PlaywrightConsentPage() {
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction && process.env.NEXT_PUBLIC_E2E !== "true") {
    notFound();
  }

  return <ConsentPlaywrightHarness />;
}
