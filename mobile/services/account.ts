/**
 * Account and data deletion.
 *
 * Google Play requires an in-app path to delete the account, and the policy
 * published at pos.shopbook.lk/privacy already points customers at Profile.
 * This is the client half; delete_account does the server purge.
 *
 * Deleting the account does NOT cancel the store subscription — only Apple
 * or Google can do that, from the customer's own store account. The caller
 * is responsible for saying so before it asks for confirmation.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import database from '../components/data/db';
import { supabase } from './sync';

export async function deleteAccount(businessId: string, phone: string): Promise<void> {
  const { error } = await supabase.rpc('delete_account', {
    input_business_id: businessId,
    input_phone: phone,
  });

  if (error) throw new Error(error.message);

  // Server data is gone; the local copy must go too, or the next sync would
  // push the whole shop back up under the same ids.
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
  await AsyncStorage.clear();
}
