import { Model, Relation } from '@nozbe/watermelondb';
import { text, field, date, relation, children, readonly } from '@nozbe/watermelondb/decorators';

// ==========================================
// 1. BUSINESS MODEL
// ==========================================
export class Business extends Model {
  static table = 'businesses';
  static associations = {
    employees: { type: 'has_many' as const, foreignKey: 'business_id' },
    products: { type: 'has_many' as const, foreignKey: 'business_id' },
    orders: { type: 'has_many' as const, foreignKey: 'business_id' },
  };

  @text('name') name!: string;
  @text('business_type') businessType!: string;
  @text('address') address?: string;
  @text('phone_number') phoneNumber!: string;
  @text('tax_id') taxId?: string;
  @text('operating_hours') operatingHours?: string;
  @text('logo_uri') logoUri?: string;
  
  @children('employees') employees!: any;
  @children('products') products!: any;
  @children('orders') orders!: any;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}

// ==========================================
// 2. EMPLOYEE MODEL
// ==========================================
export class Employee extends Model {
  static table = 'employees';
  static associations = {
    businesses: { type: 'belongs_to' as const, key: 'business_id' },
  };

  @text('name') name!: string;
  @text('role') role!: 'admin' | 'manager' | 'cashier';
  @text('phone') phone!: string;
  @text('email') email?: string;
  @relation('businesses', 'business_id') business!: Relation<any>;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}

// ==========================================
// 3. PRODUCT MODEL
// ==========================================
export class Product extends Model {
  static table = 'products';
  static associations = {
    businesses: { type: 'belongs_to' as const, key: 'business_id' },
    order_items: { type: 'has_many' as const, foreignKey: 'product_id' },
  };

  @text('name') name!: string;
  @text('sku') sku?: string;
  @text('quick_code') quickCode?: string;
  @text('barcode') barcode?: string;
  @text('category') category?: string;
  @text('unit_type') unitType?: string;
  @field('cost_price') costPrice?: number;
  @field('price') price!: number;
  @field('stock_count') stockCount!: number;
  @field('low_stock_alert') lowStockAlert?: number;
  @text('icon') icon?: string;
  @field('is_favorite') isFavorite!: boolean;

  @relation('businesses', 'business_id') business!: Relation<any>;
  @children('order_items') orderItems!: any;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}

// ==========================================
// 4. ORDER MODEL
// ==========================================
export class Order extends Model {
  static table = 'orders';
  static associations = {
    businesses: { type: 'belongs_to' as const, key: 'business_id' },
    order_items: { type: 'has_many' as const, foreignKey: 'order_id' },
  };

  @text('invoice_number') invoiceNumber!: string;
  @field('total_amount') totalAmount!: number;
  @text('status') status!: 'pending' | 'paid' | 'void';

  @relation('businesses', 'business_id') business!: Relation<any>;
  @children('order_items') orderItems!: any;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}

// ==========================================
// 5. ORDER ITEM MODEL
// ==========================================
export class OrderItem extends Model {
  static table = 'order_items';
  static associations = {
    orders: { type: 'belongs_to' as const, key: 'order_id' },
    products: { type: 'belongs_to' as const, key: 'product_id' },
  };

  @text('name') name!: string;
  @field('quantity') quantity!: number;
  @field('price') price!: number;

  @relation('orders', 'order_id') order!: Relation<any>;
  @relation('products', 'product_id') product!: Relation<any>;

  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
