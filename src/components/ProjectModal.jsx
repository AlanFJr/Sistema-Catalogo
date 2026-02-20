import React from 'react';

const ProjectModal = React.memo(({
  isOpen,
  onClose,
  name,
  setName,
  description,
  setDescription,
  onCreate,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">Novo Projeto</h3>
          <button type="button" className="text-xs font-semibold text-gray-500 hover:text-gray-800" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div className="p-4 space-y-4">
          <label className="text-[10px] font-semibold text-gray-500 uppercase">
            Nome
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm text-gray-700"
            />
          </label>
          <label className="text-[10px] font-semibold text-gray-500 uppercase">
            Descricao (opcional)
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm text-gray-700"
              rows={3}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="px-3 py-2 text-xs font-semibold rounded border border-gray-200 text-gray-600" onClick={onClose}>
              Cancelar
            </button>
            <button type="button" className="px-3 py-2 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700" onClick={onCreate}>
              Criar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

ProjectModal.displayName = 'ProjectModal';
export default ProjectModal;
