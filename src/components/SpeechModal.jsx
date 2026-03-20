import React, { useState, useCallback, useEffect } from 'react';
import { X, Download, Loader2, FileText, Copy, Check } from 'lucide-react';

const SpeechModal = React.memo(({ isOpen, onClose, catalogId, catalogName }) => {
  const [templateType, setTemplateType] = useState('sales_pitch');
  const [title, setTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSpeech, setGeneratedSpeech] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setGeneratedSpeech(null);
      setError(null);
      setTitle('');
      setTemplateType('sales_pitch');
      setCopied(false);
    }
  }, [isOpen]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/catalogs/${catalogId}/speech/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateType, title: title || undefined })
      });

      if (!response.ok) {
        throw new Error('Falha ao gerar discurso');
      }

      const data = await response.json();
      setGeneratedSpeech(data.speech);
    } catch (err) {
      setError(err.message || 'Erro ao gerar discurso');
    } finally {
      setIsGenerating(false);
    }
  }, [catalogId, templateType, title]);

  const handleDownload = useCallback((format) => {
    if (!generatedSpeech) return;

    const extension = format === 'markdown' ? 'md' : 'txt';
    const content = generatedSpeech.content;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${generatedSpeech.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [generatedSpeech]);

  const handleCopy = useCallback(async () => {
    if (!generatedSpeech) return;

    try {
      await navigator.clipboard.writeText(generatedSpeech.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  }, [generatedSpeech]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <FileText size={24} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Gerar Discurso</h2>
              <p className="text-sm text-gray-500">{catalogName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            type="button"
            aria-label="Fechar"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!generatedSpeech ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tipo de Discurso
                </label>
                <select
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="sales_pitch">Apresentação de Vendas</option>
                  <option value="product_overview">Visão Geral dos Produtos</option>
                  <option value="executive_summary">Resumo Executivo</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {templateType === 'sales_pitch' && 'Discurso completo com introdução, destaques e conclusão'}
                  {templateType === 'product_overview' && 'Lista organizada de todos os produtos'}
                  {templateType === 'executive_summary' && 'Resumo com métricas e principais produtos'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Título (opcional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`Apresentação: ${catalogName}`}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-800">{generatedSpeech.title}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="btn-action bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-200"
                    type="button"
                    title="Copiar para área de transferência"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                  <button
                    onClick={() => handleDownload('markdown')}
                    className="btn-action bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100"
                    type="button"
                  >
                    <Download size={16} /> Markdown
                  </button>
                  <button
                    onClick={() => handleDownload('txt')}
                    className="btn-action bg-green-50 text-green-700 hover:bg-green-100 border-green-100"
                    type="button"
                  >
                    <Download size={16} /> TXT
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                  {generatedSpeech.content}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          {!generatedSpeech ? (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                type="button"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className={`px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                  isGenerating
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                type="button"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <FileText size={18} />
                    Gerar Discurso
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-900 text-white rounded-lg font-semibold hover:bg-black transition-colors"
              type="button"
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

SpeechModal.displayName = 'SpeechModal';

export default SpeechModal;
