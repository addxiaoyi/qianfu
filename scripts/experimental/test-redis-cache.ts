import { redisService } from '../server/services/redisService';

async function testRedisCache() {
  try {
    const status = redisService.getStatus();
    console.log(`Redis Status: ${status}`);

    if (!status) {
      console.log('Redis is not connected, waiting for connection...');
      // Wait up to 5 seconds for connection
      for (let i = 0; i < 50; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (redisService.getStatus()) break;
      }
    }

    if (!redisService.getStatus()) {
      console.log('Redis failed to connect within timeout, skipping test.');
      return;
    }

    const testKey = 'server:public_list:page_1';
    const testData = { servers: [], total: 0 };

    // 1. Set cache
    await redisService.set(testKey, JSON.stringify(testData), 60);
    console.log(`Set test cache for key: ${testKey}`);

    // 2. Check if exists
    const cached = await redisService.get(testKey);
    if (cached) {
      console.log('Successfully retrieved cached data.');
    } else {
      console.error('Failed to retrieve cached data.');
      return;
    }

    // 3. Delete by pattern
    await redisService.delByPattern('server:public_list:*');
    console.log('Executed delByPattern for server:public_list:*');

    // 4. Verify it's gone
    const deleted = await redisService.get(testKey);
    if (!deleted) {
      console.log('Verification SUCCESS: Cache was correctly invalidated.');
    } else {
      console.error('Verification FAILED: Cache still exists after invalidation.');
    }

  } catch (error) {
    console.error('Error during Redis cache test:', error);
  } finally {
    process.exit(0);
  }
}

testRedisCache();
