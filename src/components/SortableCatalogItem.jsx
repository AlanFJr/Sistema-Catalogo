import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ProductCard from './ProductCard';
import SpacerCard from './SpacerCard';

const SortableCatalogItem = React.memo(({
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
  isGenerating,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
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
});

SortableCatalogItem.displayName = 'SortableCatalogItem';
export default SortableCatalogItem;
