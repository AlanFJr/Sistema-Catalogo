import React, { useMemo } from 'react';
import { A4_WIDTH_MM, A4_HEIGHT_MM, ITEMS_PER_PAGE } from '../constants';
import SortableCatalogItem from './SortableCatalogItem';

const CatalogPage = React.memo(({
  pageProducts,
  pageIndex,
  settings,
  pageSubtitles,
  selectedItemId,
  multiSelectedIds,
  isGenerating,
  tocAnchorsByPage,
  todayDateText,
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
  onPageSubtitleChange,
  onInsertProductAt,
  onInsertSpacerAt,
  getCatalogInsertIndexForDisplay,
  onSettingsChange,
}) => {
  const subtitle = pageSubtitles[pageIndex] !== undefined ? pageSubtitles[pageIndex] : settings.subtitle;

  return (
    <div
      className={`bg-white relative flex flex-col overflow-hidden transition-none ${
        isGenerating ? 'shadow-none mb-0' : 'shadow-2xl mb-10 ring-1 ring-gray-900/5'
      }`}
      style={{
        width: `${A4_WIDTH_MM}mm`,
        height: `${A4_HEIGHT_MM}mm`,
        backgroundColor: settings.backgroundColor,
        padding: '12mm',
        pageBreakAfter: 'always',
      }}
    >
      <header
        className="flex justify-between items-end border-b-2 pb-3 mb-4 shrink-0"
        style={{ borderColor: settings.primaryColor, height: '30mm' }}
      >
        <div className="flex-1 pr-6">
          {tocAnchorsByPage.has(pageIndex) && <div id={tocAnchorsByPage.get(pageIndex)} />}
          <input
            value={settings.title}
            onChange={(e) => onSettingsChange({ ...settings, title: e.target.value })}
            className="text-3xl font-black bg-transparent w-full focus:outline-none placeholder-gray-300 tracking-tight"
            style={{ color: settings.primaryColor }}
            placeholder="TITULO DO CATALOGO"
          />
          <input
            value={subtitle}
            onChange={(e) => onPageSubtitleChange(pageIndex, e.target.value)}
            className="text-lg font-medium text-gray-500 bg-transparent w-full focus:outline-none mt-1 placeholder-gray-400"
            placeholder="Subtitulo desta pagina"
          />
        </div>
        <div className="text-right shrink-0 opacity-60">
          <div className="text-[9px] font-mono text-gray-400">PAGINA {pageIndex + 1}</div>
          <div className="text-[9px] font-mono text-gray-400">{todayDateText}</div>
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
              onSelectItem={onSelectItem}
              onToggleMultiSelect={onToggleMultiSelect}
              onValidateRef={onValidateRef}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onInsertAfter={onInsertAfter}
              onInsertBefore={onInsertBefore}
              onUploadImage={onUploadImage}
              onResizeSpacer={onResizeSpacer}
              onCtrlSelectStart={onCtrlSelectStart}
              onCtrlSelectHover={onCtrlSelectHover}
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
                    onClick={() => onInsertProductAt(absoluteIndex)}
                    title="Adicionar card aqui"
                    data-html2canvas-ignore="true"
                  >
                    + Card
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 shadow-sm"
                    onClick={() => onInsertSpacerAt(absoluteIndex, 'md')}
                    title="Adicionar espaco"
                    data-html2canvas-ignore="true"
                  >
                    + Espaco
                  </button>
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
  );
});

CatalogPage.displayName = 'CatalogPage';
export default CatalogPage;
