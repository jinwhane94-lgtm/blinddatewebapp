export interface LikeReceivedNotification {
  notificationLogId: string
  recipientPhoneNumber: string
}
export interface NotificationSendResult {
  providerMessageId: string
}

export interface NotificationProvider {
  readonly name: string
  sendLikeReceived(input: LikeReceivedNotification): Promise<NotificationSendResult>
}

export class ProviderRejectedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderRejectedError'
  }
}
