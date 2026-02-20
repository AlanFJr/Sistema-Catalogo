# 📘 Sistema Catálogo — Gerador de Catálogos Profissionais em PDF

<p align="center">
  <img src="https://img.shields.io/badge/React-18.2-61DAFB?logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-7.3-646CFF?logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-4.19-000000?logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/Prisma-5.22-2D3748?logo=prisma&logoColor=white" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-Database-003B57?logo=sqlite&logoColor=white" />
</p>

> Aplicação fullstack para criação, organização e exportação de catálogos de produtos em PDF — com gerenciamento de projetos, drag-and-drop, busca inteligente e importação em lote.

---

## ✨ Funcionalidades

### 📄 Geração de Catálogo em PDF
- Exportação de catálogos completos com **capa personalizada**, **sumário com links internos** e **páginas de produtos em grid 3×3**
- Personalização de **cores**, **bordas**, **logos** e **tipografia** da capa
- Subtítulos por página para organização por categorias

### 🗂️ Gerenciamento de Projetos
- Criação de **múltiplos projetos/catálogos** independentes
- Renomear, arquivar e alternar entre projetos
- Cada projeto mantém seus próprios produtos e configurações

### 🃏 Cards de Produtos
- Campos editáveis: código de referência, nome, descrição, tags, dimensões, peso, quantidade por caixa e preço
- Upload de imagens via **clique**, **arrastar e soltar (drag & drop)** ou **colar (Ctrl+V)**
- Validação de códigos de referência duplicados em tempo real
- Controle de visibilidade de campos individuais (ocultar/exibir preço, peso, etc.)

### 🔀 Organização com Drag & Drop
- Reordenação de cards por **arraste** com `@dnd-kit`
- Inserção de **espaçadores** (P / M / G) para controlar o layout das páginas
- Inserção rápida de cards antes/depois de qualquer posição
- Seleção múltipla com **Ctrl+Click** para ações em lote

### 🔍 Busca e Reutilização
- Busca integrada no banco de dados por código, nome, descrição ou tags
- Seleção múltipla de resultados e adição em lote ao catálogo
- Reutilização de cards entre diferentes projetos

### 📥 Importação e Exportação
- **Exportar projeto** como arquivo JSON (backup completo com imagens em base64)
- **Importar projeto** com merge inteligente — compara com o banco de dados e adiciona apenas produtos novos
- **Importação CSV** com mapeamento automático de colunas (suporte a aliases em português)
- Importação em lote otimizada com **bulk API** (uma única requisição para centenas de produtos)

### ⚡ Performance
- Arquitetura modular com **React.memo**, **useCallback** e **useMemo** em todos os componentes
- Carregamento lazy de imagens (`loading="lazy" decoding="async"`)
- Backend com **compressão gzip**, cache de 7 dias para assets estáticos
- Code splitting via Vite: bundles separados para vendor, dnd-kit e ícones
- Fontes com `preconnect` para carregamento otimizado

### 🔒 Segurança
- Headers de segurança via `helmet`
- Rate limiting configurável para API e uploads
- CORS restrito com whitelist de origens
- Validação de tipo de arquivo no upload (apenas jpg, png, webp)
- Tratamento centralizado de erros com `asyncHandler`

---

## 🏗️ Arquitetura

