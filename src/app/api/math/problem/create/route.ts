import type { NextRequest } from "next/server";
import { POST as canonicalPost } from "../route";

export async function POST(request: NextRequest) {
  return canonicalPost(request);
}
