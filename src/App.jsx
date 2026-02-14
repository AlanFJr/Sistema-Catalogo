import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  Trash2,
  Settings,
  Palette,
  LayoutGrid,
  Image as ImageIcon,
  Download,
  Loader2,
  FileSpreadsheet,
  Save,
  FolderOpen,
  Eye,
  EyeOff,
  GripVertical
} from 'lucide-react';
import logoCasa from '../Logos/Casa_do_padeiro_logo.png';
import logoPlaneta from '../Logos/Planeta_logo.png';
import logoCollor from '../Logos/Collor_fest_logo.png';
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 296.8;
const ITEMS_PER_PAGE = 9;
const TOC_ITEMS_PER_PAGE = 28;

const INITIAL_PRODUCTS = [
  { id: 1, code: '9301', name: 'Ovo Liso 250g', dimensions: '135 x 85 x 30', weight: '250g', boxQty: '10', price: '24,90', image: null },
  { id: 2, code: '9302', name: 'Ovo Liso 350g', dimensions: '150 x 95 x 35', weight: '350g', boxQty: '8', price: '32,90', image: null },
  { id: 3, code: '3690', name: 'Forma Especial Bombom', dimensions: '30 x 30 x 15', weight: '12g', boxQty: '20', price: '15,50', image: null },
  { id: 4, code: '3691', name: 'Placa Texture', dimensions: '100 x 100', weight: '50g', boxQty: '50', price: '8,90', image: null }
];

const DEFAULT_COVER_LOGOS = [
  { id: 'casa-padeiro', name: 'Casa do Padeiro', src: logoCasa, enabled: true },
  { id: 'planeta-festas', name: 'Planeta Festas', src: logoPlaneta, enabled: true },
  { id: 'collor-fest', name: 'Collor Fest', src: logoCollor, enabled: true }
];

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
};

const hashString = (value) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
};

const buildAnchorId = (subtitle, index) => `dest-${index}-${hashString(subtitle)}`;

const normalizePageSubtitles = (value) => {
  if (!value || typeof value !== 'object') return {};
  return Object.entries(value).reduce((acc, [key, subtitle]) => {
    const pageIndex = Number.parseInt(key, 10);
    if (Number.isNaN(pageIndex) || pageIndex < 0) return acc;
    acc[pageIndex] = subtitle == null ? '' : String(subtitle);
    return acc;
  }, {});
};

const dataUrlToBlob = (dataUrl) => {
  const [meta, base64] = dataUrl.split(',');
  const match = meta.match(/data:(.*);base64/);
  const mime = match ? match[1] : 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { blob: new Blob([bytes], { type: mime }), mime };
};

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const apiFetch = async (path, options = {}) => {
  const { method = 'GET', body, isForm = false } = options;
  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined
  });

  if (!response.ok) {
    let message = 'Erro ao comunicar com o servidor.';
    try {
      const payload = await response.json();
      message = payload?.error || message;
    } catch (error) {
      console.error(error);
    }
    throw new Error(message);
  }

  return response.json();
};

const mapCardToProduct = (card) => ({
  id: card.id,
  code: card.refCode,
  name: card.title || '',
  description: card.description || '',
  tags: card.tags || '',
  dimensions: card.dimensions || '',
  weight: card.weight || '',
  boxQty: card.boxQty || '',
  price: card.price || '',
  image: card.imageUrl || null
});

const mapItemToProduct = (item) => {
  if (item.itemType === 'spacer') {
    return {
      id: item.id,
      itemType: 'spacer',
      spacerConfig: item.spacerConfig || { size: 'md' }
    };
  }

  const card = item.card || item;
  return {
    ...mapCardToProduct(card),
    id: item.id,
    cardId: card.id,
    itemType: 'card'
  };
};

const stripAccents = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const detectDelimiter = (line) => {
  const counts = {
    ';': (line.match(/;/g) || []).length,
    ',': (line.match(/,/g) || []).length,
    '\t': (line.match(/\t/g) || []).length
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ';';
};

const parseCsvText = (text) => {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstNonEmptyLine = normalized.split('\n').find((line) => line.trim() !== '') || '';
  const delimiter = detectDelimiter(firstNonEmptyLine);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(field);
      field = '';
      continue;
    }

    if (!inQuotes && char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((line) => line.some((cell) => String(cell).trim() !== ''));
};

const getColumnMap = (headers) => {
  const map = {};
  const aliases = {
    codigo: 'code',
    cod: 'code',
    referencia: 'code',
    ref: 'code',
    nome: 'name',
    produto: 'name',
    preco: 'price',
    valor: 'price',
    dimensoes: 'dimensions',
    dimensao: 'dimensions',
    peso: 'weight',
    qtd: 'boxQty',
    quantidade: 'boxQty',
    caixa: 'boxQty'
  };

  headers.forEach((header, index) => {
    const normalized = stripAccents(String(header)).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (aliases[normalized]) {
      map[aliases[normalized]] = index;
    }
  });

  return map;
};

const MAX_IMAGE_BYTES = 800 * 1024;
const MAX_IMAGE_DIM = 1400;

const getDataUrlSizeBytes = (dataUrl) => {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.floor((base64.length * 3) / 4);
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const loadImageFromDataUrl = (dataUrl) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });

const compressDataUrlIfNeeded = async (dataUrl) => {
  if (getDataUrlSizeBytes(dataUrl) <= MAX_IMAGE_BYTES) return dataUrl;

  const img = await loadImageFromDataUrl(dataUrl);
  const maxDim = Math.max(img.width, img.height);
  const scale = Math.min(1, MAX_IMAGE_DIM / maxDim);
  const targetWidth = Math.max(1, Math.round(img.width * scale));
  const targetHeight = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  let quality = 0.82;
  let output = canvas.toDataURL('image/jpeg', quality);
  let outputSize = getDataUrlSizeBytes(output);
  let attempts = 0;

  while (outputSize > MAX_IMAGE_BYTES && attempts < 4) {
    quality = Math.max(0.5, quality - 0.12);
    output = canvas.toDataURL('image/jpeg', quality);
    outputSize = getDataUrlSizeBytes(output);
    attempts += 1;
  }

  return output;
};

