export const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
};

export const hashString = (value) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
};

export const buildAnchorId = (subtitle, index) => `dest-${index}-${hashString(subtitle)}`;

export const normalizePageSubtitles = (value) => {
  if (!value || typeof value !== 'object') return {};
  return Object.entries(value).reduce((acc, [key, subtitle]) => {
    const pageIndex = Number.parseInt(key, 10);
    if (Number.isNaN(pageIndex) || pageIndex < 0) return acc;
    acc[pageIndex] = subtitle == null ? '' : String(subtitle);
    return acc;
  }, {});
};

export const stripAccents = (value) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const dataUrlToBlob = (dataUrl) => {
  const [meta, base64] = dataUrl.split(',');
  const match = meta.match(/data:(.*);base64/);
  const mime = match ? match[1] : 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { blob: new Blob([bytes], { type: mime }), mime };
};

export const mapCardToProduct = (card) => ({
  id: card.id,
  code: card.refCode,
  name: card.title || '',
  description: card.description || '',
  tags: card.tags || '',
  dimensions: card.dimensions || '',
  weight: card.weight || '',
  boxQty: card.boxQty || '',
  price: card.price || '',
  image: card.imageUrl || null,
});

export const mapItemToProduct = (item) => {
  if (item.itemType === 'spacer') {
    return {
      id: item.id,
      itemType: 'spacer',
      spacerConfig: item.spacerConfig || { size: 'md' },
    };
  }
  const card = item.card || item;
  return {
    ...mapCardToProduct(card),
    id: item.id,
    cardId: card.id,
    itemType: 'card',
  };
};
