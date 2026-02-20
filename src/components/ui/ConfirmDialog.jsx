import React from 'react';

const ConfirmDialog = ({ isOpen, title, description, onCancel, onConfirm }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm border border-gray-200">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">{title}</h3>
        </div>
        <div className="p-4 text-sm text-gray-600">{description}</div>
        <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 text-xs font-semibold rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-2 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-700"
          >
            Remover
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ConfirmDialog);
