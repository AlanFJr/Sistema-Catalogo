import React from 'react';
import { GripVertical } from 'lucide-react';

const SpacerCard = React.memo(({
  itemId,
  spacerConfig,
  onResize,
  onDelete,
  onSelect,
  isSelected,
  isMultiSelected,
  onToggleMultiSelect,
  onCtrlSelectStart,
  onCtrlSelectHover,
  dragHandleProps,
  isGenerating,
}) => {
  const size = spacerConfig?.size || 'md';
  const sizeLabel = size === 'sm' ? 'P' : size === 'lg' ? 'G' : 'M';

  const handlePointerDown = (e) => {
    if (e.target.closest('input, textarea, button, select, label, [contenteditable="true"]')) return;
    onCtrlSelectStart?.(itemId, e);
  };

  const handlePointerEnter = (e) => {
    if (e.target.closest('input, textarea, button, select, label, [contenteditable="true"]')) return;
    onCtrlSelectHover?.(itemId, e);
  };

  return (
    <div
      className={`relative h-full w-full ${isSelected || isMultiSelected ? 'ring-2 ring-blue-300 rounded-lg' : ''} ${isGenerating ? 'opacity-0' : ''}`}
      onClick={(e) => { if (e.ctrlKey) return; onSelect(itemId, e); }}
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
    >
      {!isGenerating && (
        <>
          <div className="absolute inset-0 border border-dashed border-blue-200 bg-blue-50/40 rounded-lg flex items-center justify-center">
            <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Espaco {sizeLabel}</span>
          </div>
          <label
            className="absolute top-2 right-12 flex items-center gap-1 bg-white/90 rounded-full px-2 py-1 border border-gray-200 text-[9px] text-gray-500"
            title="Selecionar para excluir"
            data-html2canvas-ignore="true"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <input type="checkbox" checked={isMultiSelected} onChange={() => onToggleMultiSelect(itemId)} />
            Sel
          </label>
          <div className="absolute top-2 left-2 flex items-center gap-1">
            {['sm', 'md', 'lg'].map((s) => (
              <button
                key={s}
                type="button"
                className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white border border-blue-100 text-blue-500"
                onClick={() => onResize(itemId, { size: s })}
              >
                {s === 'sm' ? 'P' : s === 'lg' ? 'G' : 'M'}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white border border-red-100 text-red-500"
            onClick={() => onDelete(itemId)}
            title="Remover espaco"
          >
            Remover
          </button>
          <button
            type="button"
            title="Arrastar"
            className="absolute bottom-2 right-2 p-1.5 bg-white text-gray-400 hover:text-gray-700 rounded-full shadow-md border border-gray-200 cursor-grab active:cursor-grabbing"
            {...dragHandleProps}
          >
            <GripVertical size={14} />
          </button>
        </>
      )}
    </div>
  );
});

SpacerCard.displayName = 'SpacerCard';
export default SpacerCard;
