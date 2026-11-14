import "server-only";
import type { AuthEmailSender } from "@clubedge/auth";
import { email } from "@/server/email";

/**
 * How the auth provider sends verification and password reset emails (Better Auth, Firebase): through the email module, or
 * not at all without one, which turns both features off.
 */
export function authEmailSender(): AuthEmailSender | undefined {
  // A list, so the code reads the same with and without the email module's block.
  const senders: AuthEmailSender[] = [];
  senders.push((message) => email.send(message));
  return senders[0];
}
