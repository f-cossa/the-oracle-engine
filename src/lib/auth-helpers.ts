// PIN -> Supabase password derivation.
// The 4-digit PIN is bound to the email so two users with the same PIN
// don't share a credential. The Supabase password is never typed by the
// user — it's an internal token derived deterministically.
export function derivePassword(email: string, pin: string): string {
  const normalized = email.trim().toLowerCase();
  return `voz-verdade::${normalized}::${pin}::oracle`;
}

export function isPin(value: string): boolean {
  return /^\d{4}$/.test(value);
}
