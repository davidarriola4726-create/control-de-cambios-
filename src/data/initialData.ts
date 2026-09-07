import { ProductClaim, ClaimReason } from '../types';

export const REASON_OPTIONS: ClaimReason[] = [
  'Defecto de Fábrica',
  'Producto Vencido / Caducado',
  'Daño en Transporte / Golpe',
  'Empaque Roto o Manchado',
  'Pedido / Despacho Equivocado',
  'Insatisfacción / Reclamación de Calidad',
  'Faltante de Contenido',
  'Otro Motivo'
];

export const COMMON_PRODUCTS = [
  'Bebida Energética MYG 500ml',
  'Café Gourmet Tostado MYG 250g',
  'Detergente Líquido Concentrado MYG 1L',
  'Galletas de Avena con Miel MYG 120g',
  'Aceite Vegetal Extra Virgen MYG 900ml',
  'Leche Entera Larga Vida MYG 1L',
  'Cereal Integral Crunch MYG 400g',
  'Jabón Antibacterial en Barra MYG 150g',
  'Salsa de Tomate Tradicional MYG 300g',
  'Snack de Plátano con Sal MYG 80g'
];

export const COMMON_PILOTS = [
  'Miguel Ángel Ruiz',
  'Jorge Estrada',
  'David Valenzuela',
  'Héctor Morales',
  'Ramiro Sandoval',
  'Carlos Escobar'
];

// Sample clean SVG base64 signatures for realistic initial seed data
export const SAMPLE_SIGNATURE_VENDOR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80"><path d="M 20 50 Q 50 15 80 45 T 140 35 T 180 55 M 60 40 L 160 42" stroke="%230f172a" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>';
export const SAMPLE_SIGNATURE_CLIENT = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80"><path d="M 25 55 Q 60 20 90 40 Q 120 60 150 25 T 175 45" stroke="%231e293b" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';

// Clean system without test records - ready for real usage
export const INITIAL_CLAIMS: ProductClaim[] = [];

