import React from 'react';

const SearchModal = React.memo(({
  isOpen,
  onClose,
  searchQuery,
  setSearchQuery,
  searchResults,
  searchSelected,
  searchLoading,
  searchError,
  toggleSearchSelection,
  toggleSelectAllSearch,
  addSelectedCardsToCatalog,
  handleDeleteTmpCards,
  handleDeleteSelectedFromDb,
  inputRef,
}) => {
  if (!isOpen) return null;

  return (
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
              onClick={onClose}
            >
              Fechar
            </button>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-[10px] font-semibold text-gray-500 uppercase">
              Buscar por codigo, titulo, tags
            </label>
            <input
              ref={inputRef}
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

          {searchError && <div className="text-[11px] text-red-500">{searchError}</div>}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[50vh] overflow-y-auto">
            {!searchLoading && searchResults.length === 0 && (
              <div className="col-span-full text-sm text-gray-400">Nenhum card encontrado.</div>
            )}
            {searchResults.map((result) => (
              <div key={result.id} className="border border-gray-200 rounded-lg p-2 flex flex-col gap-2">
                <div className="aspect-square bg-gray-50 rounded flex items-center justify-center overflow-hidden">
                  {result.imageUrl ? (
                    <img src={result.imageUrl} alt={result.title} className="max-h-full max-w-full object-contain" loading="lazy" decoding="async" />
                  ) : (
                    <span className="text-[10px] text-gray-400">Sem imagem</span>
                  )}
                </div>
                <div className="text-[11px] font-semibold text-gray-700">{result.refCode} • {result.title}</div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={searchSelected.has(result.id)} onChange={() => toggleSearchSelection(result.id)} />
                  <span className="text-[10px] text-gray-500">Selecionar</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

SearchModal.displayName = 'SearchModal';
export default SearchModal;
