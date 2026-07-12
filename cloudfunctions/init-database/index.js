const cloud = require('wx-server-sdk');
const { LEGACY_HERB_CODES, PLANTS, buildSeedTask } = require('./plant-seed');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const COMMUNITIES = [
  '阳光社区', '和谐社区', '幸福社区', '绿洲社区',
  '翠苑社区', '和风社区', '春雨社区', '金秋社区',
];

const HERBS = PLANTS.filter(plant => LEGACY_HERB_CODES.includes(plant.code));

const PLANT_DATE = '2026-04-20';
const MIN_ADMIN_PASSWORD_LENGTH = 8;
const BATCH_SIZE = 20;

function assignPlants() {
  const count = 3 + Math.floor(Math.random() * 3);
  const shuffled = [...PLANTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/** 分批写入，每批 BATCH_SIZE 条，避免触发云数据库并发限制 */
async function batchInsert(collection, records) {
  let done = 0;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(record =>
      db.collection(collection).add({ data: record })
    ));
    done += batch.length;
    if (done % 100 === 0 || done === records.length) {
      console.log(`  ${collection}: ${done}/${records.length}`);
    }
  }
}

async function initializePointAccounts() {
  for (let i = 0; i < 200; i += BATCH_SIZE) {
    const codes = Array.from({ length: Math.min(BATCH_SIZE, 200 - i) }, (_, offset) => `F${String(i + offset + 1).padStart(3, '0')}`);
    await Promise.all(codes.map(code => db.collection('points_accounts').doc(code).set({
      data: {
        family_code: code,
        balance: 0,
        total_earned: 0,
        total_reversed: 0,
        transaction_count: 0,
        version: 0,
        created_at: new Date(),
        updated_at: new Date(),
      },
    })));
  }
}

exports.main = async (event = {}) => {
  try {
    const adminPassword = String(event.adminPassword || '').trim();
    if (adminPassword.length < MIN_ADMIN_PASSWORD_LENGTH) {
      return {
        success: false,
        message: `adminPassword must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`,
      };
    }

    console.log('=== 开始初始化数据（分批写入）===');

    // 1. 管理员
    console.log('1/5 创建管理员账号...');
    await db.collection('admins').add({
      data: {
        name: '超级管理员',
        password: adminPassword,
        role: 'super_admin',
        created_at: new Date(),
      },
    });
    console.log('  管理员已创建');

    // 2. 植物配置；同时保留旧本草集合
    console.log('2/5 创建植物配置...');
    await batchInsert('plants', PLANTS.map(plant => ({
      ...plant, is_active: true, created_at: new Date(),
    })));
    await batchInsert('herbs', HERBS.map(h => ({
      ...h, description: '', created_at: new Date(),
    })));
    console.log(`  ${PLANTS.length} 种植物已创建（含 ${HERBS.length} 种兼容本草）`);

    // 3. 家庭数据
    console.log('3/5 创建家庭数据...');
    const familyRecords = [];
    for (let i = 0; i < 200; i++) {
      familyRecords.push({
        family_code: `F${String(i + 1).padStart(3, '0')}`,
        community: COMMUNITIES[i % COMMUNITIES.length],
        phone: String(13800000000 + i),
        contact_name: '',
        member_count: 1,
        openid: '',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
    await batchInsert('families', familyRecords);
    console.log('  200 组家庭已创建');

    // 4. 种植任务
    console.log('4/5 创建种植任务...');
    const taskRecords = [];
    for (let i = 0; i < 200; i++) {
      const code = `F${String(i + 1).padStart(3, '0')}`;
      const plants = assignPlants();
      for (const plant of plants) {
        taskRecords.push({
          ...buildSeedTask(code, plant, PLANT_DATE),
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
    }
    await batchInsert('planting_tasks', taskRecords);
    console.log(`  ${taskRecords.length} 个种植任务已创建`);

    console.log('5/5 创建积分银行账户...');
    await initializePointAccounts();
    console.log('  200 个积分账户已创建');

    console.log('=== 初始化完成 ===');
    return {
      success: true,
      summary: {
        admins: 1,
        plants: PLANTS.length,
        herbs: HERBS.length,
        families: 200,
        tasks: taskRecords.length,
        points_accounts: 200,
      },
    };
  } catch (err) {
    console.error('初始化失败:', err);
    return { success: false, message: err.message };
  }
};