```
Sistema Catalogo/
├── backend/
│   ├── server.js              # API Express com 20+ endpoints RESTful
│   ├── uploads/               # Armazenamento de imagens
│   └── prisma/
│       └── schema.prisma      # Modelos: Catalog, Card, Image, CatalogItem
├── src/
│   ├── App.jsx                # Orquestrador principal (~350 linhas)
│   ├── constants.js           # Constantes da aplicação
│   ├── components/
│   │   ├── Sidebar.jsx        # Painel lateral com controles e configurações
│   │   ├── ProductCard.jsx    # Card de produto com edição inline
│   │   ├── SpacerCard.jsx     # Espaçador com controle de tamanho
│   │   ├── CoverPage.jsx      # Página de capa do PDF
│   │   ├── TocPage.jsx        # Sumário com links clicáveis
│   │   ├── CatalogPage.jsx    # Página de produtos (grid 3×3)
│   │   ├── SearchModal.jsx    # Modal de busca com multi-seleção
│   │   ├── ProjectModal.jsx   # Modal de criação de projeto
│   │   ├── ProjectsView.jsx   # Lista de projetos
│   │   ├── SortableCatalogItem.jsx  # Wrapper de drag & drop
│   │   └── ui/                # Componentes reutilizáveis (Toggle, ColorPicker, Dialog)
│   ├── hooks/
│   │   ├── useCatalog.js      # Estado e operações do catálogo
│   │   ├── useProjects.js     # Gerenciamento de projetos
│   │   └── useSearch.js       # Busca com debounce
│   └── utils/
│       ├── api.js             # Camada de comunicação com retry e backoff
│       ├── csv.js             # Parser CSV com mapeamento de colunas
│       ├── helpers.js         # Funções utilitárias puras
│       └── image.js           # Compressão e conversão de imagens
├── index.html
├── vite.config.js             # Build otimizado com code splitting
├── tailwind.config.js
└── package.json
```

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | React 18.2, Vite 7.3, Tailwind CSS 3.4 |
| **Backend** | Express 4.19, Prisma 5.22, SQLite |
| **Drag & Drop** | @dnd-kit (core + sortable) |
| **Ícones** | Lucide React |
| **PDF** | html2pdf.js (renderização client-side) |
| **Upload** | Multer (validação + armazenamento em disco) |
| **Segurança** | Helmet, CORS, express-rate-limit |
| **Performance** | Compression (gzip), code splitting, lazy loading |

---

## 🚀 Como Executar

### Pré-requisitos
- **Node.js 18+**
- **npm** ou **yarn**

### Instalação

```bash
# Clonar o repositório
git clone https://github.com/AlanFJr/Sistema-Catalogo.git
cd Sistema-Catalogo

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env

# Inicializar o banco de dados
npm run prisma:migrate

# Iniciar (frontend + backend)
npm run dev
```

### Acessos
- **Frontend:** http://localhost:5175
- **API:** http://localhost:5176

---

## 📋 Endpoints da API

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/catalogs` | Criar catálogo |
| `GET` | `/api/catalogs/:id` | Obter catálogo com itens |
| `POST` | `/api/catalogs/:id/cards` | Adicionar card ao catálogo |
| `DELETE` | `/api/catalogs/:id/cards/:cardId` | Remover card do catálogo |
| `PUT` | `/api/catalogs/:id/items/reorder` | Reordenar itens |
| `POST` | `/api/catalogs/:id/spacers` | Adicionar espaçador |
| `GET` | `/api/projects` | Listar projetos |
| `POST` | `/api/projects` | Criar projeto |
| `PUT` | `/api/projects/:id` | Atualizar projeto |
| `POST` | `/api/cards` | Criar card |
| `PUT` | `/api/cards/:id` | Atualizar card |
| `POST` | `/api/cards/bulk-create` | Criar/buscar cards em lote |
| `GET` | `/api/cards/search?q=` | Buscar cards |
| `POST` | `/api/cards/:id/images` | Upload de imagem |

---

## 📦 Scripts Disponíveis

```bash
npm run dev           # Frontend (Vite) + Backend (Express) em paralelo
npm run dev:client    # Apenas frontend
npm run server        # Apenas backend
npm run build         # Build de produção
npm run preview       # Preview do build
npm run prisma:migrate  # Rodar migrations do banco
npm run prisma:generate # Gerar client Prisma
```

---

## ⚙️ Variáveis de Ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `5176` | Porta do backend |
| `CORS_ORIGIN` | `localhost:5173,5175` | Origens permitidas |
| `ENABLE_API_RATE_LIMIT` | `false` (dev) / `true` (prod) | Limitar requisições da API |
| `ENABLE_UPLOAD_RATE_LIMIT` | `false` (dev) / `true` (prod) | Limitar uploads |
| `RATE_LIMIT_MAX` | `200` | Máximo de requisições por janela |
| `UPLOAD_RATE_LIMIT_MAX` | `300` | Máximo de uploads por janela |

---

## 📝 Licença

Este projeto é de uso privado.

---

<p align="center">
  Desenvolvido com React, Express e Prisma
</p>
