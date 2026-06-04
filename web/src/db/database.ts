import { Database } from '@nozbe/watermelondb';
import migrations from './migrations';
import { Order, OrderItem, Business, Employee, Product, InventoryLog } from './models';
import { schema } from './schema';

let database: Database;

if (typeof window !== 'undefined') {
  const LokiJSAdapter = require('@nozbe/watermelondb/adapters/lokijs').default;
  const adapter = new LokiJSAdapter({
    schema,
    migrations,
    useWebWorker: false,
    useIncrementalIndexedDB: true,
  });

  database = new Database({
    adapter,
    modelClasses: [Business, Employee, Product, Order, OrderItem, InventoryLog],
  });
} else {
  // SSR placeholder instance (won't be queried on server because components only use it in client-side useEffects/handlers)
  const LokiJSAdapter = require('@nozbe/watermelondb/adapters/lokijs').default;
  database = new Database({
    adapter: new LokiJSAdapter({ schema, useWebWorker: false, useIncrementalIndexedDB: false }),
    modelClasses: [Business, Employee, Product, Order, OrderItem, InventoryLog],
  });
}

export default database;
export type { Business, Employee, Product, Order, OrderItem, InventoryLog };
export { schema };
