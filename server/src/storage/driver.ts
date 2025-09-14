export interface StorageDriver {
  putImage(params: { buffer: Buffer; mime: string; filenameHint?: string }): Promise<{ url: string, path: string }>;
  health(): Promise<{ ok: boolean; details?: string }>;
}