const ProductCard = ({
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
  dragHandleProps
}) => {
  const fileInputRef = useRef(null);
  const cardRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleContentChange = (field, value) => {
    onUpdate(cardId, { [field]: value });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const processFile = async (file) => {
    if (!file) return;
    await onUploadImage(cardId, file);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;
    for (let i = 0; i < items.length; i += 1) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) return;
        processFile(file);
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
        if (e.key === 'ArrowLeft') {
          onInsertBefore(itemId);
        } else {
          onInsertAfter(itemId);
        }
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
    const target = e.target;
    if (target.closest('input, textarea, button, select, label, [contenteditable="true"]')) return;
    if (e.ctrlKey) return;
    const active = document.activeElement;
    if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) return;
    if (cardRef.current) cardRef.current.focus();
    onSelect(itemId, e);
  };

  const handleCardPointerDown = (e) => {
    const target = e.target;
    if (target.closest('input, textarea, button, select, label, [contenteditable="true"]')) return;
    onCtrlSelectStart?.(itemId, e);
  };

  const handleCardPointerEnter = (e) => {
    const target = e.target;
    if (target.closest('input, textarea, button, select, label, [contenteditable="true"]')) return;
    onCtrlSelectHover?.(itemId, e);
  };

  const visibleFieldsCount = [
    settings.showDimensions,
    settings.showWeight,
    settings.showBoxQty,
    settings.showPrice
  ].filter(Boolean).length;

  return (
    <div
      ref={cardRef}
      className={`relative group bg-white border border-gray-200 flex flex-col h-full w-full overflow-hidden outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 ${
        isSelected || isMultiSelected ? 'ring-2 ring-blue-300' : ''
      }`}
      style={{
        borderRadius: `${settings.borderRadius}px`,
        borderColor: isDragging ? settings.primaryColor : settings.borderColor
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
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onInsertAfter(itemId);
        }}
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
        <input
          type="checkbox"
          checked={isMultiSelected}
          onChange={() => onToggleMultiSelect(itemId)}
        />
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
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />

        <div className="absolute inset-0 flex items-center justify-center p-2 pointer-events-none">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="max-w-full max-h-full object-contain"
              style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.05))' }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-300 group-hover:text-gray-400 text-center">
              <div className="p-2 rounded-full bg-gray-50 border border-dashed border-gray-200 mb-1">
                <ImageIcon size={20} />
              </div>
              <span className="text-[8px] font-semibold uppercase tracking-wider leading-tight">
                Clique ou Cole
                <br />
                (Ctrl + V)
              </span>
            </div>
          )}
        </div>
      </div>

      <div
        className="bg-gray-50 border-t p-2 shrink-0 z-10 relative"
        style={{ borderColor: settings.borderColor }}
      >
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
          className={`grid gap-x-2 gap-y-1 pt-1 border-t ${
            visibleFieldsCount <= 2 ? 'grid-cols-2' : 'grid-cols-2'
          }`}
          style={{ borderColor: settings.borderColor }}
        >
          {settings.showDimensions && (
            <div className="flex flex-col">
              <label className="text-[7px] font-bold text-gray-400 uppercase">{settings.labelDimensions}</label>
              <input
                value={product.dimensions}
                onChange={(e) => handleContentChange('dimensions', e.target.value)}
                className="text-[9px] text-gray-600 font-mono bg-transparent focus:bg-white focus:outline-none rounded w-full truncate"
                placeholder="-"
              />
            </div>
          )}

          {settings.showWeight && (
            <div className="flex flex-col">
              <label className="text-[7px] font-bold text-gray-400 uppercase">{settings.labelWeight}</label>
              <input
                value={product.weight}
                onChange={(e) => handleContentChange('weight', e.target.value)}
                className="text-[9px] text-gray-600 font-mono bg-transparent focus:bg-white focus:outline-none rounded w-full truncate"
                placeholder="-"
              />
            </div>
          )}

          {settings.showBoxQty && (
            <div className="flex flex-col">
              <label className="text-[7px] font-bold text-gray-400 uppercase">{settings.labelBoxQty}</label>
              <input
                value={product.boxQty}
                onChange={(e) => handleContentChange('boxQty', e.target.value)}
                className="text-[9px] text-gray-600 font-mono bg-transparent focus:bg-white focus:outline-none rounded w-full truncate"
                placeholder="-"
              />
            </div>
          )}

          {settings.showPrice && (
            <div className="flex flex-col">
              <label className="text-[7px] font-bold text-gray-400 uppercase">{settings.labelPrice}</label>
              <div className="flex items-baseline gap-0.5">
                <span className="text-[8px]" style={{ color: settings.priceColor }}>R$</span>
                <input
                  value={product.price}
                  onChange={(e) => handleContentChange('price', e.target.value)}
                  className="text-[10px] font-bold bg-transparent focus:bg-white focus:outline-none rounded w-full truncate"
                  style={{ color: settings.priceColor }}
                  placeholder="0,00"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SpacerCard = ({ itemId, spacerConfig, onResize, onDelete, onSelect, isSelected, isMultiSelected, onToggleMultiSelect, onCtrlSelectStart, onCtrlSelectHover, dragHandleProps, isGenerating }) => {
  const size = spacerConfig?.size || 'md';
  const sizeLabel = size === 'sm' ? 'P' : size === 'lg' ? 'G' : 'M';

  const handlePointerDown = (e) => {
    const target = e.target;
    if (target.closest('input, textarea, button, select, label, [contenteditable="true"]')) return;
    onCtrlSelectStart?.(itemId, e);
  };

  const handlePointerEnter = (e) => {
    const target = e.target;
    if (target.closest('input, textarea, button, select, label, [contenteditable="true"]')) return;
    onCtrlSelectHover?.(itemId, e);
  };

  return (
    <div
      className={`relative h-full w-full ${isSelected || isMultiSelected ? 'ring-2 ring-blue-300 rounded-lg' : ''} ${isGenerating ? 'opacity-0' : ''}`}
      onClick={(e) => {
        if (e.ctrlKey) return;
        onSelect(itemId, e);
      }}
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
            <input
              type="checkbox"
              checked={isMultiSelected}
              onChange={() => onToggleMultiSelect(itemId)}
            />
            Sel
          </label>
          <div className="absolute top-2 left-2 flex items-center gap-1">
            <button
              type="button"
              className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white border border-blue-100 text-blue-500"
              onClick={() => onResize(itemId, { size: 'sm' })}
            >
              P
            </button>
            <button
              type="button"
              className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white border border-blue-100 text-blue-500"
              onClick={() => onResize(itemId, { size: 'md' })}
            >
              M
            </button>
            <button
              type="button"
              className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-white border border-blue-100 text-blue-500"
              onClick={() => onResize(itemId, { size: 'lg' })}
            >
              G
            </button>
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
};

const SortableCatalogItem = ({
  item,
  settings,
  selectedItemId,
  isMultiSelected,
  onSelectItem,
  onToggleMultiSelect,
  onValidateRef,
  onUpdate,
  onDelete,
  onInsertAfter,
  onInsertBefore,
  onUploadImage,
  onResizeSpacer,
  onCtrlSelectStart,
  onCtrlSelectHover,
  isGenerating
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto'
  };

  return (
    <div ref={setNodeRef} style={style}>
      {item.itemType === 'spacer' ? (
        <SpacerCard
          itemId={item.id}
          spacerConfig={item.spacerConfig}
          onResize={onResizeSpacer}
          onDelete={onDelete}
          onSelect={onSelectItem}
          isSelected={selectedItemId === item.id || isMultiSelected}
          isMultiSelected={isMultiSelected}
          onToggleMultiSelect={onToggleMultiSelect}
          onCtrlSelectStart={onCtrlSelectStart}
          onCtrlSelectHover={onCtrlSelectHover}
          isGenerating={isGenerating}
          dragHandleProps={{ ...attributes, ...listeners }}
        />
      ) : (
        <ProductCard
          product={item}
          itemId={item.id}
          cardId={item.cardId}
          settings={settings}
          isSelected={selectedItemId === item.id}
          isMultiSelected={isMultiSelected}
          onSelect={onSelectItem}
          onToggleMultiSelect={onToggleMultiSelect}
          onValidateRef={onValidateRef}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onInsertAfter={onInsertAfter}
          onInsertBefore={onInsertBefore}
          onUploadImage={onUploadImage}
          onCtrlSelectStart={onCtrlSelectStart}
          onCtrlSelectHover={onCtrlSelectHover}
          dragHandleProps={{ ...attributes, ...listeners }}
        />
      )}
    </div>
  );
};

const ToggleField = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-between w-full p-2 text-xs rounded border transition-all ${
      active ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
    }`}
    type="button"
  >
    <span className="font-medium">{label}</span>
    {active ? <Eye size={14} /> : <EyeOff size={14} />}
  </button>
);

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

const ColorPicker = ({ label, value, onChange }) => (
  <div>
    <label className="text-[10px] text-gray-500 font-semibold mb-1 block uppercase">{label}</label>
    <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded border border-gray-100">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-8 rounded cursor-pointer border-0 p-0 bg-transparent"
      />
      <span className="text-[10px] font-mono text-gray-500 flex-1">{value}</span>
    </div>
  </div>
);

export default function App() {
  const [products, setProducts] = useState([]);
  const [catalogId, setCatalogId] = useState(() => localStorage.getItem('bwb_catalog_id') || null);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(null);
  const [activeTab, setActiveTab] = useState('editor');
  const [isSpacerMode] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState(new Set());
  const [pageSubtitles, setPageSubtitles] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);
  const [isImageSearchOpen, setIsImageSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchSelected, setSearchSelected] = useState(new Set());
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const ctrlSelectionRef = useRef({ active: false, touched: new Set() });
  const productsRef = useRef([]);
  const lastValidRefByCard = useRef(new Map());

  const csvInputRef = useRef(null);
  const projectInputRef = useRef(null);
  const printRef = useRef(null);
  const containerRef = useRef(null);
  const imageSearchInputRef = useRef(null);
  const cardUpdateTimers = useRef(new Map());

  const [settings, setSettings] = useState({
    title: 'Catalogo de Pascoa 2026',
    subtitle: 'Linha Profissional',
    showCover: true,
    showCoverSubtitle: true,
    coverTitle: 'Catalogo Profissional',
    coverSubtitle: 'Pascoa 2026',
    coverFooter: 'Atualizado em ' + new Date().toLocaleDateString(),
    coverLogoSize: 64,
    coverLogos: DEFAULT_COVER_LOGOS,
    primaryColor: '#FF0084',
    priceColor: '#000000',
    backgroundColor: '#FFEF3D',
    borderColor: '#FF0084',
    borderRadius: 6,
    fontFamily: 'Inter',
    showDimensions: true,
    showWeight: true,
    showBoxQty: true,
    showPrice: true,
    labelDimensions: 'Dimensoes',
    labelWeight: 'Peso',
    labelBoxQty: 'Qtd/Cx',
    labelPrice: 'Preco'
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  );

  useEffect(() => {
    let isMounted = true;
    const loadCatalog = async (id) => {
      const payload = await apiFetch(`/catalogs/${id}`);
      if (!isMounted) return;
      setProducts((payload.items || []).map(mapItemToProduct));
      setIsCatalogLoading(false);
    };

    const init = async () => {
      setIsCatalogLoading(true);
      setCatalogError(null);
      try {
        let id = catalogId;
        if (!id) {
          const created = await apiFetch('/catalogs', {
            method: 'POST',
            body: { name: 'Catalogo Atual' }
          });
          id = created.catalog.id;
          if (isMounted) {
            setCatalogId(id);
            localStorage.setItem('bwb_catalog_id', id);
          }
        }
        try {
          await loadCatalog(id);
        } catch (error) {
          if (String(error.message || '').includes('Catalogo nao encontrado')) {
            const created = await apiFetch('/catalogs', {
              method: 'POST',
              body: { name: 'Catalogo Atual' }
            });
            id = created.catalog.id;
            if (isMounted) {
              setCatalogId(id);
              localStorage.setItem('bwb_catalog_id', id);
            }
            await loadCatalog(id);
          } else {
            throw error;
          }
        }
      } catch (error) {
        if (isMounted) {
          setCatalogError(error.message || 'Erro ao carregar catalogo.');
          setIsCatalogLoading(false);
        }
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isGenerating) {
      document.body.classList.add('generating-pdf');
    } else {
      document.body.classList.remove('generating-pdf');
    }
    return () => document.body.classList.remove('generating-pdf');
  }, [isGenerating]);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeTab !== 'editor') return;
      if (e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        const tag = e.target?.tagName;
        if (tag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
        e.preventDefault();
        setSearchQuery('');
        setSearchResults([]);
        setSearchSelected(new Set());
        setSearchError(null);
        setIsImageSearchOpen(true);
        return;
      }
      if (e.shiftKey && (e.key === 'O' || e.key === 'o')) {
        const tag = e.target?.tagName;
        const hasSelection = Boolean(selectedItemId);
        if (tag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) && !hasSelection) return;
        if (isImageSearchOpen || isClearAllOpen || deleteTargetId !== null) return;
        e.preventDefault();
        const selectedItem = selectedItemId
          ? products.find((item) => item.id === selectedItemId)
          : null;
        if (selectedItem && selectedItem.itemType === 'card') {
          const index = products.findIndex((item) => item.id === selectedItemId);
          if (index >= 0) {
            convertItemToSpacer(selectedItemId, index);
          }
        }
        return;
      }
      if (e.key === 'Escape' && isImageSearchOpen) {
        setIsImageSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, isImageSearchOpen, isClearAllOpen, deleteTargetId]);

  useEffect(() => {
    if (!isImageSearchOpen) return;
    const timer = setTimeout(() => imageSearchInputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isImageSearchOpen]);

  useEffect(() => {
    if (activeTab === 'projects') {
      loadProjects();
      setSelectedItemId(null);
      setMultiSelectedIds(new Set());
    }
  }, [activeTab]);

  useEffect(() => {
    productsRef.current = products;
    products.forEach((item) => {
      if (item.itemType === 'card' && item.cardId && item.code && !String(item.code).startsWith('TMP-')) {
        lastValidRefByCard.current.set(item.cardId, item.code);
      }
    });
  }, [products]);

  useEffect(() => {
    setMultiSelectedIds((prev) => {
      const next = new Set();
      products.forEach((product) => {
        if (prev.has(product.id)) next.add(product.id);
      });
      return next;
    });
  }, [products]);

  useEffect(() => {
    const stopCtrlSelection = () => {
      ctrlSelectionRef.current.active = false;
      ctrlSelectionRef.current.touched = new Set();
    };

    const handleKeyUp = (event) => {
      if (event.key === 'Control') stopCtrlSelection();
    };

    window.addEventListener('pointerup', stopCtrlSelection);
    window.addEventListener('blur', stopCtrlSelection);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('pointerup', stopCtrlSelection);
      window.removeEventListener('blur', stopCtrlSelection);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const reloadCatalog = async () => {
    if (!catalogId) return;
    const payload = await apiFetch(`/catalogs/${catalogId}`);
    setProducts((payload.items || []).map(mapItemToProduct));
  };

  const loadProjects = async () => {
    try {
      setProjectsLoading(true);
      setProjectsError(null);
      const payload = await apiFetch('/projects?status=in_progress');
      setProjects(payload.projects || []);
    } catch (error) {
      setProjectsError(error.message || 'Erro ao carregar projetos.');
    } finally {
      setProjectsLoading(false);
    }
  };

  const openProject = async (projectId) => {
    setCatalogId(projectId);
    localStorage.setItem('bwb_catalog_id', projectId);
    const payload = await apiFetch(`/catalogs/${projectId}`);
    setProducts((payload.items || []).map(mapItemToProduct));
    setActiveTab('editor');
    setSelectedItemId(null);
    setMultiSelectedIds(new Set());
  };

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      const payload = await apiFetch('/projects', {
        method: 'POST',
        body: {
          name: newProjectName.trim(),
          description: newProjectDescription.trim() || null,
          status: 'in_progress'
        }
      });
      setIsProjectModalOpen(false);
      setNewProjectName('');
      setNewProjectDescription('');
      await loadProjects();
      await openProject(payload.project.id);
    } catch (error) {
      alert(error.message || 'Erro ao criar projeto.');
    }
  };

  const renameProject = async (projectId) => {
    const name = window.prompt('Novo nome do projeto:');
    if (!name) return;
    try {
      await apiFetch(`/projects/${projectId}`, {
        method: 'PUT',
        body: { name }
      });
      await loadProjects();
    } catch (error) {
      alert(error.message || 'Erro ao renomear projeto.');
    }
  };

  const archiveProject = async (projectId) => {
    try {
      await apiFetch(`/projects/${projectId}/archive`, { method: 'POST' });
      await loadProjects();
    } catch (error) {
      alert(error.message || 'Erro ao arquivar projeto.');
    }
  };

  const persistCatalogOrder = async (nextProducts) => {
    if (!catalogId) return;
    const itemIds = nextProducts.map((product) => product.id);
    await apiFetch(`/catalogs/${catalogId}/items/reorder`, {
      method: 'PUT',
      body: { itemIds }
    });
  };

  const scheduleCardUpdate = (id, changes) => {
    const existingTimer = cardUpdateTimers.current.get(id);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(async () => {
      try {
        await apiFetch(`/cards/${id}`, {
          method: 'PUT',
          body: changes
        });
      } catch (error) {
        alert(error.message || 'Erro ao salvar card.');
      }
    }, 400);

    cardUpdateTimers.current.set(id, timer);
  };

  const createCardAndAttach = async (position, overrides = {}) => {
    if (!catalogId) throw new Error('Catalogo nao carregado.');
    const refCode = overrides.refCode || `TMP-${Date.now()}`;
    const payload = {
      refCode,
      title: overrides.title || 'Novo Produto',
      description: overrides.description || '',
      tags: overrides.tags || '',
      dimensions: overrides.dimensions || '',
      weight: overrides.weight || '',
      boxQty: overrides.boxQty || '',
      price: overrides.price || '0,00'
    };
    const created = await apiFetch('/cards', {
      method: 'POST',
      body: payload
    });
    const attached = await apiFetch(`/catalogs/${catalogId}/cards`, {
      method: 'POST',
      body: { cardId: created.card.id, position }
    });
    return attached.catalogItem;
  };

  const getOrCreateCardByRef = async (payload) => {
    try {
      const existing = await apiFetch(`/cards/by-ref/${encodeURIComponent(payload.refCode)}`);
      return existing.card;
    } catch (error) {
      if (error.message === 'Card nao encontrado.') {
        const created = await apiFetch('/cards', { method: 'POST', body: payload });
        return created.card;
      }
      throw error;
    }
  };

  const createSpacerAt = async (position, size = 'md') => {
    if (!catalogId) throw new Error('Catalogo nao carregado.');
    const response = await apiFetch(`/catalogs/${catalogId}/spacers`, {
      method: 'POST',
      body: { position, spacerConfig: { size } }
    });
    return response.spacer;
  };

  const updateSpacerSize = async (itemId, config) => {
    if (!catalogId) return;
    try {
      await apiFetch(`/catalogs/${catalogId}/spacers/${itemId}`, {
        method: 'PUT',
        body: { spacerConfig: config }
      });
      setProducts((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, spacerConfig: config } : item
        )
      );
    } catch (error) {
      alert(error.message || 'Erro ao atualizar espaco.');
    }
  };

  const validateAndSaveRefCode = async (cardId, nextCode) => {
    const trimmed = String(nextCode || '').trim();
    if (!trimmed || trimmed.startsWith('TMP-')) {
      alert('Informe um cod ref valido (nao pode ser vazio ou TMP).');
      const fallback = lastValidRefByCard.current.get(cardId) || '';
      setProducts((prev) =>
        prev.map((item) => (item.cardId === cardId ? { ...item, code: fallback } : item))
      );
      return false;
    }

    try {
      const existing = await apiFetch(`/cards/by-ref/${encodeURIComponent(trimmed)}`);
      if (existing.card?.id && existing.card.id !== cardId) {
        alert('Cod ref ja existe. Escolha outro.');
        const fallback = lastValidRefByCard.current.get(cardId) || '';
        setProducts((prev) =>
          prev.map((item) => (item.cardId === cardId ? { ...item, code: fallback } : item))
        );
        return false;
      }
    } catch (error) {
      if (String(error.message || '').includes('Card nao encontrado')) {
        // ok
      } else {
        alert(error.message || 'Erro ao validar cod ref.');
        return false;
      }
    }

    setProducts((prev) =>
      prev.map((item) => {
        if (item.cardId !== cardId) return item;
        const shouldOverwriteName = !item.name || item.name === 'Novo Produto' || item.name.startsWith('TMP-');
        return {
          ...item,
          code: trimmed,
          name: shouldOverwriteName ? trimmed : item.name
        };
      })
    );

    lastValidRefByCard.current.set(cardId, trimmed);
    scheduleCardUpdate(cardId, { refCode: trimmed });
    return true;
  };

  const convertItemToSpacer = async (itemId, index) => {
    if (!catalogId) return;
    try {
      const spacer = await createSpacerAt(index, 'md');
      await apiFetch(`/catalogs/${catalogId}/items/${itemId}`, { method: 'DELETE' });
      await reloadCatalog();
      setSelectedItemId(spacer?.id || null);
    } catch (error) {
      alert(error.message || 'Erro ao converter para espaco.');
    }
  };

  const uploadCardImage = async (cardId, file) => {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const finalDataUrl = await compressDataUrlIfNeeded(dataUrl);
      const { blob, mime } = dataUrlToBlob(finalDataUrl);
      const form = new FormData();
      const filename = file?.name || `card-${cardId}.jpg`;
      form.append('image', new File([blob], filename, { type: mime }));

      const response = await apiFetch(`/cards/${cardId}/images`, {
        method: 'POST',
        body: form,
        isForm: true
      });

      setProducts((prev) =>
        prev.map((product) =>
          product.cardId === cardId ? { ...product, image: response.image.url } : product
        )
      );
    } catch (error) {
      alert(error.message || 'Erro ao enviar imagem.');
    }
  };

  const uploadCardImageFromDataUrl = async (cardId, dataUrl, filename) => {
    try {
      const finalDataUrl = await compressDataUrlIfNeeded(dataUrl);
      const { blob, mime } = dataUrlToBlob(finalDataUrl);
      const safeName = filename || `card-${cardId}.jpg`;
      const form = new FormData();
      form.append('image', new File([blob], safeName, { type: mime }));

      const response = await apiFetch(`/cards/${cardId}/images`, {
        method: 'POST',
        body: form,
        isForm: true
      });

      setProducts((prev) =>
        prev.map((product) =>
          product.cardId === cardId ? { ...product, image: response.image.url } : product
        )
      );
    } catch (error) {
      console.error('Erro ao enviar imagem do JSON', error);
    }
  };

  const handleExportProject = async () => {
    const exportItems = await Promise.all(
      products.map(async (item) => {
        if (item.itemType === 'spacer') {
          return {
            itemType: 'spacer',
            spacerConfig: item.spacerConfig || { size: 'md' }
          };
        }

        let image = item.image || null;
        if (image && !String(image).startsWith('data:image/')) {
          try {
            const response = await fetch(image);
            const blob = await response.blob();
            image = await blobToDataUrl(blob);
          } catch (error) {
            console.warn('Nao foi possivel incorporar imagem no export.', error);
          }
        }

        return {
          code: item.code,
          name: item.name,
          description: item.description || '',
          tags: item.tags || '',
          dimensions: item.dimensions || '',
          weight: item.weight || '',
          boxQty: item.boxQty || '',
          price: item.price || '',
          image
        };
      })
    );

    const data = {
      version: '2.2',
      timestamp: new Date().toISOString(),
      products: exportItems,
      settings,
      pageSubtitles: normalizePageSubtitles(pageSubtitles)
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PROJETO-BWB-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportProject = (e) => {
    const file = e.target.files[0];
    e.target.value = null;

    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.products && Array.isArray(data.products)) {
          if (window.confirm('Isso substituira o catalogo atual pelo arquivo carregado. Deseja continuar?')) {
            if (!catalogId) throw new Error('Catalogo nao carregado.');
            const importedSubtitles = normalizePageSubtitles(data.pageSubtitles || data.subtitles);

            if (products.length > 0) {
              await Promise.all(
                products.map((item) =>
                  apiFetch(`/catalogs/${catalogId}/items/${item.id}`, { method: 'DELETE' })
                )
              );
            }

            const basePosition = 0;
            let offset = 0;
            let skipped = 0;
            const seenRefsInFile = new Set();
            const existingCardIds = new Set();
            for (const product of data.products) {
              if (product.itemType === 'spacer') {
                await createSpacerAt(basePosition + offset, product.spacerConfig?.size || 'md');
                offset += 1;
                continue;
              }

              const normalizedRef = String(product.code || '').trim();
              if (!normalizedRef) continue;
              const refKey = normalizedRef.toUpperCase();
              if (seenRefsInFile.has(refKey)) {
                skipped += 1;
                continue;
              }
              seenRefsInFile.add(refKey);

              const payload = {
                refCode: normalizedRef,
                title: product.name || normalizedRef,
                description: product.description || '',
                tags: product.tags || '',
                dimensions: product.dimensions || '',
                weight: product.weight || '',
                boxQty: product.boxQty || '',
                price: product.price || ''
              };
              const card = await getOrCreateCardByRef(payload);
              if (existingCardIds.has(card.id)) {
                skipped += 1;
                continue;
              }
              existingCardIds.add(card.id);
              await apiFetch(`/catalogs/${catalogId}/cards`, {
                method: 'POST',
                body: { cardId: card.id, position: basePosition + offset }
              });
              if (product.image && String(product.image).startsWith('data:image/')) {
                await uploadCardImageFromDataUrl(card.id, product.image, `${product.code || card.id}.jpg`);
              }
              offset += 1;
            }
            if (data.settings) setSettings((prev) => ({ ...prev, ...data.settings }));
            setPageSubtitles(importedSubtitles);
            setSelectedItemId(null);
            setMultiSelectedIds(new Set());
            await reloadCatalog();
            if (skipped > 0) {
              alert(`${skipped} card(s) ja estavam no catalogo e foram ignorados.`);
            }
            alert('Projeto carregado com sucesso!');
          }
        } else {
          alert('Arquivo de projeto invalido.');
        }
      } catch (err) {
        console.error(err);
        alert('Erro ao ler o arquivo de projeto. Verifique se e um JSON valido.');
      }
      if (projectInputRef.current) projectInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const addProduct = async () => {
    try {
      const item = await createCardAndAttach(products.length);
      const next = [...products, mapItemToProduct(item)];
      setProducts(next);
      await persistCatalogOrder(next);
    } catch (error) {
      alert(error.message || 'Erro ao criar card.');
    }
  };

  const insertProductAt = async (index) => {
    try {
      const item = await createCardAndAttach(index);
      const next = [...products];
      next.splice(index, 0, mapItemToProduct(item));
      setProducts(next);
      await persistCatalogOrder(next);
    } catch (error) {
      alert(error.message || 'Erro ao criar card.');
    }
  };

  const insertSpacerAt = async (index, size = 'md') => {
    try {
      const spacer = await createSpacerAt(index, size);
      const next = [...products];
      next.splice(index, 0, mapItemToProduct(spacer));
      setProducts(next);
      await persistCatalogOrder(next);
    } catch (error) {
      alert(error.message || 'Erro ao criar espaco.');
    }
  };

  const insertProductAfter = async (itemId) => {
    const idx = products.findIndex((item) => item.id === itemId);
    if (idx === -1) return;
    await insertProductAt(idx + 1);
  };

  const insertProductBefore = async (itemId) => {
    const idx = products.findIndex((item) => item.id === itemId);
    if (idx === -1) return;
    await insertProductAt(idx);
  };

  const updateProduct = (cardId, changes) => {
    setProducts((prev) =>
      prev.map((p) => (p.cardId === cardId ? { ...p, ...changes } : p))
    );

    const payload = {
      title: changes.name,
      description: changes.description,
      tags: changes.tags,
      dimensions: changes.dimensions,
      weight: changes.weight,
      boxQty: changes.boxQty,
      price: changes.price
    };

    const filtered = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined)
    );

    if (Object.keys(filtered).length > 0) {
      scheduleCardUpdate(cardId, filtered);
    }
  };

  const toggleMultiSelection = (itemId) => {
    setMultiSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleSelectItem = (itemId, event) => {
    if (event?.ctrlKey) {
      toggleMultiSelection(itemId);
      setSelectedItemId(itemId);
      return;
    }
    setSelectedItemId(itemId);
  };

  const handleCtrlSelectStart = (itemId, event) => {
    if (!event.ctrlKey || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    toggleMultiSelection(itemId);
    setSelectedItemId(itemId);

    ctrlSelectionRef.current.active = true;
    ctrlSelectionRef.current.touched = new Set([itemId]);
  };

  const handleCtrlSelectHover = (itemId, event) => {
    if (!ctrlSelectionRef.current.active) return;
    if (!event.ctrlKey) return;
    if ((event.buttons & 1) !== 1) return;
    if (ctrlSelectionRef.current.touched.has(itemId)) return;

    ctrlSelectionRef.current.touched.add(itemId);
    toggleMultiSelection(itemId);
    setSelectedItemId(itemId);
  };

  const clearMultiSelection = () => {
    setMultiSelectedIds(new Set());
  };

  const requestDeleteProduct = (itemId) => {
    setDeleteTargetId(itemId);
  };

  const confirmDeleteProduct = async () => {
    if (deleteTargetId === null || !catalogId) return;
    try {
      await apiFetch(`/catalogs/${catalogId}/items/${deleteTargetId}`, {
        method: 'DELETE'
      });
      setProducts((prev) => prev.filter((p) => p.id !== deleteTargetId));
    } catch (error) {
      alert(error.message || 'Erro ao remover item.');
    } finally {
      setDeleteTargetId(null);
    }
  };

  const cancelDeleteProduct = () => {
    setDeleteTargetId(null);
  };

  const requestBulkDelete = () => {
    if (multiSelectedIds.size === 0) return;
    setIsBulkDeleteOpen(true);
  };

  const confirmBulkDelete = async () => {
    if (!catalogId || multiSelectedIds.size === 0) return;
    try {
      const ids = Array.from(multiSelectedIds);
      await Promise.all(
        ids.map((itemId) => apiFetch(`/catalogs/${catalogId}/items/${itemId}`, { method: 'DELETE' }))
      );
      setProducts((prev) => prev.filter((item) => !multiSelectedIds.has(item.id)));
      if (selectedItemId && multiSelectedIds.has(selectedItemId)) {
        setSelectedItemId(null);
      }
      setMultiSelectedIds(new Set());
    } catch (error) {
      alert(error.message || 'Erro ao remover itens selecionados.');
    } finally {
      setIsBulkDeleteOpen(false);
    }
  };

  const cancelBulkDelete = () => {
    setIsBulkDeleteOpen(false);
  };

  const requestClearAll = () => {
    setIsClearAllOpen(true);
  };

  const confirmClearAll = async () => {
    if (!catalogId) return;
    try {
      await Promise.all(
        products.map((product) =>
          apiFetch(`/catalogs/${catalogId}/items/${product.id}`, { method: 'DELETE' })
        )
      );
      setProducts([]);
      setPageSubtitles({});
    } catch (error) {
      alert(error.message || 'Erro ao limpar catalogo.');
    } finally {
      setIsClearAllOpen(false);
    }
  };

  const cancelClearAll = () => {
    setIsClearAllOpen(false);
  };

  const handlePageSubtitleChange = (pageIndex, value) => {
    setPageSubtitles((prev) => ({
      ...prev,
      [pageIndex]: value
    }));
  };

  const updateCoverLogo = (id, changes) => {
    setSettings((prev) => {
      const baseLogos = prev.coverLogos && prev.coverLogos.length > 0 ? prev.coverLogos : DEFAULT_COVER_LOGOS;
      return {
        ...prev,
        coverLogos: baseLogos.map((logo) => (logo.id === id ? { ...logo, ...changes } : logo))
      };
    });
  };

  useEffect(() => {
    if (!isImageSearchOpen) return;
    const term = searchQuery.trim();
    if (!term) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true);
        setSearchError(null);
        const payload = await apiFetch(`/cards/search?q=${encodeURIComponent(term)}`);
        setSearchResults(payload.cards || []);
      } catch (error) {
        setSearchError(error.message || 'Erro ao buscar cards.');
      } finally {
        setSearchLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery, isImageSearchOpen]);

  const toggleSearchSelection = (cardId) => {
    setSearchSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const toggleSelectAllSearch = () => {
    setSearchSelected((prev) => {
      const resultIds = searchResults.map((result) => result.id);
      const isAllSelected = resultIds.length > 0 && resultIds.every((id) => prev.has(id));
      if (isAllSelected) return new Set();
      return new Set(resultIds);
    });
  };

  const addSelectedCardsToCatalog = async () => {
    if (!catalogId || searchSelected.size === 0) return;
    try {
      const existingIds = new Set(
        products.filter((item) => item.itemType === 'card').map((item) => item.cardId)
      );
      const ids = Array.from(searchSelected).filter((cardId) => !existingIds.has(cardId));
      const skipped = searchSelected.size - ids.length;
      if (ids.length === 0) {
        alert('Todos os cards selecionados ja estao no catalogo.');
        return;
      }
      await Promise.all(
        ids.map((cardId, index) =>
          apiFetch(`/catalogs/${catalogId}/cards`, {
            method: 'POST',
            body: { cardId, position: products.length + index }
          })
        )
      );
      setSearchSelected(new Set());
      await reloadCatalog();
      setIsImageSearchOpen(false);
      if (skipped > 0) {
        alert(`${skipped} card(s) ja estavam no catalogo e foram ignorados.`);
      }
    } catch (error) {
      alert(error.message || 'Erro ao adicionar cards ao catalogo.');
    }
  };

  const handleDeleteTmpCards = async () => {
    if (!window.confirm('Excluir todos os cards TMP do sistema?')) return;
    try {
      const result = await apiFetch('/cards/tmp', { method: 'DELETE' });
      await reloadCatalog();
      setSearchQuery('');
      setSearchResults([]);
      setSearchSelected(new Set());
      alert(`TMP removidos: ${result.deleted}`);
    } catch (error) {
      alert(error.message || 'Erro ao remover TMP.');
    }
  };

  const handleDeleteSelectedFromDb = async () => {
    if (searchSelected.size === 0) return;
    const confirmText = window.prompt('Digite "sim" para excluir do banco de dados:');
    if (!confirmText || confirmText.trim().toLowerCase() !== 'sim') return;
    try {
      const ids = Array.from(searchSelected);
      await Promise.all(ids.map((cardId) => apiFetch(`/cards/${cardId}`, { method: 'DELETE' })));
      setSearchSelected(new Set());
      await reloadCatalog();
      setSearchQuery('');
      setSearchResults([]);
      alert('Cards removidos do banco de dados.');
    } catch (error) {
      alert(error.message || 'Erro ao excluir do banco de dados.');
    }
  };

  const handleDownloadCsvTemplate = () => {
    const headers = ['Codigo', 'Nome', 'Preco', 'Dimensoes', 'Peso', 'Qtd'];
    const exampleRow = ['9999', 'Exemplo de Produto', '29,90', '10x10x10', '150g', '12'];
    const csvContent = "\ufeff" + [headers.join(';'), exampleRow.join(';')].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modelo_importacao_bwb.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvUpload = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const rows = parseCsvText(text);

      if (rows.length === 0) {
        alert('Nenhum produto valido encontrado no CSV.');
        if (csvInputRef.current) csvInputRef.current.value = '';
        return;
      }

      const headerRow = rows[0].map((cell) => String(cell).trim());
      if (headerRow[0]) headerRow[0] = headerRow[0].replace(/^\uFEFF/, '');
      const columnMap = getColumnMap(headerRow);
      const hasHeader = Object.keys(columnMap).length > 0;
      const dataRows = hasHeader ? rows.slice(1) : rows;

      const newProducts = dataRows
        .map((row) => row.map((cell) => String(cell).trim()))
        .map((cols) => {
          const columnIndex = (key, fallback) =>
            columnMap[key] !== undefined ? columnMap[key] : fallback;

          return {
            id: createId(),
            code: cols[columnIndex('code', 0)] || '0000',
            name: cols[columnIndex('name', 1)] || 'Produto Importado',
            price: cols[columnIndex('price', 2)] || '0,00',
            dimensions: cols[columnIndex('dimensions', 3)] || '-',
            weight: cols[columnIndex('weight', 4)] || '-',
            boxQty: cols[columnIndex('boxQty', 5)] || '-',
            image: null
          };
        })
        .filter((product) => product.code !== '0000' || product.name !== 'Produto Importado');

      if (newProducts.length > 0) {
        if (window.confirm(`Adicionar ${newProducts.length} produtos a lista atual?`)) {
          try {
            if (!catalogId) throw new Error('Catalogo nao carregado.');
            const basePosition = products.length;
            let offset = 0;
            let skipped = 0;
            const existingCardIds = new Set(
              products.filter((item) => item.itemType === 'card').map((item) => item.cardId)
            );
            for (const product of newProducts) {
              const payload = {
                refCode: String(product.code),
                title: product.name || product.code,
                description: product.description || '',
                tags: product.tags || '',
                dimensions: product.dimensions || '',
                weight: product.weight || '',
                boxQty: product.boxQty || '',
                price: product.price || ''
              };
              const card = await getOrCreateCardByRef(payload);
              if (existingCardIds.has(card.id)) {
                skipped += 1;
                continue;
              }
              existingCardIds.add(card.id);
              await apiFetch(`/catalogs/${catalogId}/cards`, {
                method: 'POST',
                body: { cardId: card.id, position: basePosition + offset }
              });
              offset += 1;
            }
            await reloadCatalog();
            if (skipped > 0) {
              alert(`${skipped} card(s) ja estavam no catalogo e foram ignorados.`);
            }
          } catch (error) {
            alert(error.message || 'Erro ao importar CSV.');
          }
        }
      } else {
        alert('Nenhum produto valido encontrado no CSV.');
      }
      if (csvInputRef.current) csvInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleDownloadPdf = async () => {
    if (!window.html2pdf) {
      alert('Sistema preparando... tente em 5 segundos.');
      return;
    }

    setIsGenerating(true);
    window.scrollTo(0, 0);
    if (containerRef.current) containerRef.current.scrollTop = 0;

    await new Promise((resolve) => setTimeout(resolve, 800));

    const element = printRef.current;

    const opt = {
      margin: 0,
      filename: `catalogo-bwb-${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      enableLinks: false,
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        scrollY: 0,
        windowWidth: document.documentElement.offsetWidth,
        windowHeight: element.scrollHeight
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      },
      pagebreak: {
        mode: ['css', 'legacy']
      }
    };

    try {
      const worker = window.html2pdf().set(opt).from(element).toPdf();
      const pdf = await worker.get('pdf');

      // Cria links internos no PDF usando as posicoes reais do indice.
      // Isso evita /URI externo e gera GoTo interno por numero de pagina.
      const tocEntries = Array.from(element.querySelectorAll('[data-toc-entry]'));
      const tocPages = Array.from(element.querySelectorAll('[data-toc-page]'));
      const pageMap = new Map();
      tocPages.forEach((pageEl) => {
        const index = pageEl.getAttribute('data-toc-page');
        if (index !== null) pageMap.set(index, pageEl);
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      tocEntries.forEach((entryEl) => {
        const tocPageIndex = entryEl.getAttribute('data-toc-page');
        const targetPage = Number(entryEl.getAttribute('data-target-page'));
        const pageEl = tocPageIndex !== null ? pageMap.get(tocPageIndex) : null;
        if (!pageEl || !targetPage) return;

        const pageRect = pageEl.getBoundingClientRect();
        const entryRect = entryEl.getBoundingClientRect();

        const x = ((entryRect.left - pageRect.left) / pageRect.width) * pdfWidth;
        const y = ((entryRect.top - pageRect.top) / pageRect.height) * pdfHeight;
        const w = (entryRect.width / pageRect.width) * pdfWidth;
        const h = (entryRect.height / pageRect.height) * pdfHeight;

        const tocPdfPage = coverPageCount + Number(tocPageIndex) + 1;
        pdf.setPage(tocPdfPage);
        pdf.link(x, y, w, h, { pageNumber: targetPage });
      });

      await worker.save();
    } catch (error) {
      console.error('Erro na exportacao:', error);
      alert('Erro ao gerar arquivo. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setProducts((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id);
      const newIndex = prev.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      persistCatalogOrder(next).catch((error) =>
        console.error('Erro ao salvar ordem do catalogo', error)
      );
      return next;
    });
  };

  const cardsWithFillers = [];
  products.forEach((item) => {
    cardsWithFillers.push(item);
    if (item.itemType === 'spacer') {
      const size = item.spacerConfig?.size || 'md';
      const fillerCount = size === 'lg' ? 2 : size === 'sm' ? 0 : 1;
      for (let index = 0; index < fillerCount; index += 1) {
        cardsWithFillers.push({
          id: `__spacer_fill__${item.id}__${index}`,
          itemType: 'filler',
          parentSpacerId: item.id
        });
      }
    }
  });

  const pages = [];
  for (let i = 0; i < cardsWithFillers.length; i += ITEMS_PER_PAGE) {
    pages.push(cardsWithFillers.slice(i, i + ITEMS_PER_PAGE));
  }
  if (pages.length === 0) pages.push([]);

  const coverPageCount = settings.showCover ? 1 : 0;

  // PASSADA 1: detectar subtitulos e a primeira pagina em que aparecem.
  const tocMap = new Map();
  pages.forEach((_, pageIndex) => {
    const subtitle = pageSubtitles[pageIndex] !== undefined ? pageSubtitles[pageIndex] : settings.subtitle;
    const trimmed = String(subtitle || '').trim();
    if (!trimmed || tocMap.has(trimmed)) return;
    tocMap.set(trimmed, {
      text: trimmed,
      pageIndex,
      anchorId: buildAnchorId(trimmed, pageIndex)
    });
  });

  const tocEntries = Array.from(tocMap.values());
  const tocPages = [];
  for (let i = 0; i < tocEntries.length; i += TOC_ITEMS_PER_PAGE) {
    tocPages.push(tocEntries.slice(i, i + TOC_ITEMS_PER_PAGE));
  }
  if (tocPages.length === 0) tocPages.push([]);

  const tocPageCount = tocPages.length;
  const tocAnchorsByPage = new Map();
  tocEntries.forEach((entry) => {
    if (!tocAnchorsByPage.has(entry.pageIndex)) {
      tocAnchorsByPage.set(entry.pageIndex, entry.anchorId);
    }
  });

  const getCatalogInsertIndexForDisplay = (displayIndex) => {
    let count = 0;
    for (let i = 0; i < displayIndex; i += 1) {
      const item = cardsWithFillers[i];
      if (item && item.itemType !== 'filler') count += 1;
    }
    return count;
  };

  const multiSelectedCount = multiSelectedIds.size;

  const productToDelete = useMemo(
    () => products.find((product) => product.id === deleteTargetId),
    [products, deleteTargetId]
  );

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-100 font-sans overflow-hidden">
      <aside className="w-full md:w-80 bg-white shadow-xl z-30 flex flex-col h-full border-r border-gray-200">
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <LayoutGrid size={20} />
          </div>
          <div>
            <h1 className="font-bold text-gray-800 leading-tight">Editor de Catalogo</h1>
            <p className="text-[10px] text-gray-400 font-medium">v2.1 Professional</p>
          </div>
        </div>

        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`text-xs font-semibold rounded border px-2 py-2 ${
                activeTab === 'editor'
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}
            >
              Editor
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('projects')}
              className={`text-xs font-semibold rounded border px-2 py-2 ${
                activeTab === 'projects'
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}
            >
              Projetos
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Gerenciamento</label>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={handleExportProject}
                className="btn-action bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-100"
                title="Salvar arquivo de projeto para continuar depois"
                type="button"
              >
                <Save size={16} /> Salvar
              </button>
              <button
                onClick={() => projectInputRef.current?.click()}
                className="btn-action bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-100"
                title="Abrir arquivo de projeto salvo"
                type="button"
              >
                <FolderOpen size={16} /> Abrir
              </button>
              <input type="file" ref={projectInputRef} accept=".json" className="hidden" onChange={handleImportProject} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={addProduct} className="btn-action bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100" type="button">
                <Plus size={16} /> Adicionar
              </button>
              <button
                onClick={() => csvInputRef.current?.click()}
                className="btn-action bg-green-50 text-green-700 hover:bg-green-100 border-green-100"
                title="Basta: Codigo; Nome; Preco"
                type="button"
              >
                <FileSpreadsheet size={16} /> Importar Rapido
              </button>
              <input type="file" ref={csvInputRef} accept=".csv" className="hidden" onChange={handleCsvUpload} />
            </div>

            <button
              onClick={requestClearAll}
              className="btn-action w-full bg-red-50 text-red-700 hover:bg-red-100 border-red-100"
              type="button"
              title="Remove todos os produtos do catalogo"
            >
              <Trash2 size={16} /> Limpar tudo
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={requestBulkDelete}
                disabled={multiSelectedCount === 0}
                className={`btn-action ${
                  multiSelectedCount === 0
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-red-50 text-red-700 hover:bg-red-100 border-red-100'
                }`}
                type="button"
                title="Remove os itens selecionados"
              >
                <Trash2 size={16} /> Excluir selecionados
              </button>
              <button
                onClick={clearMultiSelection}
                disabled={multiSelectedCount === 0}
                className={`btn-action ${
                  multiSelectedCount === 0
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200'
                }`}
                type="button"
                title="Limpar selecao atual"
              >
                Limpar selecao ({multiSelectedCount})
              </button>
            </div>

            <div className="text-right">
              <button
                onClick={handleDownloadCsvTemplate}
                className="text-[10px] text-blue-600 hover:underline hover:text-blue-800 flex items-center justify-end gap-1 ml-auto transition-colors"
                type="button"
              >
                <Download size={10} /> Baixar modelo CSV
              </button>
            </div>

            <button
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              className={`w-full py-3 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all mt-4 ${
                isGenerating
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-900 text-white hover:bg-black hover:shadow-md active:scale-95'
              }`}
              type="button"
            >
              {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              {isGenerating ? 'Processando...' : 'Exportar PDF Profissional'}
            </button>
          </div>

          <hr className="border-gray-100" />

          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Eye size={14} className="text-gray-400" />
              <span className="text-xs font-bold text-gray-700">Capa do Catalogo</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ToggleField
                label={settings.showCover ? 'Capa Ativa' : 'Capa Oculta'}
                active={settings.showCover}
                onClick={() => setSettings({ ...settings, showCover: !settings.showCover })}
              />
              <ToggleField
                label={settings.showCoverSubtitle ? 'Subtitulo Visivel' : 'Subtitulo Oculto'}
                active={settings.showCoverSubtitle}
                onClick={() => setSettings({ ...settings, showCoverSubtitle: !settings.showCoverSubtitle })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] font-semibold text-gray-500 col-span-2">
                Titulo
                <input
                  type="text"
                  value={settings.coverTitle}
                  onChange={(e) => setSettings({ ...settings, coverTitle: e.target.value })}
                  className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700"
                />
              </label>
              <label className="text-[10px] font-semibold text-gray-500 col-span-2">
                Subtitulo
                <input
                  type="text"
                  value={settings.coverSubtitle}
                  onChange={(e) => setSettings({ ...settings, coverSubtitle: e.target.value })}
                  className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700"
                />
              </label>
              <label className="text-[10px] font-semibold text-gray-500 col-span-2">
                Rodape
                <input
                  type="text"
                  value={settings.coverFooter}
                  onChange={(e) => setSettings({ ...settings, coverFooter: e.target.value })}
                  className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700"
                />
              </label>
            </div>

            <div className="pt-2">
              <label className="text-xs text-gray-500 mb-2 block flex justify-between">
                <span>Tamanho dos Logos</span>
                <span className="font-mono">{settings.coverLogoSize}px</span>
              </label>
              <input
                type="range"
                min="36"
                max="110"
                value={settings.coverLogoSize}
                onChange={(e) => setSettings({ ...settings, coverLogoSize: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            <div className="space-y-2">
              {(settings.coverLogos && settings.coverLogos.length > 0 ? settings.coverLogos : DEFAULT_COVER_LOGOS).map((logo) => (
                <div key={logo.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateCoverLogo(logo.id, { enabled: !logo.enabled })}
                    className={`h-6 w-6 rounded border text-[10px] font-bold flex items-center justify-center ${
                      logo.enabled ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}
                    title={logo.enabled ? 'Desativar logo' : 'Ativar logo'}
                  >
                    {logo.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                  <input
                    type="text"
                    value={logo.name}
                    onChange={(e) => updateCoverLogo(logo.id, { name: e.target.value })}
                    className="flex-1 rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700"
                  />
                </div>
              ))}
            </div>
          </div>

          <hr className="border-gray-100" />

          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Settings size={14} className="text-gray-400" />
              <span className="text-xs font-bold text-gray-700">Exibicao de Campos</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ToggleField label="Dimensoes" active={settings.showDimensions} onClick={() => setSettings({ ...settings, showDimensions: !settings.showDimensions })} />
              <ToggleField label="Peso" active={settings.showWeight} onClick={() => setSettings({ ...settings, showWeight: !settings.showWeight })} />
              <ToggleField label="Qtd. Caixa" active={settings.showBoxQty} onClick={() => setSettings({ ...settings, showBoxQty: !settings.showBoxQty })} />
              <ToggleField label="Preco" active={settings.showPrice} onClick={() => setSettings({ ...settings, showPrice: !settings.showPrice })} />
            </div>
          </div>

          <hr className="border-gray-100" />

          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Settings size={14} className="text-gray-400" />
              <span className="text-xs font-bold text-gray-700">Nomes dos Campos</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] font-semibold text-gray-500">
                Dimensoes
                <input
                  type="text"
                  value={settings.labelDimensions}
                  onChange={(e) => setSettings({ ...settings, labelDimensions: e.target.value })}
                  className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700"
                />
              </label>
              <label className="text-[10px] font-semibold text-gray-500">
                Peso
                <input
                  type="text"
                  value={settings.labelWeight}
                  onChange={(e) => setSettings({ ...settings, labelWeight: e.target.value })}
                  className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700"
                />
              </label>
              <label className="text-[10px] font-semibold text-gray-500">
                Qtd/Cx
                <input
                  type="text"
                  value={settings.labelBoxQty}
                  onChange={(e) => setSettings({ ...settings, labelBoxQty: e.target.value })}
                  className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700"
                />
              </label>
              <label className="text-[10px] font-semibold text-gray-500">
                Preco
                <input
                  type="text"
                  value={settings.labelPrice}
                  onChange={(e) => setSettings({ ...settings, labelPrice: e.target.value })}
                  className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700"
                />
              </label>
            </div>
          </div>

          <hr className="border-gray-100" />

          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Palette size={14} className="text-gray-400" />
              <span className="text-xs font-bold text-gray-700">Identidade Visual</span>
            </div>

            <div className="space-y-3">
              <ColorPicker label="Cor Principal (Titulos)" value={settings.primaryColor} onChange={(v) => setSettings({ ...settings, primaryColor: v })} />
              <ColorPicker label="Cor de Destaque (Precos)" value={settings.priceColor} onChange={(v) => setSettings({ ...settings, priceColor: v })} />
              <ColorPicker label="Cor das Bordas" value={settings.borderColor} onChange={(v) => setSettings({ ...settings, borderColor: v })} />
              <ColorPicker label="Cor de Fundo" value={settings.backgroundColor} onChange={(v) => setSettings({ ...settings, backgroundColor: v })} />
            </div>

            <div className="pt-2">
              <label className="text-xs text-gray-500 mb-2 block flex justify-between">
                <span>Arredondamento</span>
                <span className="font-mono">{settings.borderRadius}px</span>
              </label>
              <input
                type="range"
                min="0"
                max="16"
                value={settings.borderRadius}
                onChange={(e) => setSettings({ ...settings, borderRadius: parseInt(e.target.value, 10) })}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>
        </div>
      </aside>

      <main
        ref={containerRef}
        className={`flex-1 overflow-y-auto bg-gray-200/50 flex flex-col items-center transition-all duration-0 ${
          isGenerating ? 'p-0' : 'p-8 pb-32'
        }`}
      >
        {activeTab === 'projects' ? (
          <div className="w-full max-w-4xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Projetos em andamento</h2>
              <button
                type="button"
                className="px-3 py-2 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => setIsProjectModalOpen(true)}
              >
                Novo Projeto
              </button>
            </div>

            {projectsLoading && (
              <div className="text-sm text-gray-500">Carregando projetos...</div>
            )}
            {projectsError && (
              <div className="text-sm text-red-600">{projectsError}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((project) => (
                <div key={project.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                  <div className="text-sm font-semibold text-gray-800">{project.name}</div>
                  {project.description && (
                    <div className="text-xs text-gray-500 mt-1">{project.description}</div>
                  )}
                  <div className="text-[10px] text-gray-400 mt-2">Atualizado em {new Date(project.updatedAt).toLocaleDateString()}</div>
                  <div className="text-[10px] text-gray-400">Cards: {project.cardCount ?? 0}</div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      className="px-2 py-1 text-[10px] font-semibold rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
                      onClick={() => openProject(project.id)}
                    >
                      Abrir
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 text-[10px] font-semibold rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
                      onClick={() => renameProject(project.id)}
                    >
                      Renomear
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 text-[10px] font-semibold rounded border border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => archiveProject(project.id)}
                    >
                      Arquivar
                    </button>
                  </div>
                </div>
              ))}
              {!projectsLoading && projects.length === 0 && (
                <div className="text-sm text-gray-500">Nenhum projeto em andamento.</div>
              )}
            </div>
          </div>
        ) : (
          <>
            {(isCatalogLoading || catalogError) && (
              <div className="mb-6 w-full max-w-3xl rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
                {isCatalogLoading ? 'Carregando catalogo...' : `Erro: ${catalogError}`}
              </div>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={products.map((product) => product.id)} strategy={rectSortingStrategy}>
                <div ref={printRef} className="flex flex-col items-center">
              {settings.showCover && (
                <div
                  className={`bg-white relative flex flex-col overflow-hidden transition-none ${
                    isGenerating ? 'shadow-none mb-0' : 'shadow-2xl mb-10 ring-1 ring-gray-900/5'
                  } cover-ui`}
                  style={{
                    width: `${A4_WIDTH_MM}mm`,
                    height: `${A4_HEIGHT_MM}mm`,
                    backgroundColor: '#ffffff',
                    pageBreakAfter: 'always'
                  }}
                >
                  <div className="absolute inset-0">
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(135deg, ${settings.backgroundColor} 0%, #ffffff 55%, ${settings.backgroundColor} 100%)`
                      }}
                    ></div>
                    <div
                      className="absolute -top-24 -right-16 w-[360px] h-[360px] rounded-full"
                      style={{ backgroundColor: settings.primaryColor, opacity: 0.12 }}
                    ></div>
                    <div
                      className="absolute -bottom-28 -left-20 w-[420px] h-[420px] rounded-full"
                      style={{ backgroundColor: settings.primaryColor, opacity: 0.08 }}
                    ></div>
                  </div>

                  <div className="relative z-10 h-full flex flex-col justify-between" style={{ padding: '14mm' }}>
                    <div className="flex items-start justify-between gap-6">
                      <div className="h-6"></div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                      <input
                        value={settings.coverTitle}
                        onChange={(e) => setSettings({ ...settings, coverTitle: e.target.value })}
                        className="cover-title text-5xl md:text-6xl font-black bg-transparent w-full focus:outline-none tracking-tight"
                        style={{ color: settings.primaryColor }}
                        placeholder="TITULO DO CATALOGO"
                      />
                      {settings.showCoverSubtitle && (
                        <input
                          value={settings.coverSubtitle}
                          onChange={(e) => setSettings({ ...settings, coverSubtitle: e.target.value })}
                          className="text-xl md:text-2xl font-medium text-gray-600 bg-transparent w-full focus:outline-none mt-4"
                          placeholder="SUBTITULO"
                        />
                      )}
                    </div>

                    <div className="flex items-end justify-between gap-6">
                      <div>
                        <div className="mt-4 flex items-center gap-6 flex-wrap">
                          {(settings.coverLogos && settings.coverLogos.length > 0 ? settings.coverLogos : DEFAULT_COVER_LOGOS)
                            .filter((logo) => logo.enabled)
                            .map((logo) => (
                              <div key={logo.id} className="flex flex-col items-center gap-1">
                                <img
                                  src={logo.src}
                                  alt={logo.name}
                                  style={{ height: `${settings.coverLogoSize}px` }}
                                  className="object-contain max-w-[140px]"
                                />
                                <span className="text-[9px] uppercase tracking-widest text-gray-500">{logo.name}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                      <input
                        value={settings.coverFooter}
                        onChange={(e) => setSettings({ ...settings, coverFooter: e.target.value })}
                        className="text-[10px] text-gray-500 bg-transparent focus:outline-none text-right w-56"
                        placeholder="RODAPE"
                      />
                    </div>
                  </div>
                </div>
              )}

              {tocPages.map((entries, tocPageIndex) => (
                <div
                  key={`toc-${tocPageIndex}`}
                  className={`bg-white relative flex flex-col overflow-hidden transition-none ${
                    isGenerating ? 'shadow-none mb-0' : 'shadow-2xl mb-10 ring-1 ring-gray-900/5'
                  } cover-ui`}
                  style={{
                    width: `${A4_WIDTH_MM}mm`,
                    height: `${A4_HEIGHT_MM}mm`,
                    backgroundColor: '#ffffff',
                    padding: '14mm',
                    pageBreakAfter: 'always'
                  }}
                  data-toc-page={tocPageIndex}
                >
                  <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: settings.borderColor }}>
                    <h2 className="text-3xl font-black" style={{ color: settings.primaryColor }}>Indice</h2>
                    <div className="text-[9px] font-mono text-gray-400">
                      PAGINA {coverPageCount + tocPageIndex + 1}
                    </div>
                  </div>

                  <div className="mt-6 flex-1 flex flex-col gap-2">
                    {entries.length === 0 && (
                      <div className="text-sm text-gray-400">Nenhum subtitulo encontrado.</div>
                    )}
                    {entries.map((entry) => {
                      const humanPageNumber = coverPageCount + tocPageCount + entry.pageIndex + 1;
                      return (
                        <button
                          key={entry.anchorId}
                          type="button"
                          className="flex items-center gap-3 text-[11px] text-gray-700 hover:text-gray-900 text-left"
                          data-toc-entry
                          data-toc-page={tocPageIndex}
                          data-target-page={humanPageNumber}
                        >
                          <span className="truncate max-w-[420px]">{entry.text}</span>
                          <span className="flex-1 border-b border-dotted border-gray-300" aria-hidden="true" />
                          <span className="text-[11px] font-mono text-gray-500">{humanPageNumber}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {pages.map((pageProducts, pageIndex) => (
                <div
                  key={pageIndex}
                  className={`bg-white relative flex flex-col overflow-hidden transition-none ${
                    isGenerating ? 'shadow-none mb-0' : 'shadow-2xl mb-10 ring-1 ring-gray-900/5'
                  }`}
                  style={{
                    width: `${A4_WIDTH_MM}mm`,
                    height: `${A4_HEIGHT_MM}mm`,
                    backgroundColor: settings.backgroundColor,
                    padding: '12mm',
                    pageBreakAfter: 'always'
                  }}
                >
                  <header
                    className="flex justify-between items-end border-b-2 pb-3 mb-4 shrink-0"
                    style={{ borderColor: settings.primaryColor, height: '30mm' }}
                  >
                    <div className="flex-1 pr-6">
                      {/*
                        Destino interno (ancora) na primeira ocorrencia do subtitulo.
                        Usado pelo indice clicavel para navegar para esta pagina.
                      */}
                      {tocAnchorsByPage.has(pageIndex) && (
                        <div id={tocAnchorsByPage.get(pageIndex)} />
                      )}
                      <input
                        value={settings.title}
                        onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                        className="text-3xl font-black bg-transparent w-full focus:outline-none placeholder-gray-300 tracking-tight"
                        style={{ color: settings.primaryColor }}
                        placeholder="TITULO DO CATALOGO"
                      />
                      <input
                        value={pageSubtitles[pageIndex] !== undefined ? pageSubtitles[pageIndex] : settings.subtitle}
                        onChange={(e) => handlePageSubtitleChange(pageIndex, e.target.value)}
                        className="text-lg font-medium text-gray-500 bg-transparent w-full focus:outline-none mt-1 placeholder-gray-400"
                        placeholder="Subtitulo desta pagina"
                      />
                    </div>
                    <div className="text-right shrink-0 opacity-60">
                      <div className="text-[9px] font-mono text-gray-400">PAGINA {pageIndex + 1}</div>
                      <div className="text-[9px] font-mono text-gray-400">{new Date().toLocaleDateString()}</div>
                    </div>
                  </header>

                  <div className="flex-1 grid grid-cols-3 grid-rows-3 gap-4">
                    {Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => {
                      const product = pageProducts[i];
                      const displayIndex = pageIndex * ITEMS_PER_PAGE + i;
                      const absoluteIndex = getCatalogInsertIndexForDisplay(displayIndex);
                      return product && product.itemType !== 'filler' ? (
                        <SortableCatalogItem
                          key={product.id}
                          item={product}
                          settings={settings}
                          selectedItemId={selectedItemId}
                          isMultiSelected={multiSelectedIds.has(product.id)}
                          onSelectItem={handleSelectItem}
                          onToggleMultiSelect={toggleMultiSelection}
                          onValidateRef={validateAndSaveRefCode}
                          onUpdate={updateProduct}
                          onDelete={requestDeleteProduct}
                          onInsertAfter={insertProductAfter}
                          onInsertBefore={insertProductBefore}
                          onUploadImage={uploadCardImage}
                          onResizeSpacer={updateSpacerSize}
                          onCtrlSelectStart={handleCtrlSelectStart}
                          onCtrlSelectHover={handleCtrlSelectHover}
                          isGenerating={isGenerating}
                        />
                      ) : (
                        <div
                          key={`empty-${i}`}
                          className={`relative border border-dashed border-gray-100 rounded-lg group ${!isGenerating ? 'opacity-60' : 'opacity-0'}`}
                        >
                          {!isGenerating && (
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              <button
                                type="button"
                                className="px-2 py-1 rounded-full text-[10px] font-semibold bg-white text-gray-700 border border-gray-200 shadow-sm"
                                onClick={() => insertProductAt(absoluteIndex)}
                                title="Adicionar card aqui"
                                data-html2canvas-ignore="true"
                              >
                                + Card
                              </button>
                              {isSpacerMode && (
                                <button
                                  type="button"
                                  className="px-2 py-1 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm"
                                  onClick={() => insertSpacerAt(absoluteIndex, 'md')}
                                  title="Adicionar espaco"
                                  data-html2canvas-ignore="true"
                                >
                                  + Espaco
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <footer
                    className="mt-4 pt-2 border-t text-center shrink-0"
                    style={{ height: '12mm', borderColor: settings.borderColor }}
                  >
                    <p className="text-[9px] text-gray-400 uppercase tracking-widest font-medium">
                      Imagens Ilustrativas • Sujeito a alteracao de precos
                    </p>
                  </footer>
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
          </>
        )}
      </main>

      <ConfirmDialog
        isOpen={deleteTargetId !== null}
        title="Remover item"
        description={
          productToDelete
            ? productToDelete.itemType === 'spacer'
              ? 'Deseja remover este espaco do catalogo?'
              : `Deseja remover \"${productToDelete.name}\" do catalogo?`
            : 'Deseja remover este item do catalogo?'
        }
        onCancel={cancelDeleteProduct}
        onConfirm={confirmDeleteProduct}
      />

      <ConfirmDialog
        isOpen={isClearAllOpen}
        title="Limpar catalogo"
        description="Deseja remover todos os produtos do catalogo atual?"
        onCancel={cancelClearAll}
        onConfirm={confirmClearAll}
      />

      <ConfirmDialog
        isOpen={isBulkDeleteOpen}
        title="Excluir selecionados"
        description={`Deseja remover ${multiSelectedCount} item(ns) selecionado(s) do catalogo?`}
        onCancel={cancelBulkDelete}
        onConfirm={confirmBulkDelete}
      />

      {isImageSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl border border-gray-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Pesquisar cards (Shift + F)</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-[10px] font-semibold px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                  onClick={handleDeleteTmpCards}
                >
                  Excluir TMP
                </button>
                <button
                  type="button"
                  className="text-xs font-semibold text-gray-500 hover:text-gray-800"
                  onClick={() => setIsImageSearchOpen(false)}
                >
                  Fechar
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase">Buscar por codigo, titulo, tags</label>
                <input
                  ref={imageSearchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ex: 9301, Ovo, Linha Profissional"
                  className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm text-gray-700"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500">
                  {searchLoading ? 'Buscando...' : `${searchResults.length} resultado(s)`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="text-[11px] font-semibold px-3 py-1 rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
                    onClick={toggleSelectAllSearch}
                    disabled={searchResults.length === 0}
                  >
                    Selecionar tudo
                  </button>
                  <button
                    type="button"
                    className="text-[11px] font-semibold px-3 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                    onClick={handleDeleteSelectedFromDb}
                    disabled={searchSelected.size === 0}
                    title="Exclui os cards selecionados do banco de dados"
                  >
                    Excluir do banco
                  </button>
                  <button
                    type="button"
                    className="text-[11px] font-semibold px-3 py-1 rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
                    onClick={addSelectedCardsToCatalog}
                    disabled={searchSelected.size === 0}
                  >
                    Adicionar ao catalogo
                  </button>
                </div>
              </div>
              <div className="text-[10px] text-red-500">
                Ao excluir do banco, os cards selecionados serao removidos permanentemente.
              </div>

              {searchError && (
                <div className="text-[11px] text-red-500">{searchError}</div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[50vh] overflow-y-auto">
                {!searchLoading && searchResults.length === 0 && (
                  <div className="col-span-full text-sm text-gray-400">Nenhum card encontrado.</div>
                )}
                {searchResults.map((result) => (
                  <div key={result.id} className="border border-gray-200 rounded-lg p-2 flex flex-col gap-2">
                    <div className="aspect-square bg-gray-50 rounded flex items-center justify-center overflow-hidden">
                      {result.imageUrl ? (
                        <img src={result.imageUrl} alt={result.title} className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="text-[10px] text-gray-400">Sem imagem</span>
                      )}
                    </div>
                    <div className="text-[11px] font-semibold text-gray-700">{result.refCode} • {result.title}</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={searchSelected.has(result.id)}
                        onChange={() => toggleSearchSelection(result.id)}
                      />
                      <span className="text-[10px] text-gray-500">Selecionar</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg border border-gray-200">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Novo Projeto</h3>
              <button
                type="button"
                className="text-xs font-semibold text-gray-500 hover:text-gray-800"
                onClick={() => setIsProjectModalOpen(false)}
              >
                Fechar
              </button>
            </div>
            <div className="p-4 space-y-4">
              <label className="text-[10px] font-semibold text-gray-500 uppercase">
                Nome
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm text-gray-700"
                />
              </label>
              <label className="text-[10px] font-semibold text-gray-500 uppercase">
                Descricao (opcional)
                <textarea
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm text-gray-700"
                  rows={3}
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-2 text-xs font-semibold rounded border border-gray-200 text-gray-600"
                  onClick={() => setIsProjectModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700"
                  onClick={createProject}
                >
                  Criar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
