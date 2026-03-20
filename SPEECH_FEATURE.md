# 🎤 Funcionalidade de Geração de Discursos

## Visão Geral

A funcionalidade de geração de discursos permite criar apresentações profissionais e prontas para uso a partir dos produtos do seu catálogo. Com apenas alguns cliques, você pode gerar discursos de vendas, visões gerais de produtos e resumos executivos.

## Características

### ✨ Três Modelos de Discurso

1. **Apresentação de Vendas (Sales Pitch)**
   - Introdução cativante
   - Destaques dos 5 principais produtos
   - Informações detalhadas (código, descrição, dimensões, peso, preço)
   - Conclusão profissional com call-to-action

2. **Visão Geral dos Produtos (Product Overview)**
   - Sumário executivo
   - Lista completa de todos os produtos
   - Formato conciso e organizado

3. **Resumo Executivo (Executive Summary)**
   - Métricas do catálogo (total de produtos, completude)
   - Top 5 produtos
   - Próximos passos sugeridos

### 📥 Múltiplos Formatos de Exportação

- **Markdown (.md)**: Perfeito para documentação e fácil edição
- **Texto Simples (.txt)**: Compatível com qualquer aplicativo

### 🎯 Recursos Adicionais

- Copiar para área de transferência com um clique
- Personalização do título do discurso
- Geração baseada em dados reais do catálogo
- Armazenamento automático no banco de dados

## Como Usar

### Via Interface Web

1. Abra seu projeto/catálogo no PIM Builder
2. Clique no botão **"Gerar Discurso"** na barra lateral (botão roxo)
3. Selecione o tipo de discurso desejado:
   - Apresentação de Vendas
   - Visão Geral dos Produtos
   - Resumo Executivo
4. (Opcional) Personalize o título
5. Clique em **"Gerar Discurso"**
6. Exporte o discurso em formato Markdown ou TXT
7. Ou copie diretamente para a área de transferência

### Via API

#### Gerar um Discurso

```bash
POST /api/catalogs/:catalogId/speech/generate
Content-Type: application/json

{
  "templateType": "sales_pitch",  // ou "product_overview" ou "executive_summary"
  "title": "Meu Título Personalizado"  // opcional
}
```

**Resposta:**
```json
{
  "speech": {
    "id": "uuid",
    "catalogId": "uuid",
    "title": "Título do Discurso",
    "content": "Conteúdo do discurso em Markdown...",
    "templateType": "sales_pitch",
    "createdAt": "2026-03-20T17:38:41.103Z",
    "updatedAt": "2026-03-20T17:38:41.103Z"
  }
}
```

#### Listar Discursos de um Catálogo

```bash
GET /api/catalogs/:catalogId/speeches
```

#### Obter um Discurso Específico

```bash
GET /api/speeches/:speechId
```

#### Atualizar um Discurso

```bash
PUT /api/speeches/:speechId
Content-Type: application/json

{
  "title": "Novo Título",
  "content": "Novo conteúdo...",
  "templateType": "executive_summary"
}
```

#### Deletar um Discurso

```bash
DELETE /api/speeches/:speechId
```

## Estrutura dos Modelos

### Sales Pitch (Apresentação de Vendas)

```markdown
# [Nome do Catálogo]

[Descrição do Catálogo]

## Introdução

Boa tarde a todos! É com grande satisfação que apresento...

## Destaques dos Produtos

### 1. [Nome do Produto]

**Código:** [Código de Referência]

[Descrição]

**Dimensões:** [Dimensões]
**Peso:** [Peso]
**Quantidade por caixa:** [Qtd]
**Preço:** [Preço]

## Conclusão

Estes são apenas alguns dos destaques...
```

### Product Overview (Visão Geral)

```markdown
# Visão Geral: [Nome do Catálogo]

## Sumário Executivo

Este catálogo apresenta [N] produtos...

## Lista Completa de Produtos

1. **[Nome]** (Ref: [Código])
   - [Descrição]
   - Preço: [Preço]
2. ...
```

### Executive Summary (Resumo Executivo)

```markdown
# Resumo Executivo: [Nome do Catálogo]

## Métricas do Catálogo

- Total de produtos: [N]
- Produtos com preço: [N]
- Produtos com imagens: [N]
- Taxa de completude: [%]

## Principais Produtos

- **[Nome]** - [Preço]
- ...

## Próximos Passos

1. Revisar todos os produtos no catálogo completo
2. Identificar oportunidades de vendas
3. Preparar propostas personalizadas para clientes
```

## Modelo de Dados

### Tabela `Speech`

```prisma
model Speech {
  id          String   @id @default(uuid())
  catalogId   String
  title       String
  content     String
  templateType String  @default("sales_pitch")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([catalogId])
}
```

## Casos de Uso

1. **Preparação para Reuniões de Vendas**
   - Gere um discurso de vendas completo antes de apresentar para clientes
   - Personalize o conteúdo conforme necessário

2. **Documentação Interna**
   - Use a Visão Geral para criar documentação de produtos
   - Mantenha registros atualizados dos catálogos

3. **Relatórios Executivos**
   - Crie resumos rápidos para apresentações executivas
   - Acompanhe métricas de completude do catálogo

4. **Treinamento de Equipe**
   - Forneça discursos prontos para novos vendedores
   - Padronize a comunicação sobre produtos

## Tecnologias Utilizadas

- **Backend**: Node.js, Express, Prisma
- **Frontend**: React, Lucide Icons
- **Banco de Dados**: SQLite
- **Formato de Saída**: Markdown

## Contribuindo

Para adicionar novos templates de discurso:

1. Adicione a função de geração em `/backend/server.js`:
```javascript
function generateYourTemplateSpeech(catalog, cards) {
  // Sua lógica aqui
  return speech;
}
```

2. Adicione a opção no modal `/src/components/SpeechModal.jsx`:
```jsx
<option value="your_template">Seu Template</option>
```

3. Atualize a lógica de geração em `/backend/server.js`:
```javascript
if (templateType === 'your_template') {
  content = generateYourTemplateSpeech(catalog, cards);
}
```

## Licença

Este recurso faz parte do PIM Builder e segue a mesma licença do projeto principal.
