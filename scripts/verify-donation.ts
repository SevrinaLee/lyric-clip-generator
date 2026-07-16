/**
 * Unit check for the donation amount validator (v1.7 S7.1).
 *
 * The donation flow trusts NOTHING from the client: the amount is re-validated
 * server-side. This asserts the validator rejects out-of-range, non-integer,
 * and injected/garbage input and accepts only sane integer cents. Run:
 *   npx tsx scripts/verify-donation.ts
 */
import {
  validateDonationCents,
  DONATION_MIN_CENTS,
  DONATION_MAX_CENTS,
} from "../lib/stripe";

let failures = 0;
function check(label: string, got: unknown, want: unknown) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${label} → ${JSON.stringify(got)} (want ${JSON.stringify(want)})`);
}

// Valid
check("min accepted", validateDonationCents(DONATION_MIN_CENTS), DONATION_MIN_CENTS);
check("max accepted", validateDonationCents(DONATION_MAX_CENTS), DONATION_MAX_CENTS);
check("preset 500", validateDonationCents(500), 500);

// Out of range
check("below min", validateDonationCents(DONATION_MIN_CENTS - 1), null);
check("above max", validateDonationCents(DONATION_MAX_CENTS + 1), null);
check("zero", validateDonationCents(0), null);
check("negative", validateDonationCents(-500), null);
check("huge (overflow-y)", validateDonationCents(1_000_000_00), null);

// Non-integer / non-number / injected
check("float", validateDonationCents(499.5), null);
check("NaN", validateDonationCents(NaN), null);
check("Infinity", validateDonationCents(Infinity), null);
check("string number", validateDonationCents("500" as unknown), null);
check("SQL-ish string", validateDonationCents("500; drop table payments" as unknown), null);
check("object", validateDonationCents({ valueOf: () => 500 } as unknown), null);
check("null", validateDonationCents(null), null);
check("undefined", validateDonationCents(undefined), null);

if (failures > 0) {
  console.error(`\n${failures} donation-validator check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll donation-validator checks passed.");
