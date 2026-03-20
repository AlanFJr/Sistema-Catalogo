import express from 'express';
import cors from 'cors';
import compression from 'compression';
import multer from 'multer';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import imageSize from 'image-size';

// Async route wrapper - catches errors and forwards to error handler
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const uploadsDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const prisma = new PrismaClient();
const app = express();
app.disable('x-powered-by');

const parseBooleanEnv = (value, fallback) => {
  if (typeof value !== 'string') return fallback;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return fallback;
};

const enableApiRateLimit = parseBooleanEnv(
  process.env.ENABLE_API_RATE_LIMIT,
  process.env.NODE_ENV === 'production'
);

const enableUploadRateLimit = parseBooleanEnv(
  process.env.ENABLE_UPLOAD_RATE_LIMIT,
  process.env.NODE_ENV === 'production'
);

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5175,http://127.0.0.1:5173,http://127.0.0.1:5175')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const normalizeHost = (host) => {
  if (host === 'localhost') return 'local';
  if (host === '127.0.0.1') return 'local';
  return host;
};

const isAllowedOrigin = (origin) => {
  if (allowedOrigins.includes(origin)) return true;

  try {
    const requestUrl = new URL(origin);
    // Allow any request from private/local network IPs
    const host = requestUrl.hostname;
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return true;
    }
    return allowedOrigins.some((allowedOrigin) => {
      try {
        const allowedUrl = new URL(allowedOrigin);
        return (
          allowedUrl.protocol === requestUrl.protocol
          && normalizeHost(allowedUrl.hostname) === normalizeHost(requestUrl.hostname)
          && allowedUrl.port === requestUrl.port
        );
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
};

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('CORS_NOT_ALLOWED'));
  },
  credentials: true
};

const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX || 200),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisicoes. Tente novamente em instantes.' }
});

const uploadLimiter = rateLimit({
  windowMs: Number(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.UPLOAD_RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de uploads atingido. Tente novamente depois.' }
});

const uploadLimiterMiddleware = enableUploadRateLimit
  ? uploadLimiter
  : (_req, _res, next) => next();

app.use(helmet());
app.use(compression({ level: 6, threshold: 1024 }));
app.use(cors(corsOptions));
if (enableApiRateLimit) {
  app.use('/api', apiLimiter);
}
app.use(express.json({ limit: '2mb' }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

app.use('/uploads', express.static(uploadsDir, { fallthrough: false, maxAge: '7d', immutable: true }));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = path.basename(file.originalname || 'upload', ext);
    const safeBase = base.replace(/[^a-z0-9\-_]+/gi, '-').slice(0, 60);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${safeBase || 'image'}-${unique}${ext || '.jpg'}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExts = new Set(['.jpg', '.jpeg', '.png', '.webp']);

    if (!allowedMimes.has(file.mimetype) || !allowedExts.has(ext)) {
      cb(new Error('INVALID_FILE_TYPE'));
      return;
    }
    cb(null, true);
  }
});

const buildImageUrl = (filePath) => `/uploads/${path.basename(filePath)}`;

const mapCardResponse = (card) => ({
  id: card.id,
  refCode: card.refCode,
  title: card.title,
  description: card.description,
  tags: card.tags,
  dimensions: card.dimensions,
  weight: card.weight,
  boxQty: card.boxQty,
  price: card.price,
  createdAt: card.createdAt,
  updatedAt: card.updatedAt,
  imageUrl: card.images?.[0] ? buildImageUrl(card.images[0].filePath) : null
});

const parseSpacerConfig = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn('Config de espaco invalida.', error);
    return null;
  }
};

const mapCatalogItemResponse = (item) => {
  if (item.itemType === 'spacer') {
    return {
      id: item.id,
      itemType: 'spacer',
      position: item.position,
      spacerConfig: parseSpacerConfig(item.spacerConfig) || { size: 'md' }
    };
  }
  return {
    id: item.id,
    itemType: 'card',
    position: item.position,
    card: item.card ? mapCardResponse(item.card) : null
  };
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/catalogs', asyncHandler(async (req, res) => {
  const name = String(req.body?.name || 'Catalogo Atual');
  const description = req.body?.description ? String(req.body.description) : null;
  const status = req.body?.status ? String(req.body.status) : 'in_progress';
  const catalog = await prisma.catalog.create({ data: { name, description, status } });
  res.json({ catalog });
}));

