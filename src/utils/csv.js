import { stripAccents } from './helpers';

const detectDelimiter = (line) => {
  const counts = {
    ';': (line.match(/;/g) || []).length,
    ',': (line.match(/,/g) || []).length,
    '\t': (line.match(/\t/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] || ';';
};

export const parseCsvText = (text) => {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstNonEmptyLine = normalized.split('\n').find((line) => line.trim() !== '') || '';
  const delimiter = detectDelimiter(firstNonEmptyLine);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const nextChar = normalized[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(field);
      field = '';
      continue;
    }

    if (!inQuotes && char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((line) => line.some((cell) => String(cell).trim() !== ''));
};

export const getColumnMap = (headers) => {
  const map = {};
  const aliases = {
    codigo: 'code',
    cod: 'code',
    referencia: 'code',
    ref: 'code',
    nome: 'name',
    produto: 'name',
    preco: 'price',
    valor: 'price',
    dimensoes: 'dimensions',
    dimensao: 'dimensions',
    peso: 'weight',
    qtd: 'boxQty',
    quantidade: 'boxQty',
    caixa: 'boxQty',
  };

  headers.forEach((header, index) => {
    const normalized = stripAccents(String(header))
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    if (aliases[normalized]) {
      map[aliases[normalized]] = index;
    }
  });

  return map;
};
