import { Router } from 'express';
import { storage, storageInfo } from '../src/storage/index.ts';

const router = Router();

// GET /api/storage/health - Check storage health
router.get('/health', async (req, res) => {
  try {
    const healthResult = await storage.health();
    
    res.json({
      ok: healthResult.ok,
      driver: storageInfo.driver,
      details: healthResult.details
    });
  } catch (error: any) {
    console.error('Storage health check error:', error);
    
    res.json({
      ok: false,
      driver: storageInfo.driver,
      details: `Health check failed: ${error.message}`
    });
  }
});

export default router;