app.get('/api/catalogs/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const catalog = await prisma.catalog.findUnique({
    where: { id },
    include: {
      catalogItems: {
        orderBy: { position: 'asc' },
        include: {
          card: {
            include: {
              images: { orderBy: { createdAt: 'desc' }, take: 1 }
            }
          }
        }
      }
    }
  });

  if (!catalog) {
    res.status(404).json({ error: 'Catalogo nao encontrado.' });
    return;
  }

  const items = catalog.catalogItems.map(mapCatalogItemResponse);

  res.json({
    catalog: {
      id: catalog.id,
      name: catalog.name,
      description: catalog.description,
      status: catalog.status,
      createdAt: catalog.createdAt,
      updatedAt: catalog.updatedAt
    },
    items
  });
}));

app.post('/api/catalogs/:id/cards', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { cardId, position } = req.body || {};

  if (!cardId) {
    res.status(400).json({ error: 'cardId e obrigatorio.' });
    return;
  }

  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) {
    res.status(404).json({ error: 'Card nao encontrado.' });
    return;
  }

  const existingItem = await prisma.catalogItem.findFirst({
    where: { catalogId: id, cardId, itemType: 'card' }
  });
  if (existingItem) {
    res.status(409).json({ error: 'Card ja existe no catalogo.' });
    return;
  }

  const count = await prisma.catalogItem.count({ where: { catalogId: id } });
  const newPosition = typeof position === 'number' ? position : count;

  const catalogItem = await prisma.catalogItem.create({
    data: {
      catalogId: id,
      cardId,
      itemType: 'card',
      position: newPosition
    },
    include: {
      card: {
        include: { images: { orderBy: { createdAt: 'desc' }, take: 1 } }
      }
    }
  });

  res.json({ catalogItem: mapCatalogItemResponse(catalogItem) });
}));

app.delete('/api/catalogs/:id/cards/:cardId', asyncHandler(async (req, res) => {
  const { id, cardId } = req.params;
  const item = await prisma.catalogItem.findFirst({
    where: { catalogId: id, cardId, itemType: 'card' },
    orderBy: { createdAt: 'asc' }
  });
  if (item) {
    await prisma.catalogItem.delete({ where: { id: item.id } });
  }
  res.json({ ok: true });
}));

app.put('/api/catalogs/:id/cards/order', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds : [];
  if (itemIds.length === 0) {
    res.json({ ok: true });
    return;
  }
  await prisma.$transaction(
    itemIds.map((itemId, index) =>
      prisma.catalogItem.update({
        where: { id: itemId },
        data: { position: index }
      })
    )
  );
  res.json({ ok: true });
}));

app.put('/api/catalogs/:id/items/reorder', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds : [];
  await prisma.$transaction(
    itemIds.map((itemId, index) =>
      prisma.catalogItem.updateMany({
        where: { id: itemId, catalogId: id },
        data: { position: index }
      })
    )
  );
  res.json({ ok: true });
}));

app.post('/api/catalogs/:id/spacers', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { position, spacerConfig } = req.body || {};
  const count = await prisma.catalogItem.count({ where: { catalogId: id } });
  const newPosition = typeof position === 'number' ? position : count;
  const spacer = await prisma.catalogItem.create({
    data: {
      catalogId: id,
      itemType: 'spacer',
      spacerConfig: JSON.stringify(spacerConfig || { size: 'md' }),
      position: newPosition
    }
  });
  res.json({ spacer: mapCatalogItemResponse(spacer) });
}));

