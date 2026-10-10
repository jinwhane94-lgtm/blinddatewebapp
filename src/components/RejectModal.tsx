import { useState } from 'react'

interface RejectModalProps {
  onConfirm: (reason: string) => void
  onCancel: () => void
  isLoading?: boolean
}

export function RejectModal({ onConfirm, onCancel, isLoading }: RejectModalProps) {
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />

      {/* Modal */}
      <div
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-modal-title"
      >
        <h3 id="reject-modal-title" className="text-lg font-bold text-gray-800 mb-2">반려 사유 입력</h3>
        <p className="text-sm text-gray-500 mb-4">반려 사유를 입력해주세요. (선택)</p>

        <textarea
          className="form-input resize-none h-28"
          placeholder="예: 정보가 불충분합니다."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
        />
        <p className="text-xs text-right text-gray-400 mt-1">{reason.length}/500</p>

        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="btn-secondary flex-1"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            disabled={isLoading}
            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-red-500 hover:bg-red-600 active:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : '반려하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
