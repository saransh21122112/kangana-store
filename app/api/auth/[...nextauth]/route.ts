import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;

export async function HEAD(request: Request) {
  return await handlers.GET(request);
}
