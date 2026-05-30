import { OWNER_EMAIL } from "@/lib/config";

export function isOwner(email?: string | null) {
  return email?.toLowerCase() === OWNER_EMAIL;
}

