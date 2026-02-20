import logoCasa from '../Logos/Casa_do_padeiro_logo.png';
import logoPlaneta from '../Logos/Planeta_logo.png';
import logoCollor from '../Logos/Collor_fest_logo.png';

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 296.8;
export const ITEMS_PER_PAGE = 9;
export const TOC_ITEMS_PER_PAGE = 28;

export const DEFAULT_COVER_LOGOS = [
  { id: 'casa-padeiro', name: 'Casa do Padeiro', src: logoCasa, enabled: true },
  { id: 'planeta-festas', name: 'Planeta Festas', src: logoPlaneta, enabled: true },
  { id: 'collor-fest', name: 'Collor Fest', src: logoCollor, enabled: true },
];

export const DEFAULT_SETTINGS = {
  title: 'Catalogo de Pascoa 2026',
  subtitle: 'Linha Profissional',
  showCover: true,
  showCoverSubtitle: true,
  coverTitle: 'Catalogo Profissional',
  coverSubtitle: 'Pascoa 2026',
  coverFooter: 'Atualizado em ' + new Date().toLocaleDateString(),
  coverLogoSize: 64,
  coverLogos: DEFAULT_COVER_LOGOS,
  primaryColor: '#FF0084',
  priceColor: '#000000',
  backgroundColor: '#FFEF3D',
  borderColor: '#FF0084',
  borderRadius: 6,
  fontFamily: 'Inter',
  showDimensions: true,
  showWeight: true,
  showBoxQty: true,
  showPrice: true,
  labelDimensions: 'Dimensoes',
  labelWeight: 'Peso',
  labelBoxQty: 'Qtd/Cx',
  labelPrice: 'Preco',
};

export const MAX_IMAGE_BYTES = 800 * 1024;
export const MAX_IMAGE_DIM = 1400;
