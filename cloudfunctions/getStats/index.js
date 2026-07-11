const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { action } = event;

  try {
    switch (action) {

      case 'overview': {
        const [familyCount, recordCount, taskCount] = await Promise.all([
          db.collection('families').count(),
          db.collection('care_records').count(),
          db.collection('planting_tasks').count(),
        ]);

        // 活跃家庭（最近7天有记录的）
        const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
        const activeRes = await db.collection('care_records')
          .where({ created_at: db.command.gte(sevenDaysAgo) })
          .get();

        const activeFamilies = new Set(activeRes.data.map(r => r.family_code)).size;

        return {
          success: true,
          data: {
            familyCount: familyCount.total,
            activeFamilies,
            recordCount: recordCount.total,
            taskCount: taskCount.total,
          },
        };
      }

      case 'photoCount': {
        const res = await db.collection('care_records').get();
        let count = 0;
        for (const record of res.data) {
          if (record.photos && Array.isArray(record.photos)) {
            count += record.photos.length;
          }
        }
        return { success: true, count };
      }

      case 'communityRank': {
        const res = await db.collection('care_records')
          .aggregate()
          .group({ _id: '$family_code', count: { $sum: 1 } })
          .sort({ count: -1 })
          .end();

        // 获取每个家庭编号对应的社区
        const familyCodes = res.list.map(r => r._id);
        const familiesRes = await db.collection('families')
          .where({ family_code: db.command.in(familyCodes) })
          .get();

        const codeToCommunity = {};
        familiesRes.data.forEach(f => { codeToCommunity[f.family_code] = f.community; });

        const communities = {};
        res.list.forEach(r => {
          const com = codeToCommunity[r._id] || '未知社区';
          communities[com] = (communities[com] || 0) + r.count;
        });

        const rank = Object.entries(communities)
          .map(([community, count]) => ({ community, count }))
          .sort((a, b) => b.count - a.count);

        return { success: true, data: rank };
      }

      default:
        return { success: false, message: '未知操作' };
    }
  } catch (err) {
    return { success: false, message: err.message };
  }
};
