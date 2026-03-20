import React, { useRef } from 'react';
import {
  Plus, Trash2, Settings, Palette, LayoutGrid, Download, Loader2,
  FileSpreadsheet, Save, FolderOpen, Eye, EyeOff, FileText,
} from 'lucide-react';
import ToggleField from './ui/ToggleField';
import ColorPicker from './ui/ColorPicker';
import { DEFAULT_COVER_LOGOS } from '../constants';

const Sidebar = React.memo(({
  activeTab,
  setActiveTab,
  settings,
  setSettings,
  resolvedCoverLogos,
  isGenerating,
  multiSelectedCount,
  onAddProduct,
  onExportProject,
  onImportProject,
  onCsvUpload,
  onRequestClearAll,
  onRequestBulkDelete,
  onClearMultiSelection,
  onDownloadCsvTemplate,
  onDownloadPdf,
  onGenerateSpeech,
  updateCoverLogo,
}) => {
  const csvInputRef = useRef(null);
  const projectInputRef = useRef(null);

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    e.target.value = null;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onImportProject(ev.target.result);
    reader.readAsText(file);
  };

  const handleCsvFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onCsvUpload(ev.target.result);
    reader.readAsText(file);
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  return (
    <aside className="w-full md:w-80 bg-white shadow-xl z-30 flex flex-col h-full border-r border-gray-200">
      <div className="p-5 border-b border-gray-100 flex items-center gap-2">
        <div className="bg-blue-600 p-2 rounded-lg text-white">
          <LayoutGrid size={20} />
        </div>
        <div>
          <h1 className="font-bold text-gray-800 leading-tight">PIM Builder</h1>
          <p className="text-[10px] text-gray-400 font-medium">v3.0 Performance</p>
        </div>
      </div>

      <div className="px-5 pt-4">
        <div className="grid grid-cols-2 gap-2">
          {['editor', 'projects'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`text-xs font-semibold rounded border px-2 py-2 transition-colors ${
                activeTab === tab
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-gray-50 border-gray-200 text-gray-500'
              }`}
            >
              {tab === 'editor' ? 'Editor' : 'Projetos'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Gerenciamento</label>

          <div className="grid grid-cols-2 gap-2 mb-2">
            <button onClick={onExportProject} className="btn-action bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-100" title="Salvar arquivo de projeto" type="button">
              <Save size={16} /> Salvar
            </button>
            <button onClick={() => projectInputRef.current?.click()} className="btn-action bg-orange-50 text-orange-700 hover:bg-orange-100 border-orange-100" title="Abrir arquivo de projeto" type="button">
              <FolderOpen size={16} /> Abrir
            </button>
            <input type="file" ref={projectInputRef} accept=".json" className="hidden" onChange={handleImportFile} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={onAddProduct} className="btn-action bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100" type="button">
              <Plus size={16} /> Adicionar
            </button>
            <button onClick={() => csvInputRef.current?.click()} className="btn-action bg-green-50 text-green-700 hover:bg-green-100 border-green-100" title="Basta: Codigo; Nome; Preco" type="button">
              <FileSpreadsheet size={16} /> Importar
            </button>
            <input type="file" ref={csvInputRef} accept=".csv" className="hidden" onChange={handleCsvFile} />
          </div>

          <button onClick={onRequestClearAll} className="btn-action w-full bg-red-50 text-red-700 hover:bg-red-100 border-red-100" type="button" title="Remove todos os produtos">
            <Trash2 size={16} /> Limpar tudo
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onRequestBulkDelete}
              disabled={multiSelectedCount === 0}
              className={`btn-action ${multiSelectedCount === 0 ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-red-50 text-red-700 hover:bg-red-100 border-red-100'}`}
              type="button"
            >
              <Trash2 size={16} /> Excluir sel.
            </button>
            <button
              onClick={onClearMultiSelection}
              disabled={multiSelectedCount === 0}
              className={`btn-action ${multiSelectedCount === 0 ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200'}`}
              type="button"
            >
              Limpar ({multiSelectedCount})
            </button>
          </div>

          <div className="text-right">
            <button onClick={onDownloadCsvTemplate} className="text-[10px] text-blue-600 hover:underline hover:text-blue-800 flex items-center justify-end gap-1 ml-auto transition-colors" type="button">
              <Download size={10} /> Baixar modelo CSV
            </button>
          </div>

          <button
            onClick={onDownloadPdf}
            disabled={isGenerating}
            className={`w-full py-3 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all mt-4 ${
              isGenerating ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-black hover:shadow-md active:scale-95'
            }`}
            type="button"
          >
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            {isGenerating ? 'Processando...' : 'Gerar PDF'}
          </button>

          <button
            onClick={onGenerateSpeech}
            className="w-full py-3 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all mt-2 bg-purple-600 text-white hover:bg-purple-700 hover:shadow-md active:scale-95"
            type="button"
          >
            <FileText size={18} />
            Gerar Discurso
          </button>
        </div>

        <hr className="border-gray-100" />

        {/* Cover settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye size={14} className="text-gray-400" />
            <span className="text-xs font-bold text-gray-700">Capa do Catalogo</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ToggleField label={settings.showCover ? 'Capa Ativa' : 'Capa Oculta'} active={settings.showCover} onClick={() => setSettings({ ...settings, showCover: !settings.showCover })} />
            <ToggleField label={settings.showCoverSubtitle ? 'Sub Visivel' : 'Sub Oculto'} active={settings.showCoverSubtitle} onClick={() => setSettings({ ...settings, showCoverSubtitle: !settings.showCoverSubtitle })} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'coverTitle', label: 'Titulo' },
              { key: 'coverSubtitle', label: 'Subtitulo' },
              { key: 'coverFooter', label: 'Rodape' },
            ].map(({ key, label }) => (
              <label key={key} className="text-[10px] font-semibold text-gray-500 col-span-2">
                {label}
                <input type="text" value={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700" />
              </label>
            ))}
          </div>

          <div className="pt-2">
            <label className="text-xs text-gray-500 mb-2 block flex justify-between">
              <span>Tamanho dos Logos</span>
              <span className="font-mono">{settings.coverLogoSize}px</span>
            </label>
            <input type="range" min="36" max="110" value={settings.coverLogoSize} onChange={(e) => setSettings({ ...settings, coverLogoSize: parseInt(e.target.value, 10) })} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
          </div>

          <div className="space-y-2">
            {resolvedCoverLogos.map((logo) => (
              <div key={logo.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateCoverLogo(logo.id, { enabled: !logo.enabled })}
                  className={`h-6 w-6 rounded border text-[10px] font-bold flex items-center justify-center ${
                    logo.enabled ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}
                >
                  {logo.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
                <input type="text" value={logo.name} onChange={(e) => updateCoverLogo(logo.id, { name: e.target.value })} className="flex-1 rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700" />
              </div>
            ))}
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Field visibility */}
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

        {/* Field labels */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings size={14} className="text-gray-400" />
            <span className="text-xs font-bold text-gray-700">Nomes dos Campos</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'labelDimensions', label: 'Dimensoes' },
              { key: 'labelWeight', label: 'Peso' },
              { key: 'labelBoxQty', label: 'Qtd/Cx' },
              { key: 'labelPrice', label: 'Preco' },
            ].map(({ key, label }) => (
              <label key={key} className="text-[10px] font-semibold text-gray-500">
                {label}
                <input type="text" value={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-700" />
              </label>
            ))}
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Visual identity */}
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
            <input type="range" min="0" max="16" value={settings.borderRadius} onChange={(e) => setSettings({ ...settings, borderRadius: parseInt(e.target.value, 10) })} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
          </div>
        </div>
      </div>
    </aside>
  );
});

Sidebar.displayName = 'Sidebar';
export default Sidebar;
