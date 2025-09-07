import { useModalStore } from '@/stores/ModalStore';

export function InfoModal() {
  const { isOpen, title, message, close } = useModalStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-96">
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        <p className="text-gray-700 mb-4 whitespace-pre-line">{message}</p>
        <div className="flex justify-end">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={close}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
