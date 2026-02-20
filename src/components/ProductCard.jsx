import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Trash2, GripVertical } from 'lucide-react';

const ProductCard = React.memo(({
  product,
  itemId,
  cardId,
  settings,
  isSelected,
  isMultiSelected,
  onSelect,
  onToggleMultiSelect,
  onValidateRef,
  onUpdate,
  onDelete,
  onInsertAfter,
  onInsertBefore,
  onUploadImage,
  onCtrlSelectStart,
  onCtrlSelectHover,
  dragHandleProps,
}) => {
  const fileInputRef = useRef(null);
  const cardRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleContentChange = (field, value) => {
    onUpdate(cardId, { [field]: value });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) onUploadImage(cardId, file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onUploadImage(cardId, file);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;
    for (let i = 0; i < items.length; i += 1) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) onUploadImage(cardId, file);
        return;
      }
    }
  };

  const handleDeleteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(itemId);
  };

  const handleKeyDown = (e) => {
    if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const isEditingText = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
      if (!isEditingText) {
        e.preventDefault();
        e.key === 'ArrowLeft' ? onInsertBefore(itemId) : onInsertAfter(itemId);
      }
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const isEditingText = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
      if (!isEditingText) {
        e.preventDefault();
        onDelete(itemId);
      }
    }
  };

  const handleCardClick = (e) => {
    if (e.target.closest('input, textarea, button, select, label, [contenteditable="true"]')) return;
    if (e.ctrlKey) return;
    const active = document.activeElement;
    if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) return;
    if (cardRef.current) cardRef.current.focus();
    onSelect(itemId, e);
  };

  const handleCardPointerDown = (e) => {
    if (e.target.closest('input, textarea, button, select, label, [contenteditable="true"]')) return;
    onCtrlSelectStart?.(itemId, e);
  };

  const handleCardPointerEnter = (e) => {
    if (e.target.closest('input, textarea, button, select, label, [contenteditable="true"]')) return;
    onCtrlSelectHover?.(itemId, e);
  };

  const visibleFieldsCount = [
    settings.showDimensions,
    settings.showWeight,
    settings.showBoxQty,
    settings.showPrice,
  ].filter(Boolean).length;

  return (
    <div
      ref={cardRef}
      className={`relative group bg-white border border-gray-200 flex flex-col h-full w-full overflow-hidden outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 ${
        isSelected || isMultiSelected ? 'ring-2 ring-blue-300' : ''
      }`}
      style={{
        borderRadius: `${settings.borderRadius}px`,
        borderColor: isDragging ? settings.primaryColor : settings.borderColor,
      }}
      tabIndex="0"
      onFocus={() => onSelect(itemId)}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      onPointerDown={handleCardPointerDown}
      onPointerEnter={handleCardPointerEnter}
      onClick={handleCardClick}
    >
      <button
        type="button"
        className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-2 py-1 rounded-full text-[10px] font-semibold bg-white text-gray-700 border border-gray-200 shadow-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-50 hover:text-blue-700"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onInsertAfter(itemId); }}
        title="Adicionar card abaixo"
        data-html2canvas-ignore="true"
      >
        + Adicionar
      </button>

      <button
        type="button"
        title="Arrastar card"
        className="absolute top-1 left-1 p-1.5 bg-white text-gray-400 hover:text-gray-700 rounded-full shadow-md border border-gray-200 z-50 cursor-grab active:cursor-grabbing transition-all"
        data-html2canvas-ignore="true"
        {...dragHandleProps}
      >
        <GripVertical size={14} />
      </button>

      <label
        className="absolute top-1 left-9 flex items-center gap-1 bg-white/90 rounded-full px-2 py-1 border border-gray-200 shadow-sm text-[9px] text-gray-500"
        title="Selecionar para excluir"
        data-html2canvas-ignore="true"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <input type="checkbox" checked={isMultiSelected} onChange={() => onToggleMultiSelect(itemId)} />
        Sel
      </label>

      <button
        onClick={handleDeleteClick}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-1 right-1 p-1.5 bg-white text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full shadow-md border border-gray-200 z-50 cursor-pointer transition-all active:scale-95 flex items-center justify-center"
        title="Remover produto (Delete)"
        type="button"
        data-html2canvas-ignore="true"
      >
        <Trash2 size={14} />
      </button>

      <div
        className={`relative w-full flex-1 min-h-0 overflow-hidden cursor-pointer transition-colors ${
          isDragging ? 'bg-blue-50' : 'bg-white'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={(e) => { if (e.ctrlKey || e.metaKey) return; fileInputRef.current?.click(); }}
      >
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
        <div className="absolute inset-0 flex items-center justify-center p-2 pointer-events-none">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="max-w-full max-h-full object-contain"
              loading="lazy"
              decoding="async"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.05))' }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-300 group-hover:text-gray-400 text-center">
              <div className="p-2 rounded-full bg-gray-50 border border-dashed border-gray-200 mb-1">
                <ImageIcon size={20} />
              </div>
              <span className="text-[8px] font-semibold uppercase tracking-wider leading-tight">
                Clique ou Cole<br />(Ctrl + V)
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-50 border-t p-2 shrink-0 z-10 relative" style={{ borderColor: settings.borderColor }}>
        <div className="mb-1.5">
          <div className="flex items-center gap-1 mb-0.5">
            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Ref</span>
            <input
              type="text"
              value={product.code}
              onChange={(e) => handleContentChange('code', e.target.value)}
              onBlur={(e) => onValidateRef(cardId, e.target.value)}
              className="font-bold text-sm bg-transparent w-full focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-200 rounded px-0.5 transition-all"
              style={{ color: settings.primaryColor }}
            />
          </div>
          <input
            type="text"
            value={product.name}
            onChange={(e) => handleContentChange('name', e.target.value)}
            className="w-full text-[11px] font-medium text-gray-700 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-200 rounded px-0.5 truncate transition-all"
            placeholder="Nome do Produto"
          />
        </div>

        <div
          className="grid gap-x-2 gap-y-1 pt-1 border-t grid-cols-2"
          style={{ borderColor: settings.borderColor }}
        >
          {settings.showDimensions && (
            <div className="flex flex-col">
              <label className="text-[7px] font-bold text-gray-400 uppercase">{settings.labelDimensions}</label>
              <input value={product.dimensions} onChange={(e) => handleContentChange('dimensions', e.target.value)} className="text-[9px] text-gray-600 font-mono bg-transparent focus:bg-white focus:outline-none rounded w-full truncate" placeholder="-" />
            </div>
          )}
          {settings.showWeight && (
            <div className="flex flex-col">
              <label className="text-[7px] font-bold text-gray-400 uppercase">{settings.labelWeight}</label>
              <input value={product.weight} onChange={(e) => handleContentChange('weight', e.target.value)} className="text-[9px] text-gray-600 font-mono bg-transparent focus:bg-white focus:outline-none rounded w-full truncate" placeholder="-" />
            </div>
          )}
          {settings.showBoxQty && (
            <div className="flex flex-col">
              <label className="text-[7px] font-bold text-gray-400 uppercase">{settings.labelBoxQty}</label>
              <input value={product.boxQty} onChange={(e) => handleContentChange('boxQty', e.target.value)} className="text-[9px] text-gray-600 font-mono bg-transparent focus:bg-white focus:outline-none rounded w-full truncate" placeholder="-" />
            </div>
          )}
          {settings.showPrice && (
            <div className="flex flex-col">
              <label className="text-[7px] font-bold text-gray-400 uppercase">{settings.labelPrice}</label>
              <div className="flex items-baseline gap-0.5">
                <span className="text-[8px]" style={{ color: settings.priceColor }}>R$</span>
                <input value={product.price} onChange={(e) => handleContentChange('price', e.target.value)} className="text-[10px] font-bold bg-transparent focus:bg-white focus:outline-none rounded w-full truncate" style={{ color: settings.priceColor }} placeholder="0,00" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ProductCard.displayName = 'ProductCard';
export default ProductCard;