app.put('/api/catalogs/:id/spacers/:spacerId', asyncHandler(async (req, res) => {
  const { id, spacerId } = req.params;
  const { spacerConfig } = req.body || {};
  await prisma.catalogItem.updateMany({
    where: { id: spacerId, catalogId: id },
    data: { spacerConfig: JSON.stringify(spacerConfig || { size: 'md' }) }
  });
  const spacer = await prisma.catalogItem.findUnique({ where: { id: spacerId } });
  res.json({ spacer: spacer ? mapCatalogItemResponse(spacer) : null });
}));

app.delete('/api/catalogs/:id/spacers/:spacerId', asyncHandler(async (req, res) => {
  const { id, spacerId } = req.params;
  await prisma.catalogItem.deleteMany({ where: { id: spacerId, catalogId: id } });
  res.json({ ok: true });
}));

app.delete('/api/catalogs/:id/items/:itemId', asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  await prisma.catalogItem.deleteMany({ where: { id: itemId, catalogId: id } });
  res.json({ ok: true });
}));

app.get('/api/projects', asyncHandler(async (req, res) => {
  const status = req.query.status ? String(req.query.status) : null;
  const projects = await prisma.catalog.findMany({
    where: status ? { status } : {},
    include: {
      catalogItems: {
        where: { itemType: 'card' }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });
  res.json({
    projects: projects.map((project) => ({
      ...project,
      cardCount: project.catalogItems.length
    }))
  });
}));

app.post('/api/projects', asyncHandler(async (req, res) => {
  const name = String(req.body?.name || 'Novo Projeto');
  const description = req.body?.description ? String(req.body.description) : null;
  const status = req.body?.status ? String(req.body.status) : 'in_progress';
  const project = await prisma.catalog.create({ data: { name, description, status } });
  res.json({ project });
}));

app.get('/api/projects/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const project = await prisma.catalog.findUnique({ where: { id } });
  if (!project) {
    res.status(404).json({ error: 'Projeto nao encontrado.' });
    return;
  }
  res.json({ project });
}));

app.put('/api/projects/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = {};
  if (req.body?.name) data.name = String(req.body.name);
  if (req.body?.description !== undefined) data.description = req.body.description ? String(req.body.description) : null;
  if (req.body?.status) data.status = String(req.body.status);
  const project = await prisma.catalog.update({ where: { id }, data });
  res.json({ project });
}));

app.post('/api/projects/:id/archive', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const project = await prisma.catalog.update({
    where: { id },
    data: { status: 'archived' }
  });
  res.json({ project });
}));

app.post('/api/cards', asyncHandler(async (req, res) => {
  const {
    refCode,
    title,
    description,
    tags,
    dimensions,
    weight,
    boxQty,
    price
  } = req.body || {};

  if (!refCode) {
    res.status(400).json({ error: 'refCode e obrigatorio.' });
    return;
  }

  try {
    const card = await prisma.card.create({
      data: {
        refCode,
        title: title || refCode,
        description: description || null,
        tags: tags || null,
        dimensions: dimensions || null,
        weight: weight || null,
        boxQty: boxQty || null,
        price: price || null
      },
      include: { images: { orderBy: { createdAt: 'desc' }, take: 1 } }
    });

    res.json({ card: mapCardResponse(card) });
  } catch (error) {
    if (error?.code === 'P2002') {
      res.status(409).json({ error: 'Cód ref ja existe.' });
      return;
    }
    throw error;
  }
}));

app.delete('/api/cards/tmp', asyncHandler(async (_req, res) => {
  const result = await prisma.card.deleteMany({
    where: { refCode: { startsWith: 'TMP-' } }
  });
  res.json({ deleted: result.count });
}));

app.put('/api/cards/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = { ...req.body };

  if (data.refCode) {
    const existing = await prisma.card.findUnique({ where: { refCode: data.refCode } });
    if (existing && existing.id !== id) {
      res.status(409).json({ error: 'Cód ref ja existe.' });
      return;
    }
  }

  const card = await prisma.card.update({
    where: { id },
    data,
    include: { images: { orderBy: { createdAt: 'desc' }, take: 1 } }
  });

  res.json({ card: mapCardResponse(card) });
}));

