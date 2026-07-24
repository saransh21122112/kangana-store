import type { SendMessageParams, SendMessageResult } from "@/lib/whatsapp/send";

/**
 * Meta WhatsApp Cloud API integration — explicitly a **non-goal** for this
 * stage (`WHATSAPP_MODE` in `.env` is fixed to `"link"`). This stub exists
 * only so `send.ts`'s dispatcher has somewhere to route to if `WHATSAPP_MODE`
 * is ever set to `"cloud"`/`"api"`, and so the shape of a future real
 * implementation is documented.
 *
 * A real implementation would: look up the customer's phone number, call
 * the Cloud API's `/messages` endpoint with a Bearer token
 * (`WHATSAPP_CLOUD_API_TOKEN`) and phone-number-id
 * (`WHATSAPP_CLOUD_PHONE_ID`) from env, create the `MessageLog` row as
 * `PENDING` (not `SENT` — Cloud API delivery is async and confirmed via
 * webhook), and update it to `SENT`/`FAILED`/`DELIVERED`/`READ` as webhook
 * events arrive. None of that exists yet.
 */
// Stub keeps the real parameter name/type documented for the future
// implementation described above; this project's eslint config has no
// `argsIgnorePattern` for leading underscores, hence the disable below.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function sendMessageCloud(_params: SendMessageParams): Promise<SendMessageResult> {
  return {
    ok: false,
    error:
      "WHATSAPP_MODE=api is not supported yet — Cloud API integration is a documented stub, not implemented. Set WHATSAPP_MODE=link.",
  };
}
