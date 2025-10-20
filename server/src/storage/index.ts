import { StorageDriver } from './driver.ts';
import { LocalStorageDriver } from './localDriver.ts';
import { SupabaseStorageDriver } from './supabaseDriver.ts';

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
