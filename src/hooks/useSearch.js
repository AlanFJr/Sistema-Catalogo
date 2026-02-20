import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';

export function useSearch(isOpen) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchSelected, setSearchSelected] = useState(new Set());
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
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
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, isOpen]);

  const toggleSearchSelection = useCallback((cardId) => {
    setSearchSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }, []);

  const toggleSelectAllSearch = useCallback(() => {
    setSearchSelected((prev) => {
      const resultIds = searchResults.map((r) => r.id);
      const isAllSelected = resultIds.length > 0 && resultIds.every((id) => prev.has(id));
      return isAllSelected ? new Set() : new Set(resultIds);
    });
  }, [searchResults]);

  const resetSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchSelected(new Set());
    setSearchError(null);
  }, []);

  const addSelectedCardsToCatalog = useCallback(async (catalogId, existingProducts, reloadCatalog, closeModal) => {
    if (!catalogId || searchSelected.size === 0) return;
    try {
      const existingIds = new Set(
        existingProducts.filter((i) => i.itemType === 'card').map((i) => i.cardId)
      );
      const ids = Array.from(searchSelected).filter((id) => !existingIds.has(id));
      const skipped = searchSelected.size - ids.length;
      if (ids.length === 0) {
        alert('Todos os cards selecionados ja estao no catalogo.');
        return;
      }
      await Promise.all(
        ids.map((cardId, index) =>
          apiFetch(`/catalogs/${catalogId}/cards`, {
            method: 'POST',
            body: { cardId, position: existingProducts.length + index },
          })
        )
      );
      setSearchSelected(new Set());
      await reloadCatalog();
      closeModal();
      if (skipped > 0) alert(`${skipped} card(s) ja estavam no catalogo e foram ignorados.`);
    } catch (error) {
      alert(error.message || 'Erro ao adicionar cards ao catalogo.');
    }
  }, [searchSelected]);

  const handleDeleteTmpCards = useCallback(async (reloadCatalog) => {
    if (!window.confirm('Excluir todos os cards TMP do sistema?')) return;
    try {
      const result = await apiFetch('/cards/tmp', { method: 'DELETE' });
      await reloadCatalog();
      resetSearch();
      alert(`TMP removidos: ${result.deleted}`);
    } catch (error) {
      alert(error.message || 'Erro ao remover TMP.');
    }
  }, [resetSearch]);

  const handleDeleteSelectedFromDb = useCallback(async (reloadCatalog) => {
    if (searchSelected.size === 0) return;
    const confirmText = window.prompt('Digite "sim" para excluir do banco de dados:');
    if (!confirmText || confirmText.trim().toLowerCase() !== 'sim') return;
    try {
      const ids = Array.from(searchSelected);
      await Promise.all(ids.map((id) => apiFetch(`/cards/${id}`, { method: 'DELETE' })));
      setSearchSelected(new Set());
      await reloadCatalog();
      resetSearch();
      alert('Cards removidos do banco de dados.');
    } catch (error) {
      alert(error.message || 'Erro ao excluir do banco de dados.');
    }
  }, [searchSelected, resetSearch]);

  return {
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
    resetSearch,
  };
}