app.delete('/api/cards/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.card.delete({ where: { id } });
  res.json({ ok: true });
}));

app.get('/api/cards/by-ref/:refCode', asyncHandler(async (req, res) => {
  const { refCode } = req.params;
  const card = await prisma.card.findUnique({
    where: { refCode },
    include: { images: { orderBy: { createdAt: 'desc' }, take: 1 } }
  });
  if (!card) {
    res.status(404).json({ error: 'Card nao encontrado.' });
    return;
  }
  res.json({ card: mapCardResponse(card) });
}));

app.get('/api/cards/search', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    res.json({ cards: [] });
    return;
  }

  const cards = await prisma.card.findMany({
    where: {
      deletedAt: null,
      OR: [
        { refCode: { contains: q } },
        { title: { contains: q } },
        { description: { contains: q } },
        { tags: { contains: q } }
      ]
    },
    include: { images: { orderBy: { createdAt: 'desc' }, take: 1 } },
    take: 50
  });

  res.json({ cards: cards.map(mapCardResponse) });
}));

// Bulk lookup: receive array of refCodes, return map of existing cards
app.post('/api/cards/bulk-lookup', asyncHandler(async (req, res) => {
  const refCodes = Array.isArray(req.body?.refCodes) ? req.body.refCodes : [];
  if (refCodes.length === 0) {
    res.json({ cards: {} });
    return;
  }
  // SQLite is case-sensitive by default, so we query all and map
  const cards = await prisma.card.findMany({
    where: { refCode: { in: refCodes } },
    include: { images: { orderBy: { createdAt: 'desc' }, take: 1 } }
  });
  const cardMap = {};
  for (const card of cards) {
    cardMap[card.refCode] = mapCardResponse(card);
  }
  res.json({ cards: cardMap });
}));

// Bulk create: receive array of card payloads, create only those not in DB
app.post('/api/cards/bulk-create', asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) {
    res.json({ cards: {} });
    return;
  }
  const refCodes = items.map((i) => i.refCode).filter(Boolean);
  const existing = await prisma.card.findMany({
    where: { refCode: { in: refCodes } },
    include: { images: { orderBy: { createdAt: 'desc' }, take: 1 } }
  });
  const existingMap = {};
  for (const card of existing) {
    existingMap[card.refCode] = card;
  }
  const results = {};
  for (const item of items) {
    if (!item.refCode) continue;
    if (existingMap[item.refCode]) {
      results[item.refCode] = mapCardResponse(existingMap[item.refCode]);
      continue;
    }
    try {
      const card = await prisma.card.create({
        data: {
          refCode: item.refCode,
          title: item.title || item.refCode,
          description: item.description || null,
          tags: item.tags || null,
          dimensions: item.dimensions || null,
          weight: item.weight || null,
          boxQty: item.boxQty || null,
          price: item.price || null
        },
        include: { images: { orderBy: { createdAt: 'desc' }, take: 1 } }
      });
      results[item.refCode] = mapCardResponse(card);
    } catch (error) {
      if (error?.code === 'P2002') {
        // race condition: another request created it, fetch it
        const found = await prisma.card.findUnique({
          where: { refCode: item.refCode },
          include: { images: { orderBy: { createdAt: 'desc' }, take: 1 } }
        });
        if (found) results[item.refCode] = mapCardResponse(found);
      }
    }
  }
  res.json({ cards: results });
}));

app.post('/api/cards/:id/images', uploadLimiterMiddleware, upload.single('image'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: 'Arquivo de imagem obrigatorio.' });
    return;
  }

  let width = null;
  let height = null;
  try {
    const dimensions = imageSize(file.path);
    width = dimensions.width || null;
    height = dimensions.height || null;
  } catch (error) {
    console.warn('Falha ao ler dimensoes da imagem.', error);
  }

  const image = await prisma.image.create({
    data: {
      cardId: id,
      filePath: file.path,
      mimeType: file.mimetype,
      width,
      height
    }
  });

  res.json({
    image: {
      id: image.id,
      url: buildImageUrl(image.filePath),
      mimeType: image.mimeType,
      width: image.width,
      height: image.height
    }
  });
}));

