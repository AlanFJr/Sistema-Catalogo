import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, apiFetchWithRetry } from '../utils/api';
import { compressDataUrlIfNeeded, readFileAsDataUrl, blobToDataUrl } from '../utils/image';
import { dataUrlToBlob, mapItemToProduct, normalizePageSubtitles } from '../utils/helpers';
import { DEFAULT_SETTINGS } from '../constants';

export function useCatalog() {
  const [products, setProducts] = useState([]);
  const [catalogId, setCatalogId] = useState(() => localStorage.getItem('bwb_catalog_id') || null);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [pageSubtitles, setPageSubtitles] = useState({});

  const productsRef = useRef([]);
  const lastValidRefByCard = useRef(new Map());
  const cardUpdateTimers = useRef(new Map());

  // Keep productsRef in sync
  useEffect(() => {
    productsRef.current = products;
    products.forEach((item) => {
      if (item.itemType === 'card' && item.cardId && item.code && !String(item.code).startsWith('TMP-')) {
        lastValidRefByCard.current.set(item.cardId, item.code);
      }
    });
  }, [products]);

  // Load catalog on mount
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
          const created = await apiFetch('/catalogs', { method: 'POST', body: { name: 'Catalogo Atual' } });
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
            const created = await apiFetch('/catalogs', { method: 'POST', body: { name: 'Catalogo Atual' } });
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
    return () => { isMounted = false; };
  }, []);

  // Load/save titles per catalog
  useEffect(() => {
    if (!catalogId) return;
    const storageKey = `bwb_catalog_text_${catalogId}`;
    const raw = localStorage.getItem(storageKey);

    setSettings((prev) => ({
      ...prev,
      title: DEFAULT_SETTINGS.title,
      subtitle: DEFAULT_SETTINGS.subtitle,
    }));
    setPageSubtitles({});

    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        setSettings((prev) => ({
          ...prev,
          title: typeof parsed.title === 'string' ? parsed.title : prev.title,
          subtitle: typeof parsed.subtitle === 'string' ? parsed.subtitle : prev.subtitle,
        }));
        setPageSubtitles(normalizePageSubtitles(parsed.pageSubtitles));
      }
    } catch (_) { /* ignore */ }
  }, [catalogId]);

  // Persist title changes
  useEffect(() => {
    if (!catalogId) return;
    const storageKey = `bwb_catalog_text_${catalogId}`;
    const payload = {
      title: settings.title,
      subtitle: settings.subtitle,
      pageSubtitles: normalizePageSubtitles(pageSubtitles),
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [catalogId, settings.title, settings.subtitle, pageSubtitles]);

  const reloadCatalog = useCallback(async () => {
    if (!catalogId) return;
    const payload = await apiFetch(`/catalogs/${catalogId}`);
    setProducts((payload.items || []).map(mapItemToProduct));
  }, [catalogId]);

  const persistCatalogOrder = useCallback(async (nextProducts) => {
    if (!catalogId) return;
    const itemIds = nextProducts.map((p) => p.id);
    await apiFetch(`/catalogs/${catalogId}/items/reorder`, { method: 'PUT', body: { itemIds } });
  }, [catalogId]);

  const scheduleCardUpdate = useCallback((id, changes) => {
    const existingTimer = cardUpdateTimers.current.get(id);
    if (existingTimer) clearTimeout(existingTimer);
    const timer = setTimeout(async () => {
      try {
        await apiFetch(`/cards/${id}`, { method: 'PUT', body: changes });
      } catch (error) {
        alert(error.message || 'Erro ao salvar card.');
      }
    }, 400);
    cardUpdateTimers.current.set(id, timer);
  }, []);

  const getOrCreateCardByRef = useCallback(async (payload) => {
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
  }, []);

  const createCardAndAttach = useCallback(async (position, overrides = {}) => {
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
      price: overrides.price || '0,00',
    };
    const created = await apiFetch('/cards', { method: 'POST', body: payload });
    const attached = await apiFetch(`/catalogs/${catalogId}/cards`, {
      method: 'POST',
      body: { cardId: created.card.id, position },
    });
    return attached.catalogItem;
  }, [catalogId]);

  const createSpacerAt = useCallback(async (position, size = 'md') => {
    if (!catalogId) throw new Error('Catalogo nao carregado.');
    const response = await apiFetch(`/catalogs/${catalogId}/spacers`, {
      method: 'POST',
      body: { position, spacerConfig: { size } },
    });
    return response.spacer;
  }, [catalogId]);

  const updateSpacerSize = useCallback(async (itemId, config) => {
    if (!catalogId) return;
    try {
      await apiFetch(`/catalogs/${catalogId}/spacers/${itemId}`, {
        method: 'PUT',
        body: { spacerConfig: config },
      });
      setProducts((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, spacerConfig: config } : item))
      );
    } catch (error) {
      alert(error.message || 'Erro ao atualizar espaco.');
    }
  }, [catalogId]);

  const validateAndSaveRefCode = useCallback(async (cardId, nextCode) => {
    const trimmed = String(nextCode || '').trim();
    if (!trimmed || trimmed.startsWith('TMP-')) {
      alert('Informe um cod ref valido (nao pode ser vazio ou TMP).');
      const fallback = lastValidRefByCard.current.get(cardId) || '';
      setProducts((prev) => prev.map((item) => (item.cardId === cardId ? { ...item, code: fallback } : item)));
      return false;
    }
    try {
      const existing = await apiFetch(`/cards/by-ref/${encodeURIComponent(trimmed)}`);
      if (existing.card?.id && existing.card.id !== cardId) {
        alert('Cod ref ja existe. Escolha outro.');
        const fallback = lastValidRefByCard.current.get(cardId) || '';
        setProducts((prev) => prev.map((item) => (item.cardId === cardId ? { ...item, code: fallback } : item)));
        return false;
      }
    } catch (error) {
      if (!String(error.message || '').includes('Card nao encontrado')) {
        alert(error.message || 'Erro ao validar cod ref.');
        return false;
      }
    }
    setProducts((prev) =>
      prev.map((item) => {
        if (item.cardId !== cardId) return item;
        const shouldOverwriteName = !item.name || item.name === 'Novo Produto' || item.name.startsWith('TMP-');
        return { ...item, code: trimmed, name: shouldOverwriteName ? trimmed : item.name };
      })
    );
    lastValidRefByCard.current.set(cardId, trimmed);
    scheduleCardUpdate(cardId, { refCode: trimmed });
    return true;
  }, [scheduleCardUpdate]);

  const convertItemToSpacer = useCallback(async (itemId, index, size = 'md') => {
    if (!catalogId) return;
    try {
      const spacer = await createSpacerAt(index, size);
      await apiFetch(`/catalogs/${catalogId}/items/${itemId}`, { method: 'DELETE' });
      await reloadCatalog();
      return spacer?.id || null;
    } catch (error) {
      alert(error.message || 'Erro ao converter para espaco.');
      return null;
    }
  }, [catalogId, createSpacerAt, reloadCatalog]);

  const uploadCardImage = useCallback(async (cardId, file) => {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const finalDataUrl = await compressDataUrlIfNeeded(dataUrl);
      const { blob, mime } = dataUrlToBlob(finalDataUrl);
      const form = new FormData();
      const filename = file?.name || `card-${cardId}.jpg`;
      form.append('image', new File([blob], filename, { type: mime }));
      const response = await apiFetchWithRetry(`/cards/${cardId}/images`, {
        method: 'POST',
        body: form,
        isForm: true,
      });
      setProducts((prev) =>
        prev.map((p) => (p.cardId === cardId ? { ...p, image: response.image.url } : p))
      );
    } catch (error) {
      alert(error.message || 'Erro ao enviar imagem.');
    }
  }, []);

  const uploadCardImageFromDataUrl = useCallback(async (cardId, dataUrl, filename) => {
    try {
      const finalDataUrl = await compressDataUrlIfNeeded(dataUrl);
      const { blob, mime } = dataUrlToBlob(finalDataUrl);
      const safeName = filename || `card-${cardId}.jpg`;
      const form = new FormData();
      form.append('image', new File([blob], safeName, { type: mime }));
      const response = await apiFetchWithRetry(`/cards/${cardId}/images`, {
        method: 'POST',
        body: form,
        isForm: true,
      });
      setProducts((prev) =>
        prev.map((p) => (p.cardId === cardId ? { ...p, image: response.image.url } : p))
      );
    } catch (error) {
      console.error('Erro ao enviar imagem do JSON', error);
    }
  }, []);

  const addProduct = useCallback(async () => {
    try {
      const item = await createCardAndAttach(products.length);
      const next = [...products, mapItemToProduct(item)];
      setProducts(next);
      await persistCatalogOrder(next);
    } catch (error) {
      alert(error.message || 'Erro ao criar card.');
    }
  }, [products, createCardAndAttach, persistCatalogOrder]);

  const insertProductAt = useCallback(async (index) => {
    try {
      const item = await createCardAndAttach(index);
      const next = [...productsRef.current];
      next.splice(index, 0, mapItemToProduct(item));
      setProducts(next);
      await persistCatalogOrder(next);
    } catch (error) {
      alert(error.message || 'Erro ao criar card.');
    }
  }, [createCardAndAttach, persistCatalogOrder]);

  const insertSpacerAt = useCallback(async (index, size = 'md') => {
    try {
      const spacer = await createSpacerAt(index, size);
      const next = [...productsRef.current];
      next.splice(index, 0, mapItemToProduct(spacer));
      setProducts(next);
      await persistCatalogOrder(next);
    } catch (error) {
      alert(error.message || 'Erro ao criar espaco.');
    }
  }, [createSpacerAt, persistCatalogOrder]);

  const insertProductAfter = useCallback(async (itemId) => {
    const idx = productsRef.current.findIndex((item) => item.id === itemId);
    if (idx === -1) return;
    await insertProductAt(idx + 1);
  }, [insertProductAt]);

  const insertProductBefore = useCallback(async (itemId) => {
    const idx = productsRef.current.findIndex((item) => item.id === itemId);
    if (idx === -1) return;
    await insertProductAt(idx);
  }, [insertProductAt]);

  const updateProduct = useCallback((cardId, changes) => {
    setProducts((prev) => prev.map((p) => (p.cardId === cardId ? { ...p, ...changes } : p)));
    const payload = {
      title: changes.name,
      description: changes.description,
      tags: changes.tags,
      dimensions: changes.dimensions,
      weight: changes.weight,
      boxQty: changes.boxQty,
      price: changes.price,
    };
    const filtered = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
    if (Object.keys(filtered).length > 0) {
      scheduleCardUpdate(cardId, filtered);
    }
  }, [scheduleCardUpdate]);

  const deleteItem = useCallback(async (itemId) => {
    if (!catalogId) return;
    await apiFetch(`/catalogs/${catalogId}/items/${itemId}`, { method: 'DELETE' });
    setProducts((prev) => prev.filter((p) => p.id !== itemId));
  }, [catalogId]);

  const bulkDeleteItems = useCallback(async (itemIds) => {
    if (!catalogId || itemIds.length === 0) return;
    await Promise.all(
      itemIds.map((id) => apiFetch(`/catalogs/${catalogId}/items/${id}`, { method: 'DELETE' }))
    );
    const idSet = new Set(itemIds);
    setProducts((prev) => prev.filter((item) => !idSet.has(item.id)));
  }, [catalogId]);

  const clearAll = useCallback(async () => {
    if (!catalogId) return;
    await Promise.all(
      productsRef.current.map((p) =>
        apiFetch(`/catalogs/${catalogId}/items/${p.id}`, { method: 'DELETE' })
      )
    );
    setProducts([]);
    setPageSubtitles({});
  }, [catalogId]);

  const handlePageSubtitleChange = useCallback((pageIndex, value) => {
    setPageSubtitles((prev) => ({ ...prev, [pageIndex]: value }));
  }, []);

  const handleExportProject = useCallback(async () => {
    const exportItems = await Promise.all(
      productsRef.current.map(async (item) => {
        if (item.itemType === 'spacer') {
          return { itemType: 'spacer', spacerConfig: item.spacerConfig || { size: 'md' } };
        }
        let image = item.image || null;
        if (image && !String(image).startsWith('data:image/')) {
          try {
            const response = await fetch(image);
            const blob = await response.blob();
            image = await blobToDataUrl(blob);
          } catch (_) { /* ignore */ }
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
          image,
        };
      })
    );
    const data = {
      version: '2.2',
      timestamp: new Date().toISOString(),
      products: exportItems,
      settings,
      pageSubtitles: normalizePageSubtitles(pageSubtitles),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PROJETO-BWB-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [settings, pageSubtitles]);

  const handleImportProject = useCallback(async (fileData) => {
    try {
      const data = JSON.parse(fileData);
      if (!data.products || !Array.isArray(data.products)) {
        alert('Arquivo de projeto invalido.');
        return;
      }
      if (!catalogId) throw new Error('Catalogo nao carregado.');

      const importedSubtitles = normalizePageSubtitles(data.pageSubtitles || data.subtitles);

      // Build set of refCodes already in the catalog (upper-cased for comparison)
      const existingRefKeys = new Set(
        productsRef.current
          .filter((item) => item.itemType === 'card' && item.code)
          .map((item) => String(item.code).trim().toUpperCase())
      );
      const existingCardIds = new Set(
        productsRef.current
          .filter((item) => item.itemType === 'card' && item.cardId)
          .map((item) => item.cardId)
      );

      // Deduplicate and filter products from JSON
      const seenRefsInFile = new Set();
      const cardProducts = []; // cards to potentially add
      const spacerProducts = []; // spacers with original index for position
      let skippedCatalog = 0;
      let skippedDup = 0;

      for (let idx = 0; idx < data.products.length; idx++) {
        const product = data.products[idx];
        if (product.itemType === 'spacer') {
          spacerProducts.push({ product, idx });
          continue;
        }
        const normalizedRef = String(product.code || '').trim();
        if (!normalizedRef) continue;
        const refKey = normalizedRef.toUpperCase();
        if (seenRefsInFile.has(refKey)) { skippedDup += 1; continue; }
        seenRefsInFile.add(refKey);
        if (existingRefKeys.has(refKey)) { skippedCatalog += 1; continue; }
        cardProducts.push({ product, refCode: normalizedRef, idx });
      }

      const skipped = skippedCatalog + skippedDup;
      const totalToAdd = cardProducts.length + spacerProducts.length;

      if (totalToAdd === 0) {
        if (data.settings) setSettings((prev) => ({ ...prev, ...data.settings }));
        setPageSubtitles(importedSubtitles);
        alert(`Nenhum produto novo encontrado. ${skipped} ja estavam no catalogo.`);
        return;
      }

      const msg = `Serao adicionados ${totalToAdd} item(ns) novo(s) ao catalogo.${skipped > 0 ? ` ${skipped} ja existente(s) serao ignorados.` : ''} Continuar?`;
      if (!window.confirm(msg)) return;

      // --- BULK: resolve all cards in the DB in a single request ---
      const bulkPayloads = cardProducts.map((cp) => ({
        refCode: cp.refCode,
        title: cp.product.name || cp.refCode,
        description: cp.product.description || '',
        tags: cp.product.tags || '',
        dimensions: cp.product.dimensions || '',
        weight: cp.product.weight || '',
        boxQty: cp.product.boxQty || '',
        price: cp.product.price || '',
      }));

      const bulkResult = await apiFetch('/cards/bulk-create', {
        method: 'POST',
        body: { items: bulkPayloads },
      });
      const cardMap = bulkResult.cards; // { refCode: cardData }

      // --- Attach cards and spacers to catalog in parallel batches ---
      // Build ordered list preserving original position from JSON file
      const toAttach = [];
      // Index card products by their original idx for quick lookup
      const cardByIdx = new Map();
      for (const cp of cardProducts) {
        const card = cardMap[cp.refCode];
        if (!card || existingCardIds.has(card.id)) continue;
        existingCardIds.add(card.id);
        cardByIdx.set(cp.idx, { type: 'card', card, product: cp.product, originalIdx: cp.idx });
      }
      // Merge cards and spacers in original JSON order
      const allItems = [
        ...Array.from(cardByIdx.values()),
        ...spacerProducts.map((sp) => ({ type: 'spacer', product: sp.product, originalIdx: sp.idx }))
      ];
      allItems.sort((a, b) => a.originalIdx - b.originalIdx);
      toAttach.push(...allItems);

      const BATCH_SIZE = 8;
      const basePosition = productsRef.current.length;
      let addedCount = 0;

      for (let i = 0; i < toAttach.length; i += BATCH_SIZE) {
        const batch = toAttach.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (entry, batchIdx) => {
            const position = basePosition + i + batchIdx;
            if (entry.type === 'spacer') {
              await createSpacerAt(position, entry.product.spacerConfig?.size || 'md');
              addedCount += 1;
              return;
            }
            await apiFetch(`/catalogs/${catalogId}/cards`, {
              method: 'POST',
              body: { cardId: entry.card.id, position },
            });
            addedCount += 1;
            // Upload image only if the card has no image yet
            if (!entry.card.imageUrl && entry.product.image && String(entry.product.image).startsWith('data:image/')) {
              await uploadCardImageFromDataUrl(entry.card.id, entry.product.image, `${entry.product.code || entry.card.id}.jpg`);
            }
          })
        );
      }

      if (data.settings) setSettings((prev) => ({ ...prev, ...data.settings }));
      setPageSubtitles(importedSubtitles);
      await reloadCatalog();
      alert(`Projeto carregado! ${addedCount} item(ns) adicionado(s).${skipped > 0 ? ` ${skipped} ja existente(s) foram ignorados.` : ''}`);
    } catch (err) {
      console.error(err);
      alert('Erro ao ler o arquivo de projeto. Verifique se e um JSON valido.');
    }
  }, [catalogId, createSpacerAt, reloadCatalog, uploadCardImageFromDataUrl]);

  const handleCsvImport = useCallback(async (newProducts) => {
    if (!catalogId) throw new Error('Catalogo nao carregado.');
    let offset = 0;
    let skipped = 0;
    const existingCardIds = new Set(
      productsRef.current.filter((item) => item.itemType === 'card').map((item) => item.cardId)
    );
    const basePosition = productsRef.current.length;

    for (const product of newProducts) {
      const payload = {
        refCode: String(product.code),
        title: product.name || product.code,
        description: product.description || '',
        tags: product.tags || '',
        dimensions: product.dimensions || '',
        weight: product.weight || '',
        boxQty: product.boxQty || '',
        price: product.price || '',
      };
      const card = await getOrCreateCardByRef(payload);
      if (existingCardIds.has(card.id)) { skipped += 1; continue; }
      existingCardIds.add(card.id);
      await apiFetch(`/catalogs/${catalogId}/cards`, {
        method: 'POST',
        body: { cardId: card.id, position: basePosition + offset },
      });
      offset += 1;
    }
    await reloadCatalog();
    if (skipped > 0) alert(`${skipped} card(s) ja estavam no catalogo e foram ignorados.`);
  }, [catalogId, getOrCreateCardByRef, reloadCatalog]);

  const openProject = useCallback(async (projectId) => {
    setCatalogId(projectId);
    localStorage.setItem('bwb_catalog_id', projectId);
    const payload = await apiFetch(`/catalogs/${projectId}`);
    setProducts((payload.items || []).map(mapItemToProduct));
  }, []);

  return {
    products,
    setProducts,
    catalogId,
    isCatalogLoading,
    catalogError,
    settings,
    setSettings,
    pageSubtitles,
    setPageSubtitles,
    productsRef,

    reloadCatalog,
    persistCatalogOrder,
    addProduct,
    insertProductAt,
    insertSpacerAt,
    insertProductAfter,
    insertProductBefore,
    updateProduct,
    deleteItem,
    bulkDeleteItems,
    clearAll,
    updateSpacerSize,
    validateAndSaveRefCode,
    convertItemToSpacer,
    uploadCardImage,
    uploadCardImageFromDataUrl,
    handleExportProject,
    handleImportProject,
    handleCsvImport,
    handlePageSubtitleChange,
    openProject,
    scheduleCardUpdate,
  };
}
