export type ClaimReason =
  | 'Defecto de Fábrica'
  | 'Producto Vencido / Caducado'
  | 'Daño en Transporte / Golpe'
  | 'Empaque Roto o Manchado'
  | 'Pedido / Despacho Equivocado'
  | 'Insatisfacción / Reclamación de Calidad'
  | 'Faltante de Contenido'
  | 'Otro Motivo';

export type ClaimStatus = 'Cambio Realizado' | 'Aprobado' | 'En Revisión' | 'Rechazado';

export interface ProductClaim {
  id: string;
  voucherNumber: string; // e.g. "VCH-2026-0001"
  createdAt: string;     // ISO timestamp
  formattedDate: string; // "05/09/2026"
  formattedTime: string; // "21:15"
  
  // Route assignment
  routeId: string;            // e.g. "RUTA-1", "RUTA-2", etc.
  vendorName: string;         // Nombre del vendedor asignado a la ruta

  // Required fields from prompt
  clientName: string;         // Nombre del cliente
  invoiceNumber: string;      // Número de factura
  deliveryPerson: string;     // Nombre del piloto / quien entrega
  productName: string;        // Nombre del producto
  reason: ClaimReason;        // Motivo del cambio o reclamación
  vendorSignature: string;    // Firma digital del vendedor (Data URL)
  clientSignature: string;    // Firma digital del cliente (Data URL)
  
  // Details
  vendorCode?: string;        // Código interno de vendedor
  quantity: number;           // Cantidad cambiada
  unit: string;               // Unidades, Cajas, Paquetes, etc.
  reasonDetails?: string;     // Detalle ampliado del problema
  batchOrLot?: string;        // Número de lote (opcional)
  status: ClaimStatus;        // Estado de la gestión
  notes?: string;             // Observaciones adicionales
  syncedToCloud: boolean;     // Estado de sincronización en tiempo real
}

export interface VendorSummary {
  routeId: string;
  vendorName: string;
  totalClaims: number;
  totalQuantity: number;
  lastClaimDate: string;
  topReasons: { reason: string; count: number }[];
  topProducts: { product: string; count: number }[];
}

export interface FilterState {
  searchQuery: string;
  selectedVendor: string;
  selectedRoute: string;
  selectedProduct: string;
  selectedReason: string;
  startDate: string;
  endDate: string;
  status: string;
}

export type ActiveTab =
  | 'new-claim'
  | 'vendor-folders'
  | 'statistics'
  | 'voucher-history'
  | 'admin-alerts'
  | 'admin-users';

export type UserRole = 'ADMIN' | 'ROUTE';

export interface UserAccount {
  id: string;
  username: string;       // "Admin" or "RUTA-1" ... "RUTA-11"
  displayName: string;    // e.g. "Administrador General", "Vendedor Ruta 1"
  role: UserRole;
  routeId?: string;       // "RUTA-1", "RUTA-2", etc. (solo para rutas)
  vendorName: string;     // Nombre asignado
  password?: string;      // En cliente se puede omitir o mantener
  lastLogin?: string;
}

export interface AdminAlert {
  id: string;
  claimId: string;
  voucherNumber: string;
  routeId: string;
  productName: string;
  clientName: string;
  timestamp: string;
  createdAt?: string;
  formattedDateTime: string;
  message: string;
  read: boolean;
}
