import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext, PointerSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, rectSortingStrategy,
} from '@dnd-kit/sortable';

import { ITEMS_PER_PAGE, TOC_ITEMS_PER_PAGE, DEFAULT_COVER_LOGOS } from './constants';
import { buildAnchorId, hashString, normalizePageSubtitles, createId } from './utils/helpers';
import { parseCsvText, getColumnMap } from './utils/csv';

import { useCatalog } from './hooks/useCatalog';
import { useProjects } from './hooks/useProjects';
import { useSearch } from './hooks/useSearch';

import Sidebar from './components/Sidebar';
import CoverPage from './components/CoverPage';
import TocPage from './components/TocPage';
import CatalogPage from './components/CatalogPage';
import ConfirmDialog from './components/ui/ConfirmDialog';
import SearchModal from './components/SearchModal';
import ProjectModal from './components/ProjectModal';
import ProjectsView from './components/ProjectsView';

export default function App() {
  const catalog = useCatalog();
  const projectsHook = useProjects();

  const [activeTab, setActiveTab] = useState('editor');
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [multiSelectedIds, setMultiSelectedIds] = useState(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);
  const [isImageSearchOpen, setIsImageSearchOpen] = useState(false);

  const ctrlSelectionRef = useRef({ active: false, touched: new Set() });
  const printRef = useRef(null);
  const containerRef = useRef(null);
  const imageSearchInputRef = useRef(null);

  const search = useSearch(isImageSearchOpen);

  const {
    products, settings, setSettings, pageSubtitles,
    catalogId, isCatalogLoading, catalogError,
  } = catalog;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // PDF body class
  useEffect(() => {
    if (isGenerating) document.body.classList.add('generating-pdf');
    else document.body.classList.remove('generating-pdf');
    return () => document.body.classList.remove('generating-pdf');
  }, [isGenerating]);

  // Lazy load html2pdf
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.async = true;
    document.body.appendChild(script);
    return () => { if (document.body.contains(script)) document.body.removeChild(script); };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeTab !== 'editor') return;
      if (e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        const tag = e.target?.tagName;
        if (tag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
        e.preventDefault();
        search.resetSearch();
        setIsImageSearchOpen(true);
        return;
      }
      if (e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        const tag = e.target?.tagName;
        if (tag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) && !selectedItemId) return;
        if (isImageSearchOpen || isClearAllOpen || deleteTargetId !== null) return;
        e.preventDefault();
        const selectedItem = selectedItemId ? products.find((item) => item.id === selectedItemId) : null;
        if (selectedItem && selectedItem.itemType === 'card' && String(selectedItem.code || '').startsWith('TMP-')) {
          const index = products.findIndex((item) => item.id === selectedItemId);
          if (index >= 0) catalog.convertItemToSpacer(selectedItemId, index, 'sm');
        }
        return;
      }
      if (e.key === 'Escape' && isImageSearchOpen) setIsImageSearchOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, isImageSearchOpen, isClearAllOpen, deleteTargetId, selectedItemId, products, catalog, search]);

  // Focus search input
  useEffect(() => {
    if (!isImageSearchOpen) return;
    const timer = setTimeout(() => imageSearchInputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isImageSearchOpen]);

  // Load projects on tab switch
  useEffect(() => {
    if (activeTab === 'projects') {
      projectsHook.loadProjects();
      setSelectedItemId(null);
      setMultiSelectedIds(new Set());
    }
  }, [activeTab]);

  // Sync multi selection with products
  useEffect(() => {
    setMultiSelectedIds((prev) => {
      const next = new Set();
      products.forEach((p) => { if (prev.has(p.id)) next.add(p.id); });
      return next;
    });
  }, [products]);

  // Ctrl+click selection listeners
  useEffect(() => {
    const stop = () => { ctrlSelectionRef.current.active = false; ctrlSelectionRef.current.touched = new Set(); };
    const handleKeyUp = (e) => { if (e.key === 'Control') stop(); };
    window.addEventListener('pointerup', stop);
    window.addEventListener('blur', stop);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('blur', stop);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Selection handlers
  const toggleMultiSelection = useCallback((itemId) => {
    setMultiSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  const handleSelectItem = useCallback((itemId, event) => {
    if (event?.ctrlKey) {
      toggleMultiSelection(itemId);
      setSelectedItemId(itemId);
      return;
    }
    setSelectedItemId(itemId);
  }, [toggleMultiSelection]);

  const handleCtrlSelectStart = useCallback((itemId, event) => {
    if (!event.ctrlKey || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    toggleMultiSelection(itemId);
    setSelectedItemId(itemId);
    ctrlSelectionRef.current.active = true;
    ctrlSelectionRef.current.touched = new Set([itemId]);
  }, [toggleMultiSelection]);

  const handleCtrlSelectHover = useCallback((itemId, event) => {
    if (!ctrlSelectionRef.current.active || !event.ctrlKey || (event.buttons & 1) !== 1) return;
    if (ctrlSelectionRef.current.touched.has(itemId)) return;
    ctrlSelectionRef.current.touched.add(itemId);
    toggleMultiSelection(itemId);
    setSelectedItemId(itemId);
  }, [toggleMultiSelection]);

  // Delete handlers
  const requestDeleteProduct = useCallback((itemId) => setDeleteTargetId(itemId), []);

  const confirmDeleteProduct = useCallback(async () => {
    if (deleteTargetId === null) return;
    try {
      await catalog.deleteItem(deleteTargetId);
    } catch (error) {
      alert(error.message || 'Erro ao remover item.');
    } finally {
      setDeleteTargetId(null);
    }
  }, [deleteTargetId, catalog]);

  const confirmBulkDelete = useCallback(async () => {
    if (multiSelectedIds.size === 0) return;
    try {
      await catalog.bulkDeleteItems(Array.from(multiSelectedIds));
      if (selectedItemId && multiSelectedIds.has(selectedItemId)) setSelectedItemId(null);
      setMultiSelectedIds(new Set());
    } catch (error) {
      alert(error.message || 'Erro ao remover itens.');
    } finally {
      setIsBulkDeleteOpen(false);
    }
  }, [multiSelectedIds, catalog, selectedItemId]);

  const confirmClearAll = useCallback(async () => {
    try {
      await catalog.clearAll();
    } catch (error) {
      alert(error.message || 'Erro ao limpar catalogo.');
    } finally {
      setIsClearAllOpen(false);
    }
  }, [catalog]);

  // Cover logo update
  const updateCoverLogo = useCallback((id, changes) => {
    setSettings((prev) => {
      const baseLogos = prev.coverLogos?.length > 0 ? prev.coverLogos : DEFAULT_COVER_LOGOS;
      return { ...prev, coverLogos: baseLogos.map((logo) => (logo.id === id ? { ...logo, ...changes } : logo)) };
    });
  }, [setSettings]);

  // CSV handling
  const handleCsvUploadText = useCallback(async (text) => {
    const rows = parseCsvText(text);
    if (rows.length === 0) { alert('Nenhum produto valido encontrado no CSV.'); return; }

    const headerRow = rows[0].map((cell) => String(cell).trim());
    if (headerRow[0]) headerRow[0] = headerRow[0].replace(/^\uFEFF/, '');
    const columnMap = getColumnMap(headerRow);
    const hasHeader = Object.keys(columnMap).length > 0;
    const dataRows = hasHeader ? rows.slice(1) : rows;

    const newProducts = dataRows
      .map((row) => row.map((cell) => String(cell).trim()))
      .map((cols) => {
        const ci = (key, fb) => columnMap[key] !== undefined ? columnMap[key] : fb;
        return {
          id: createId(),
          code: cols[ci('code', 0)] || '0000',
          name: cols[ci('name', 1)] || 'Produto Importado',
          price: cols[ci('price', 2)] || '0,00',
          dimensions: cols[ci('dimensions', 3)] || '-',
          weight: cols[ci('weight', 4)] || '-',
          boxQty: cols[ci('boxQty', 5)] || '-',
          image: null,
        };
      })
      .filter((p) => p.code !== '0000' || p.name !== 'Produto Importado');

    if (newProducts.length > 0) {
      if (window.confirm(`Adicionar ${newProducts.length} produtos a lista atual?`)) {
        try { await catalog.handleCsvImport(newProducts); }
        catch (error) { alert(error.message || 'Erro ao importar CSV.'); }
      }
    } else {
      alert('Nenhum produto valido encontrado no CSV.');
    }
  }, [catalog]);

  // CSV template download
  const handleDownloadCsvTemplate = useCallback(() => {
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
    URL.revokeObjectURL(url);
  }, []);

  // PDF export
  const handleDownloadPdf = useCallback(async () => {
    if (!window.html2pdf) { alert('Sistema preparando... tente em 5 segundos.'); return; }
    setIsGenerating(true);
    window.scrollTo(0, 0);
    if (containerRef.current) containerRef.current.scrollTop = 0;
    await new Promise((r) => setTimeout(r, 800));

    const element = printRef.current;
    const opt = {
      margin: 0,
      filename: `catalogo-bwb-${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      enableLinks: false,
      html2canvas: {
        scale: 2, useCORS: true, logging: false, scrollY: 0,
        windowWidth: document.documentElement.offsetWidth,
        windowHeight: element.scrollHeight,
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] },
    };

    try {
      const worker = window.html2pdf().set(opt).from(element).toPdf();
      const pdf = await worker.get('pdf');

      const tocEntries = Array.from(element.querySelectorAll('[data-toc-entry]'));
      const tocPagesEls = Array.from(element.querySelectorAll('[data-toc-page-container]'));
      const pageMap = new Map();
      tocPagesEls.forEach((el) => { const idx = el.getAttribute('data-toc-page-container'); if (idx !== null) pageMap.set(idx, el); });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const totalPdfPages = pdf.internal.getNumberOfPages();

      tocEntries.forEach((entryEl) => {
        const tocPageIndex = entryEl.getAttribute('data-toc-page-index');
        const targetPage = Number(entryEl.getAttribute('data-target-page'));
        const pageEl = tocPageIndex !== null ? pageMap.get(tocPageIndex) : null;
        if (!pageEl || !Number.isFinite(targetPage) || targetPage < 1) return;

        const pageRect = pageEl.getBoundingClientRect();
        const entryRect = entryEl.getBoundingClientRect();
        const x = ((entryRect.left - pageRect.left) / pageRect.width) * pdfWidth;
        const y = ((entryRect.top - pageRect.top) / pageRect.height) * pdfHeight;
        const w = (entryRect.width / pageRect.width) * pdfWidth;
        const h = (entryRect.height / pageRect.height) * pdfHeight;

        const tocPdfPage = Math.min(totalPdfPages, Math.max(1, coverPageCount + Number(tocPageIndex) + 1));
        const safeTargetPage = Math.min(totalPdfPages, Math.max(1, Math.round(targetPage)));
        pdf.setPage(tocPdfPage);
        pdf.link(x, y, w, h, { pageNumber: safeTargetPage });
      });

      await worker.save();
    } catch (error) {
      console.error('Erro na exportacao:', error);
      alert('Erro ao gerar arquivo. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  }, []);

  // DnD handler
  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    catalog.setProducts((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id);
      const newIndex = prev.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      catalog.persistCatalogOrder(next).catch(console.error);
      return next;
    });
  }, [catalog]);

  // Open project callback
  const handleOpenProject = useCallback(async (projectId) => {
    await catalog.openProject(projectId);
    setActiveTab('editor');
    setSelectedItemId(null);
    setMultiSelectedIds(new Set());
  }, [catalog]);

  // Memoized computations
  const cardsWithFillers = useMemo(() => {
    const expanded = [];
    products.forEach((item) => {
      expanded.push(item);
      if (item.itemType === 'spacer') {
        const size = item.spacerConfig?.size || 'md';
        const fillerCount = size === 'lg' ? 2 : size === 'sm' ? 0 : 1;
        for (let i = 0; i < fillerCount; i += 1) {
          expanded.push({ id: `__spacer_fill__${item.id}__${i}`, itemType: 'filler', parentSpacerId: item.id });
        }
      }
    });
    return expanded;
  }, [products]);

  const pages = useMemo(() => {
    const grouped = [];
    for (let i = 0; i < cardsWithFillers.length; i += ITEMS_PER_PAGE) {
      grouped.push(cardsWithFillers.slice(i, i + ITEMS_PER_PAGE));
    }
    if (grouped.length === 0) grouped.push([]);
    return grouped;
  }, [cardsWithFillers]);

  const coverPageCount = settings.showCover ? 1 : 0;

  const tocEntries = useMemo(() => {
    const tocMap = new Map();
    pages.forEach((_, pageIndex) => {
      const subtitle = pageSubtitles[pageIndex] !== undefined ? pageSubtitles[pageIndex] : settings.subtitle;
      const trimmed = String(subtitle || '').trim();
      if (!trimmed || tocMap.has(trimmed)) return;
      tocMap.set(trimmed, { text: trimmed, pageIndex, anchorId: buildAnchorId(trimmed, pageIndex) });
    });
    return Array.from(tocMap.values());
  }, [pages, pageSubtitles, settings.subtitle]);

  const tocPages = useMemo(() => {
    const grouped = [];
    for (let i = 0; i < tocEntries.length; i += TOC_ITEMS_PER_PAGE) {
      grouped.push(tocEntries.slice(i, i + TOC_ITEMS_PER_PAGE));
    }
    if (grouped.length === 0) grouped.push([]);
    return grouped;
  }, [tocEntries]);

  const tocPageCount = tocPages.length;

  const tocAnchorsByPage = useMemo(() => {
    const anchors = new Map();
    tocEntries.forEach((entry) => { if (!anchors.has(entry.pageIndex)) anchors.set(entry.pageIndex, entry.anchorId); });
    return anchors;
  }, [tocEntries]);

  const getCatalogInsertIndexForDisplay = useCallback((displayIndex) => {
    let count = 0;
    for (let i = 0; i < displayIndex; i += 1) {
      if (cardsWithFillers[i]?.itemType !== 'filler') count += 1;
    }
    return count;
  }, [cardsWithFillers]);

  const sortableItemIds = useMemo(() => products.map((p) => p.id), [products]);
  const resolvedCoverLogos = useMemo(
    () => settings.coverLogos?.length > 0 ? settings.coverLogos : DEFAULT_COVER_LOGOS,
    [settings.coverLogos]
  );
  const todayDateText = useMemo(() => new Date().toLocaleDateString(), []);

  const productToDelete = useMemo(
    () => products.find((p) => p.id === deleteTargetId),
    [products, deleteTargetId]
  );

  const multiSelectedCount = multiSelectedIds.size;

  // Search modal callbacks
  const handleSearchAddToCatalog = useCallback(() => {
    search.addSelectedCardsToCatalog(catalogId, products, catalog.reloadCatalog, () => setIsImageSearchOpen(false));
  }, [search, catalogId, products, catalog]);

  const handleSearchDeleteTmp = useCallback(() => {
    search.handleDeleteTmpCards(catalog.reloadCatalog);
  }, [search, catalog]);

  const handleSearchDeleteFromDb = useCallback(() => {
    search.handleDeleteSelectedFromDb(catalog.reloadCatalog);
  }, [search, catalog]);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-100 font-sans overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        settings={settings}
        setSettings={setSettings}
        resolvedCoverLogos={resolvedCoverLogos}
        isGenerating={isGenerating}
        multiSelectedCount={multiSelectedCount}
        onAddProduct={catalog.addProduct}
        onExportProject={catalog.handleExportProject}
        onImportProject={catalog.handleImportProject}
        onCsvUpload={handleCsvUploadText}
        onRequestClearAll={() => setIsClearAllOpen(true)}
        onRequestBulkDelete={() => multiSelectedIds.size > 0 && setIsBulkDeleteOpen(true)}
        onClearMultiSelection={() => setMultiSelectedIds(new Set())}
        onDownloadCsvTemplate={handleDownloadCsvTemplate}
        onDownloadPdf={handleDownloadPdf}
        updateCoverLogo={updateCoverLogo}
      />

      <main
        ref={containerRef}
        className={`flex-1 overflow-y-auto bg-gray-200/50 flex flex-col items-center transition-none ${
          isGenerating ? 'p-0' : 'p-3 pb-24 md:p-8 md:pb-32'
        }`}
      >
        {activeTab === 'projects' ? (
          <ProjectsView
            projects={projectsHook.projects}
            projectsLoading={projectsHook.projectsLoading}
            projectsError={projectsHook.projectsError}
            onOpenProject={handleOpenProject}
            onRenameProject={projectsHook.renameProject}
            onArchiveProject={projectsHook.archiveProject}
            onNewProject={() => projectsHook.setIsProjectModalOpen(true)}
          />
        ) : (
          <>
            {(isCatalogLoading || catalogError) && (
              <div className="mb-6 w-full max-w-3xl rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
                {isCatalogLoading ? 'Carregando catalogo...' : `Erro: ${catalogError}`}
              </div>
            )}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={sortableItemIds} strategy={rectSortingStrategy}>
                <div ref={printRef} className="flex flex-col items-center">
                  <CoverPage settings={settings} resolvedCoverLogos={resolvedCoverLogos} isGenerating={isGenerating} />

                  {tocPages.map((entries, tocPageIndex) => (
                    <TocPage
                      key={`toc-${tocPageIndex}`}
                      entries={entries}
                      tocPageIndex={tocPageIndex}
                      coverPageCount={coverPageCount}
                      tocPageCount={tocPageCount}
                      settings={settings}
                      isGenerating={isGenerating}
                    />
                  ))}

                  {pages.map((pageProducts, pageIndex) => (
                    <CatalogPage
                      key={pageIndex}
                      pageProducts={pageProducts}
                      pageIndex={pageIndex}
                      settings={settings}
                      pageSubtitles={pageSubtitles}
                      selectedItemId={selectedItemId}
                      multiSelectedIds={multiSelectedIds}
                      isGenerating={isGenerating}
                      tocAnchorsByPage={tocAnchorsByPage}
                      todayDateText={todayDateText}
                      onSelectItem={handleSelectItem}
                      onToggleMultiSelect={toggleMultiSelection}
                      onValidateRef={catalog.validateAndSaveRefCode}
                      onUpdate={catalog.updateProduct}
                      onDelete={requestDeleteProduct}
                      onInsertAfter={catalog.insertProductAfter}
                      onInsertBefore={catalog.insertProductBefore}
                      onUploadImage={catalog.uploadCardImage}
                      onResizeSpacer={catalog.updateSpacerSize}
                      onCtrlSelectStart={handleCtrlSelectStart}
                      onCtrlSelectHover={handleCtrlSelectHover}
                      onPageSubtitleChange={catalog.handlePageSubtitleChange}
                      onInsertProductAt={catalog.insertProductAt}
                      onInsertSpacerAt={catalog.insertSpacerAt}
                      getCatalogInsertIndexForDisplay={getCatalogInsertIndexForDisplay}
                      onSettingsChange={setSettings}
                    />
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
              : `Deseja remover "${productToDelete.name}" do catalogo?`
            : 'Deseja remover este item do catalogo?'
        }
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={confirmDeleteProduct}
      />

      <ConfirmDialog
        isOpen={isClearAllOpen}
        title="Limpar catalogo"
        description="Deseja remover todos os produtos do catalogo atual?"
        onCancel={() => setIsClearAllOpen(false)}
        onConfirm={confirmClearAll}
      />

      <ConfirmDialog
        isOpen={isBulkDeleteOpen}
        title="Excluir selecionados"
        description={`Deseja remover ${multiSelectedCount} item(ns) selecionado(s) do catalogo?`}
        onCancel={() => setIsBulkDeleteOpen(false)}
        onConfirm={confirmBulkDelete}
      />

      <SearchModal
        isOpen={isImageSearchOpen}
        onClose={() => setIsImageSearchOpen(false)}
        searchQuery={search.searchQuery}
        setSearchQuery={search.setSearchQuery}
        searchResults={search.searchResults}
        searchSelected={search.searchSelected}
        searchLoading={search.searchLoading}
        searchError={search.searchError}
        toggleSearchSelection={search.toggleSearchSelection}
        toggleSelectAllSearch={search.toggleSelectAllSearch}
        addSelectedCardsToCatalog={handleSearchAddToCatalog}
        handleDeleteTmpCards={handleSearchDeleteTmp}
        handleDeleteSelectedFromDb={handleSearchDeleteFromDb}
        inputRef={imageSearchInputRef}
      />

      <ProjectModal
        isOpen={projectsHook.isProjectModalOpen}
        onClose={() => projectsHook.setIsProjectModalOpen(false)}
        name={projectsHook.newProjectName}
        setName={projectsHook.setNewProjectName}
        description={projectsHook.newProjectDescription}
        setDescription={projectsHook.setNewProjectDescription}
        onCreate={() => projectsHook.createProject(handleOpenProject)}
      />
    </div>
  );
}
