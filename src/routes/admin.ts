import { Router, Request, Response, NextFunction } from 'express';
import { loadBalancer } from '../proxy/balancer';
import { redisService } from '../cache/redis';
import { register, cacheHitsTotal, cacheMissesTotal, rpcRequestsTotal } from '../utils/metrics';

const router = Router();

const adminAuth = (req: Request, res: Response, next: NextFunction) => {
  const secret = process.env.ADMIN_SECRET || 'admin-secret';
  const authHeader = req.headers['x-admin-secret'];

  if (authHeader !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

router.use(adminAuth);

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  const upstreams = loadBalancer.getStats();
  
  // Get raw metrics from register (this is a bit hacky as prom-client doesn't easily export JSON values)
  // For the dashboard, we'll return the upstream stats and usage leaders.
  // The frontend can poll /metrics for the charts if needed, or we can parse it here.
  // For simplicity, we will trust the /metrics endpoint for time-series data and use this for snapshots.
  
  res.json({
    upstreams,
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    }
  });
});

// GET /api/admin/usage
router.get('/usage', async (req, res) => {
  try {
    // Get top 10 consumers
    const raw = await redisService.zrevrange('rpc_usage_stats', 0, 9, true);
    const leaderboard = [];
    for (let i = 0; i < raw.length; i += 2) {
      leaderboard.push({
        key: raw[i],
        count: parseInt(raw[i + 1], 10)
      });
    }
    res.json(leaderboard);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/admin/cache/purge
router.post('/cache/purge', async (req, res) => {
  // Simple implementation: Purge specific keys if provided, or flushdb if generic (dangerous, so restricting to pattern matching might be better)
  // For MVP: We only support deleting specific keys via body.keys array
  const { keys } = req.body;
  
  if (Array.isArray(keys) && keys.length > 0) {
    let deleted = 0;
    for (const key of keys) {
      deleted += await redisService.del(key);
    }
    return res.json({ message: `Deleted ${deleted} keys` });
  }
  
  // If no keys provided, maybe we shouldn't allow full flush for safety?
  // IMPROVEMENTS.md said "Manual Cache Purging interface".
  // Let's support a pattern match?
  
  return res.status(400).json({ error: 'Please provide an array of keys to purge.' });
});

export const adminRouter = router;
