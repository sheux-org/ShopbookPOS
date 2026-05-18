import { Database } from '@nozbe/watermelondb'
import migrations from './migrations'
import { Order, OrderItem, Business, Employee, Product } from './models'
import { schema } from './schema'

import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import { Platform } from 'react-native'

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: Platform.OS === 'ios',
  onSetUpError: error => {
    console.error('Database failed to load', error);
  }
})

const database = new Database({
  adapter,
  modelClasses: [
    Business, 
    Employee, 
    Product, 
    Order, 
    OrderItem
  ],
})

export default database

