import { withSupabase } from 'npm:@supabase/server@1.9.0'
import { ProviderRejectedError } from '../_shared/notifications/provider.ts'
import { SolapiNotificationProvider } from '../_shared/notifications/solapi.ts'

interface LikeWebhookPayload {
  type: 'INSERT'
  table: 'likes'
  schema: 'public'
  record: { id?: string }
  old_record: null
}
interface NotificationClaim {
  log_id: string
  recipient_id: string
  phone_number: string | null
  should_send: boolean
  skip_reason: string | null
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default {
  fetch: withSupabase({ auth: 'secret:automations' }, async (request, context) => {
    let payload: LikeWebhookPayload
    try {
      payload = await request.json() as LikeWebhookPayload
    } catch {
      return json({ error: 'Invalid JSON payload' }, 400)
    }

    if (
      payload.type !== 'INSERT' ||
      payload.schema !== 'public' ||
      payload.table !== 'likes' ||
      typeof payload.record?.id !== 'string'
    ) {
      return json({ error: 'Unexpected webhook payload' }, 400)
    }

    const { data: rawClaims, error: claimError } = await context.supabaseAdmin
      .rpc('claim_like_notification', { p_like_id: payload.record.id })

    if (claimError) {
      console.error('Failed to claim notification', { likeId: payload.record.id, error: claimError.message })
      return json({ error: 'Unable to claim notification' }, 500)
    }

    const claim = (rawClaims as NotificationClaim[] | null)?.[0]
    if (!claim) return json({ ok: true, outcome: 'like_not_found' })
    if (!claim.should_send || !claim.phone_number) {
      return json({ ok: true, outcome: claim.skip_reason ?? 'already_processed' })
    }

    const provider = new SolapiNotificationProvider()

    try {
      const result = await provider.sendLikeReceived({
        notificationLogId: claim.log_id,
        recipientPhoneNumber: claim.phone_number,
      })

      const { error: finishError } = await context.supabaseAdmin.rpc('finish_like_notification', {
        p_log_id: claim.log_id,
        p_status: 'sent',
        p_provider_message_id: result.providerMessageId,
        p_error: null,
      })

      if (finishError) {
        // Return 200 so a webhook retry cannot duplicate a provider-accepted message.
        console.error('Provider accepted message but log update failed', {
          likeId: payload.record.id,
          logId: claim.log_id,
          providerMessageId: result.providerMessageId,
          error: finishError.message,
        })
        return json({ ok: true, outcome: 'sent_state_unconfirmed' })
      }

      return json({ ok: true, outcome: 'sent' })
    } catch (error: unknown) {
      const status = error instanceof ProviderRejectedError ? 'failed' : 'delivery_unknown'
      const message = errorMessage(error).slice(0, 2000)

      const { error: finishError } = await context.supabaseAdmin.rpc('finish_like_notification', {
        p_log_id: claim.log_id,
        p_status: status,
        p_provider_message_id: null,
        p_error: message,
      })

      if (finishError) {
        console.error('Failed to record provider failure', {
          likeId: payload.record.id,
          logId: claim.log_id,
          status,
          error: finishError.message,
        })
      }

      // Notification failure must not turn the already-committed like into a failure.
      console.error('Like notification was not sent', { likeId: payload.record.id, status, error: message })
      return json({ ok: true, outcome: status })
    }
  }),
}
