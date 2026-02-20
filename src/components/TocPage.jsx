import React from 'react';
import { A4_WIDTH_MM, A4_HEIGHT_MM } from '../constants';

const TocPage = React.memo(({ entries, tocPageIndex, coverPageCount, tocPageCount, settings, isGenerating }) => (
  <div
    className={`bg-white relative flex flex-col overflow-hidden transition-none ${
      isGenerating ? 'shadow-none mb-0' : 'shadow-2xl mb-10 ring-1 ring-gray-900/5'
    } cover-ui`}
    style={{
      width: `${A4_WIDTH_MM}mm`,
      height: `${A4_HEIGHT_MM}mm`,
      backgroundColor: '#ffffff',
      padding: '14mm',
      pageBreakAfter: 'always',
    }}
    data-toc-page-container={tocPageIndex}
  >
    <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: settings.borderColor }}>
      <h2 className="text-3xl font-black" style={{ color: settings.primaryColor }}>Indice</h2>
      <div className="text-[9px] font-mono text-gray-400">PAGINA {coverPageCount + tocPageIndex + 1}</div>
    </div>

    <div className="mt-6 flex-1 flex flex-col gap-2">
      {entries.length === 0 && <div className="text-sm text-gray-400">Nenhum subtitulo encontrado.</div>}
      {entries.map((entry) => {
        const humanPageNumber = coverPageCount + tocPageCount + entry.pageIndex + 1;
        return (
          <button
            key={entry.anchorId}
            type="button"
            className="flex items-center gap-3 text-[11px] text-gray-700 hover:text-gray-900 text-left"
            data-toc-entry
            data-toc-page-index={tocPageIndex}
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
));

TocPage.displayName = 'TocPage';
export default TocPage;
