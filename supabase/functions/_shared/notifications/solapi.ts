import {
  type LikeReceivedNotification,
  type NotificationProvider,
  type NotificationSendResult,
  ProviderRejectedError,
} from './provider.ts'

interface SolapiConfig {
  apiKey: string
  apiSecret: string
  pfId: string
  templateId: string
  serviceName: string
  buttonName: string
  buttonUrl: string
}
interface SolapiResponse {
  failedMessageList?: Array<{ statusCode?: string; statusMessage?: string }>
  messageList?: Array<{ messageId?: string; statusCode?: string; statusMessage?: string }>
  groupInfo?: { groupId?: string }
}

const encoder = new TextEncoder()

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new ProviderRejectedError(`Missing Edge Function secret: ${name}`)
  return value
}

function readConfig(): SolapiConfig {
  return {
    apiKey: requiredEnv('SOLAPI_API_KEY'),
    apiSecret: requiredEnv('SOLAPI_API_SECRET'),
    pfId: requiredEnv('SOLAPI_KAKAO_PF_ID'),
    templateId: requiredEnv('SOLAPI_KAKAO_TEMPLATE_ID'),
    serviceName: requiredEnv('KAKAO_ALIMTALK_SERVICE_NAME'),
    buttonName: requiredEnv('KAKAO_ALIMTALK_BUTTON_NAME'),
    buttonUrl: requiredEnv('KAKAO_ALIMTALK_BUTTON_URL'),
  }
}

async function createAuthorization(apiKey: string, apiSecret: string): Promise<string> {
  const date = new Date().toISOString()
  const salt = crypto.randomUUID().replaceAll('-', '')
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${date}${salt}`))
  const signature = Array.from(new Uint8Array(signed), (byte) => byte.toString(16).padStart(2, '0')).join('')

  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

async function safeResponseText(response: Response): Promise<string> {
  const text = await response.text()
  return text.slice(0, 2000)
}

export class SolapiNotificationProvider implements NotificationProvider {
  readonly name = 'solapi'

  async sendLikeReceived(input: LikeReceivedNotification): Promise<NotificationSendResult> {
    const config = readConfig()
    const authorization = await createAuthorization(config.apiKey, config.apiSecret)

    const response = await fetch('https://api.solapi.com/messages/v4/send-many/detail', {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            to: input.recipientPhoneNumber,
            type: 'ATA',
            customFields: { notificationLogId: input.notificationLogId },
            kakaoOptions: {
              pfId: config.pfId,
              templateId: config.templateId,
              // SMS fallback is intentionally disabled until its policy is implemented.
              disableSms: true,
              variables: {
                '#{서비스명}': config.serviceName,
                '#{호감확인URL}': config.buttonUrl,
              },
              buttons: [
                {
                  buttonType: 'WL',
                  buttonName: config.buttonName,
                  linkMo: config.buttonUrl,
                  linkPc: config.buttonUrl,
                },
              ],
            },
          },
        ],
        allowDuplicates: false,
        showMessageList: true,
      }),
    })

    if (!response.ok) {
      throw new ProviderRejectedError(`SOLAPI HTTP ${response.status}: ${await safeResponseText(response)}`)
    }

    const result = await response.json() as SolapiResponse
    const failed = result.failedMessageList?.[0]
    if (failed) {
      throw new ProviderRejectedError(
        `SOLAPI ${failed.statusCode ?? 'rejected'}: ${failed.statusMessage ?? 'message registration failed'}`,
      )
    }

    const providerMessageId = result.messageList?.[0]?.messageId ?? result.groupInfo?.groupId
    if (!providerMessageId) {
      throw new ProviderRejectedError('SOLAPI accepted no message and returned no message ID')
    }

    return { providerMessageId }
  }
}
