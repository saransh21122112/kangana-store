/**
 * Link-mode WhatsApp: build a `wa.me` deep link that opens WhatsApp (app or
 * web) with a pre-filled message. There is no server-side "send" in link
 * mode — the link only does anything once a human clicks it in a browser
 * (WhatsApp's own restriction, not something this app can work around).
 */

/**
 * Formats a `wa.me/<countrycode+number>?text=<url-encoded message>` link.
 *
 * The DB stores plain 10-digit Indian mobile numbers (see
 * `lib/validations/customer.ts`'s `^[6-9]\d{9}$` regex — no country code,
 * no leading zero/+91). `wa.me` requires the full international number
 * with country code and no leading `+`/spaces/dashes, so a bare 10-digit
 * number is prefixed with `91` (India). If a number already arrives with a
 * `91` prefix (e.g. 12 digits) or a leading `+`, it's normalized rather
 * than double-prefixed.
 */
export function buildWaMeLink(phoneNumber: string, message: string): string {
  const digitsOnly = phoneNumber.replace(/\D/g, "");

  const withCountryCode =
    digitsOnly.length === 10 ? `91${digitsOnly}` : digitsOnly;

  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${withCountryCode}?text=${encodedMessage}`;
}
