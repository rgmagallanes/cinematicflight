import type { ContactStatus, ContactType, ContactVerificationStatus } from "./vocabulary.ts";

export interface ContactCandidate {
  type: ContactType;
  value: string;
  verificationStatus: ContactVerificationStatus;
}

export function classifyContactStatus(contacts: readonly ContactCandidate[]): ContactStatus {
  const present = contacts.filter((contact) => contact.value.trim().length > 0);
  if (present.length === 0) return "NOT_FOUND";

  const direct = present.filter((contact) => contact.type === "EMAIL" || contact.type === "PHONE");
  if (direct.some((contact) => contact.verificationStatus === "VERIFIED")) return "FOUND";
  if (direct.length > 0) return "UNVERIFIED";

  if (present.every((contact) => contact.type === "CONTACT_FORM")) return "CONTACT_FORM_ONLY";
  if (present.every((contact) => contact.type === "INSTAGRAM" || contact.type === "FACEBOOK")) return "SOCIAL_ONLY";
  return "UNVERIFIED";
}
