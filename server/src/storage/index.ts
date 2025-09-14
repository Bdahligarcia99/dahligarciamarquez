import { StorageDriver } from './driver.js';
import { LocalStorageDriver } from './localDriver.js';
import { SupabaseStorageDriver } from './supabaseDriver.js';

const DRIVER = (process.env.STORAGE_DRIVER || 'local').toLowerCase(); // 'local' | 'supabase'

function createStorageDriver(): StorageDriver {
  switch (DRIVER) {
    case 'supabase':
      return new SupabaseStorageDriver();
    case 'local':
    default:
      return new LocalStorageDriver();
  }
}

export const storage = createStorageDriver();
export const storageInfo = { driver: DRIVER };
