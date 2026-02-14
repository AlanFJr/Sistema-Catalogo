import express from 'express';
import cors from 'cors';
import multer from 'multer';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import imageSize from 'image-size';

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

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5175')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
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
  max: Number(process.env.UPLOAD_RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de uploads atingido. Tente novamente depois.' }
});

app.use(helmet());
app.use(cors(corsOptions));
app.use('/api', apiLimiter);
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.use('/uploads', express.static(uploadsDir, { fallthrough: false, maxAge: '1h' }));

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

app.post('/api/catalogs', async (req, res) => {
  const name = String(req.body?.name || 'Catalogo Atual');
  const description = req.body?.description ? String(req.body.description) : null;
  const status = req.body?.status ? String(req.body.status) : 'in_progress';
  const catalog = await prisma.catalog.create({ data: { name, description, status } });
  res.json({ catalog });
});

app.get('/api/catalogs/:id', async (req, res) => {
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
});

app.post('/api/catalogs/:id/cards', async (req, res) => {
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
});

app.delete('/api/catalogs/:id/cards/:cardId', async (req, res) => {
  const { id, cardId } = req.params;
  const item = await prisma.catalogItem.findFirst({
    where: { catalogId: id, cardId, itemType: 'card' },
    orderBy: { createdAt: 'asc' }
  });
  if (item) {
    await prisma.catalogItem.delete({ where: { id: item.id } });
  }
  res.json({ ok: true });
});

app.put('/api/catalogs/:id/cards/order', async (req, res) => {
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
});

app.put('/api/catalogs/:id/items/reorder', async (req, res) => {
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
});

app.post('/api/catalogs/:id/spacers', async (req, res) => {
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
});

app.put('/api/catalogs/:id/spacers/:spacerId', async (req, res) => {
  const { id, spacerId } = req.params;
  const { spacerConfig } = req.body || {};
  await prisma.catalogItem.updateMany({
    where: { id: spacerId, catalogId: id },
    data: { spacerConfig: JSON.stringify(spacerConfig || { size: 'md' }) }
  });
  const spacer = await prisma.catalogItem.findUnique({ where: { id: spacerId } });
  res.json({ spacer: spacer ? mapCatalogItemResponse(spacer) : null });
});

app.delete('/api/catalogs/:id/spacers/:spacerId', async (req, res) => {
  const { id, spacerId } = req.params;
  await prisma.catalogItem.deleteMany({ where: { id: spacerId, catalogId: id } });
  res.json({ ok: true });
});

app.delete('/api/catalogs/:id/items/:itemId', async (req, res) => {
  const { id, itemId } = req.params;
  await prisma.catalogItem.deleteMany({ where: { id: itemId, catalogId: id } });
  res.json({ ok: true });
});

app.get('/api/projects', async (req, res) => {
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
});

app.post('/api/projects', async (req, res) => {
  const name = String(req.body?.name || 'Novo Projeto');
  const description = req.body?.description ? String(req.body.description) : null;
  const status = req.body?.status ? String(req.body.status) : 'in_progress';
  const project = await prisma.catalog.create({ data: { name, description, status } });
  res.json({ project });
});

app.get('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  const project = await prisma.catalog.findUnique({ where: { id } });
  if (!project) {
    res.status(404).json({ error: 'Projeto nao encontrado.' });
    return;
  }
  res.json({ project });
});

app.put('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  const data = {};
  if (req.body?.name) data.name = String(req.body.name);
  if (req.body?.description !== undefined) data.description = req.body.description ? String(req.body.description) : null;
  if (req.body?.status) data.status = String(req.body.status);
  const project = await prisma.catalog.update({ where: { id }, data });
  res.json({ project });
});

app.post('/api/projects/:id/archive', async (req, res) => {
  const { id } = req.params;
  const project = await prisma.catalog.update({
    where: { id },
    data: { status: 'archived' }
  });
  res.json({ project });
});

app.post('/api/cards', async (req, res) => {
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
});

app.delete('/api/cards/tmp', async (_req, res) => {
  const result = await prisma.card.deleteMany({
    where: { refCode: { startsWith: 'TMP-' } }
  });
  res.json({ deleted: result.count });
});

app.put('/api/cards/:id', async (req, res) => {
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
});

app.delete('/api/cards/:id', async (req, res) => {
  const { id } = req.params;
  await prisma.card.delete({ where: { id } });
  res.json({ ok: true });
});

app.get('/api/cards/by-ref/:refCode', async (req, res) => {
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
});

app.get('/api/cards/search', async (req, res) => {
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
});

app.post('/api/cards/:id/images', uploadLimiter, upload.single('image'), async (req, res) => {
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
});

app.get('/api/cards/:id/images', async (req, res) => {
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
});

app.use((err, _req, res, _next) => {
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
  console.log(`API pronta em http://0.0.0.0:${PORT}`);
});
