import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

import migrations from './migrations';
import { Order, OrderItem, Business, Employee, Product, InventoryLog } from './models';
import { schema } from './schema';

// Check if running in Expo Go or remote debugger where WatermelonDB's native JSI SQLite is unavailable
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const isDebuggerActive = typeof (global as any).nativeCallSyncHook === 'undefined';
const isJSISupported =
  (Platform.OS === 'ios' || Platform.OS === 'android') && !isExpoGo && !isDebuggerActive;

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: isJSISupported,

  onSetUpError: (error) => {
    console.error('Database setup error', error);
  },
});

const database = new Database({
  adapter,
  modelClasses: [Business, Employee, Product, Order, OrderItem, InventoryLog],
});

export default database;
