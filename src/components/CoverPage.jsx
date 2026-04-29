import React from 'react';
import { A4_WIDTH_MM, A4_HEIGHT_MM } from '../constants';

const CoverPage = React.memo(({ settings, resolvedCoverLogos, isGenerating }) => {
  if (!settings.showCover) return null;

  return (
    <div
      className={`bg-white relative flex flex-col overflow-hidden transition-none ${
        isGenerating ? 'shadow-none mb-0' : 'shadow-2xl mb-10 ring-1 ring-gray-900/5'
      } cover-ui`}
      style={{
        width: `${A4_WIDTH_MM}mm`,
        height: `${A4_HEIGHT_MM}mm`,
        backgroundColor: '#ffffff',
        pageBreakAfter: 'always',
      }}
    >
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${settings.backgroundColor} 0%, #ffffff 55%, ${settings.backgroundColor} 100%)` }}
        />
        <div className="absolute -top-24 -right-16 w-[360px] h-[360px] rounded-full" style={{ backgroundColor: settings.primaryColor, opacity: 0.12 }} />
        <div className="absolute -bottom-28 -left-20 w-[420px] h-[420px] rounded-full" style={{ backgroundColor: settings.primaryColor, opacity: 0.08 }} />
      </div>

      <div className="relative z-10 h-full flex flex-col justify-between" style={{ padding: '14mm' }}>
        <div className="flex items-start justify-between gap-6">
          <div className="h-6" />
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <div className="pdf-text pdf-cover-title cover-title text-5xl md:text-6xl font-black tracking-tight" style={{ color: settings.primaryColor }}>
            {settings.coverTitle || 'TITULO DO CATALOGO'}
          </div>
          {settings.showCoverSubtitle && (
            <div className="pdf-text pdf-cover-subtitle text-xl md:text-2xl font-medium text-gray-600 mt-4">
              {settings.coverSubtitle || 'SUBTITULO'}
            </div>
          )}
        </div>

        <div className="flex items-end justify-between gap-6">
          <div className="mt-4 flex items-center gap-6 flex-wrap">
            {resolvedCoverLogos
              .filter((logo) => logo.enabled)
              .map((logo) => (
                <div key={logo.id} className="flex flex-col items-center gap-1">
                  <img
                    src={logo.src}
                    alt={logo.name}
                    style={{ height: `${settings.coverLogoSize}px` }}
                    className="object-contain max-w-[140px]"
                    loading="lazy"
                  />
                  <span className="pdf-text pdf-small text-[9px] uppercase tracking-widest text-gray-500">{logo.name}</span>
                </div>
              ))}
          </div>
          <div className="pdf-text pdf-small text-[10px] text-gray-500 text-right w-56">
            {settings.coverFooter || 'RODAPE'}
          </div>
        </div>
      </div>
    </div>
  );
});

CoverPage.displayName = 'CoverPage';
export default CoverPage;
