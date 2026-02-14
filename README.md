# Gerador de Catalogos

Projeto React + Vite para montar catalogos e exportar em PDF. A aplicacao foi estruturada a partir do arquivo `gerador_catalogos` e agora roda como um app completo com Tailwind CSS.

## Requisitos
- Node.js 18+ (recomendado)

## Instalar dependencias
```powershell
npm install
```

## Rodar em desenvolvimento (frontend + backend)
1) Inicialize o banco (SQLite + Prisma):
```powershell
npm run prisma:migrate
```

2) Inicie tudo com um comando:
```powershell
npm run dev
```

Acesse `http://localhost:5175`.

O backend escuta em `http://0.0.0.0:5176`.

Por seguranca, o Vite roda apenas em `127.0.0.1` por padrao.

## Build de producao
```powershell
npm run build
```

O backend serve o `dist/` automaticamente quando existir.

## Principais ajustes feitos
- Estrutura Vite pronta (`index.html`, `src/main.jsx`, `src/App.jsx`).
- Tailwind configurado em `tailwind.config.js` e `src/index.css`.
- Exclusao de cards corrigida com modal de confirmacao e estado dedicado.
- `btn-action` migrado para CSS (o `@apply` no JSX nao era processado).
- Classe `body.generating-pdf` aplicada corretamente durante exportacao.

## Banco de dados e uploads
- Banco SQLite em `backend/prisma/dev.db`.
- Uploads ficam em `backend/uploads` (fazer backup dessa pasta).
- Imagens sao servidas via `/uploads/*`.

## Seguranca
- O backend usa `helmet` para headers de seguranca.
- Existe limitacao de taxa para API e upload (`express-rate-limit`).
- CORS e controlado por variavel de ambiente (`CORS_ORIGIN`).
- Upload aceita apenas `jpg`, `jpeg`, `png` e `webp`.

Copie `.env.example` para `.env` e ajuste conforme necessario.

## Guia rapido de uso
1) Criar card: clique em "Adicionar" e edite o "Ref" (cód ref) e o nome.
2) Subir foto: clique/cole na area do card; a imagem vai para o backend.
3) Reaproveitar cards: pressione `Shift + F`, pesquise e marque os cards; clique em "Adicionar ao catalogo".
4) Modo organizacao: pressione `Shift + O` para habilitar espacos vazios e use o botao "+ Espaco".
5) Projetos: clique na aba "Projetos", crie um novo e use "Abrir" para continuar.

## Observacoes
- O app ativo esta em `src/App.jsx`.