app.get('/api/cards/:id/images', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const images = await prisma.image.findMany({
    where: { cardId: id },
    orderBy: { createdAt: 'desc' }
  });

  res.json({
    images: images.map((image) => ({
      id: image.id,
      url: buildImageUrl(image.filePath),
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
      createdAt: image.createdAt
    }))
  });
}));

// Speech/Discourse generation endpoints
app.post('/api/catalogs/:id/speech/generate', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { templateType = 'sales_pitch', title } = req.body || {};

  const catalog = await prisma.catalog.findUnique({
    where: { id },
    include: {
      catalogItems: {
        where: { itemType: 'card' },
        orderBy: { position: 'asc' },
        include: {
          card: {
            include: {
              images: { orderBy: { createdAt: 'desc' }, take: 1 }
            }
          }
        }
      }
    }
  });

  if (!catalog) {
    res.status(404).json({ error: 'Catalogo nao encontrado.' });
    return;
  }

  const cards = catalog.catalogItems
    .filter((item) => item.card)
    .map((item) => item.card);

  // Generate speech content based on template type
  let content = '';
  const speechTitle = title || `Apresentacao: ${catalog.name}`;

  if (templateType === 'sales_pitch') {
    content = generateSalesPitchSpeech(catalog, cards);
  } else if (templateType === 'product_overview') {
    content = generateProductOverviewSpeech(catalog, cards);
  } else if (templateType === 'executive_summary') {
    content = generateExecutiveSummarySpeech(catalog, cards);
  } else {
    content = generateSalesPitchSpeech(catalog, cards);
  }

  const speech = await prisma.speech.create({
    data: {
      catalogId: id,
      title: speechTitle,
      content,
      templateType
    }
  });

  res.json({ speech });
}));

app.get('/api/catalogs/:id/speeches', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const speeches = await prisma.speech.findMany({
    where: { catalogId: id },
    orderBy: { createdAt: 'desc' }
  });
  res.json({ speeches });
}));

app.get('/api/speeches/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const speech = await prisma.speech.findUnique({ where: { id } });
  if (!speech) {
    res.status(404).json({ error: 'Discurso nao encontrado.' });
    return;
  }
  res.json({ speech });
}));

app.put('/api/speeches/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = {};
  if (req.body?.title) data.title = String(req.body.title);
  if (req.body?.content) data.content = String(req.body.content);
  if (req.body?.templateType) data.templateType = String(req.body.templateType);

  const speech = await prisma.speech.update({ where: { id }, data });
  res.json({ speech });
}));

app.delete('/api/speeches/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.speech.delete({ where: { id } });
  res.json({ success: true });
}));

// Speech generation helper functions
function generateSalesPitchSpeech(catalog, cards) {
  const productCount = cards.length;
  const categories = [...new Set(cards.map(c => c.tags).filter(Boolean).flatMap(t => t.split(',')))];

  let speech = `# ${catalog.name}\n\n`;
  if (catalog.description) {
    speech += `${catalog.description}\n\n`;
  }

  speech += `## Introducao\n\n`;
  speech += `Boa tarde a todos! E com grande satisfacao que apresento nosso catalogo "${catalog.name}". `;
  speech += `Hoje vou compartilhar com voces ${productCount} produtos excepcionais que preparamos especialmente para atender as necessidades do seu negocio.\n\n`;

  if (categories.length > 0) {
    speech += `Nosso catalogo abrange diversas categorias, incluindo: ${categories.slice(0, 5).join(', ')}`;
    if (categories.length > 5) speech += ` e muito mais`;
    speech += `.\n\n`;
  }

  speech += `## Destaques dos Produtos\n\n`;

  const featuredProducts = cards.slice(0, 5);
  featuredProducts.forEach((card, idx) => {
    speech += `### ${idx + 1}. ${card.title || card.refCode}\n\n`;
    speech += `**Codigo:** ${card.refCode}\n\n`;
    if (card.description) {
      speech += `${card.description}\n\n`;
    }
    if (card.dimensions) {
      speech += `**Dimensoes:** ${card.dimensions}\n`;
    }
    if (card.weight) {
      speech += `**Peso:** ${card.weight}\n`;
    }
    if (card.boxQty) {
      speech += `**Quantidade por caixa:** ${card.boxQty}\n`;
    }
    if (card.price) {
      speech += `**Preco:** ${card.price}\n`;
    }
    speech += `\n`;
  });

  if (productCount > 5) {
    speech += `E temos mais ${productCount - 5} produtos adicionais em nosso catalogo completo!\n\n`;
  }

  speech += `## Conclusao\n\n`;
  speech += `Estes sao apenas alguns dos destaques do nosso catalogo. Cada produto foi cuidadosamente selecionado `;
  speech += `para oferecer a melhor qualidade e valor para nossos clientes.\n\n`;
  speech += `Estou a disposicao para responder quaisquer perguntas e fornecer informacoes adicionais sobre `;
  speech += `qualquer um dos nossos produtos. Obrigado pela atencao!\n`;

  return speech;
}

