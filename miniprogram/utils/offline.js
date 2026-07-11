/**
 * 离线暂存管理
 *
 * 养护记录提交时，如果网络不可用，暂存到本地 Storage，
 * 网络恢复后自动同步到云端。
 */

const OFFLINE_QUEUE_KEY = 'offline_pending_records';
const SYNC_STATUS_KEY = 'sync_status'; // 'idle' | 'syncing' | 'error'

/**
 * 检测网络状态
 */
function isOnline() {
  return new Promise((resolve) => {
    wx.getNetworkType({
      success: (res) => resolve(res.networkType !== 'none'),
      fail: () => resolve(true), // 不确定时假设在线
    });
  });
}

/**
 * 获取离线队列
 */
function getQueue() {
  try {
    return wx.getStorageSync(OFFLINE_QUEUE_KEY) || [];
  } catch (e) {
    return [];
  }
}

/**
 * 保存离线记录
 * @param {object} record - 养护记录数据
 */
function saveOffline(record) {
  const queue = getQueue();
  queue.push({
    ...record,
    _offlineId: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    _savedAt: new Date().toISOString(),
    _retryCount: 0,
  });
  wx.setStorageSync(OFFLINE_QUEUE_KEY, queue);
  wx.setStorageSync(SYNC_STATUS_KEY, 'pending');
  return queue.length;
}

/**
 * 移除已同步的记录
 */
function removeFromQueue(offlineId) {
  const queue = getQueue().filter(r => r._offlineId !== offlineId);
  wx.setStorageSync(OFFLINE_QUEUE_KEY, queue);
  if (!queue.length) wx.setStorageSync(SYNC_STATUS_KEY, 'idle');
  return queue.length;
}

/**
 * 同步所有离线记录
 * @returns {object} { synced: number, failed: number, total: number }
 */
async function syncAll() {
  const queue = getQueue();
  if (!queue.length) return { synced: 0, failed: 0, total: 0 };

  const online = await isOnline();
  if (!online) return { synced: 0, failed: queue.length, total: queue.length };

  wx.setStorageSync(SYNC_STATUS_KEY, 'syncing');
  let synced = 0;
  let failed = 0;

  for (const record of queue) {
    try {
      // 调用云函数写入数据库（绕过客户端权限限制）
      const result = await wx.cloud.callFunction({
        name: 'submitRecord',
        data: {
          family_code: record.family_code,
          task_id: record.task_id,
          herb_code: record.herb_code,
          herb_name: record.herb_name,
          care_type: record.care_type,
          photos: record.photos || [],
          description: record.description || '',
          weather: record.weather || '',
          growth_stage: record.growth_stage || '',
          care_date: record.care_date,
          care_time: record.care_time || '',
        },
      });

      if (!result.result || !result.result.success) {
        throw new Error((result.result && result.result.message) || '同步失败');
      }

      removeFromQueue(record._offlineId);
      synced++;
    } catch (err) {
      console.error('同步失败:', record._offlineId, err);
      record._retryCount = (record._retryCount || 0) + 1;
      if (record._retryCount >= 5) {
        removeFromQueue(record._offlineId); // 超过5次重试则丢弃
      }
      failed++;
    }
  }

  wx.setStorageSync(SYNC_STATUS_KEY, failed ? 'error' : 'idle');
  return { synced, failed, total: queue.length };
}

/**
 * 获取离线队列数量
 */
function getQueueCount() {
  return getQueue().length;
}

/**
 * 获取同步状态
 */
function getSyncStatus() {
  return wx.getStorageSync(SYNC_STATUS_KEY) || 'idle';
}

module.exports = {
  isOnline,
  saveOffline,
  getQueue,
  removeFromQueue,
  syncAll,
  getQueueCount,
  getSyncStatus,
};