function generateProductOverviewSpeech(catalog, cards) {
  let speech = `# Visao Geral: ${catalog.name}\n\n`;

  speech += `## Sumario Executivo\n\n`;
  speech += `Este catalogo apresenta ${cards.length} produtos, organizados para facilitar sua consulta.\n\n`;

  speech += `## Lista Completa de Produtos\n\n`;
  cards.forEach((card, idx) => {
    speech += `${idx + 1}. **${card.title || card.refCode}** (Ref: ${card.refCode})\n`;
    if (card.description) {
      speech += `   - ${card.description}\n`;
    }
    if (card.price) {
      speech += `   - Preco: ${card.price}\n`;
    }
  });

  return speech;
}

function generateExecutiveSummarySpeech(catalog, cards) {
  const productCount = cards.length;
  const withPrice = cards.filter(c => c.price).length;
  const withImages = cards.filter(c => c.images && c.images.length > 0).length;

  let speech = `# Resumo Executivo: ${catalog.name}\n\n`;

  if (catalog.description) {
    speech += `${catalog.description}\n\n`;
  }

  speech += `## Metricas do Catalogo\n\n`;
  speech += `- Total de produtos: ${productCount}\n`;
  speech += `- Produtos com preco: ${withPrice}\n`;
  speech += `- Produtos com imagens: ${withImages}\n`;
  speech += `- Taxa de completude: ${Math.round((withPrice / productCount) * 100)}%\n\n`;

  speech += `## Principais Produtos\n\n`;
  const top5 = cards.slice(0, 5);
  top5.forEach((card) => {
    speech += `- **${card.title || card.refCode}**`;
    if (card.price) speech += ` - ${card.price}`;
    speech += `\n`;
  });

  speech += `\n## Proximos Passos\n\n`;
  speech += `1. Revisar todos os produtos no catalogo completo\n`;
  speech += `2. Identificar oportunidades de vendas\n`;
  speech += `3. Preparar propostas personalizadas para clientes\n`;

  return speech;
}

app.use((err, _req, res, _next) => {
  if (err?.status) {
    res.status(err.status).json({ error: err.message || 'Erro ao processar requisicao.' });
    return;
  }
  if (err?.message === 'CORS_NOT_ALLOWED') {
    res.status(403).json({ error: 'Origem nao permitida.' });
    return;
  }
  if (err?.message === 'INVALID_FILE_TYPE') {
    res.status(400).json({ error: 'Tipo de arquivo invalido.' });
    return;
  }
  if (err?.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ error: 'Arquivo muito grande.' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Erro interno no servidor.' });
});

const distPath = path.join(ROOT_DIR, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      res.status(404).json({ error: 'Rota nao encontrada.' });
      return;
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 5176;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  API pronta!\n`);
  console.log(`  Local:   http://localhost:${PORT}`);
  // Show all LAN addresses
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  Rede:    http://${net.address}:${PORT}`);
      }
    }
  }
  console.log();
});
