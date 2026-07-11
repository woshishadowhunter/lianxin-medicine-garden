const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const COMMUNITIES = [
  '阳光社区', '和谐社区', '幸福社区', '绿洲社区',
  '翠苑社区', '和风社区', '春雨社区', '金秋社区',
];

const HERBS = [
  { code: 'jyh',  name: '金银花', icon_name: 'herb', growth_days: 150 },
  { code: 'bh',   name: '薄荷',   icon_name: 'herb', growth_days: 90  },
  { code: 'gq',   name: '枸杞',   icon_name: 'herb', growth_days: 180 },
  { code: 'ac',   name: '艾草',   icon_name: 'herb', growth_days: 120 },
  { code: 'yxc',  name: '鱼腥草', icon_name: 'herb', growth_days: 100 },
  { code: 'blg',  name: '板蓝根', icon_name: 'herb', growth_days: 140 },
  { code: 'pgy',  name: '蒲公英', icon_name: 'herb', growth_days: 80  },
  { code: 'jh',   name: '菊花',   icon_name: 'herb', growth_days: 130 },
  { code: 'zs',   name: '紫苏',   icon_name: 'herb', growth_days: 100 },
  { code: 'ymc',  name: '益母草', icon_name: 'herb', growth_days: 110 },
  { code: 'gc',   name: '甘草',   icon_name: 'herb', growth_days: 160 },
];

const PLANT_DATE = '2026-04-20';
const MIN_ADMIN_PASSWORD_LENGTH = 8;
const BATCH_SIZE = 20;

function assignHerbs() {
  const count = 3 + Math.floor(Math.random() * 3);
  const shuffled = [...HERBS].sort(() => Math.random() - 0.5);
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

    // 2. 药材配置
    console.log('2/5 创建药材配置...');
    await batchInsert('herbs', HERBS.map(h => ({
      ...h, description: '', created_at: new Date(),
    })));
    console.log(`  ${HERBS.length} 种药材已创建`);

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
      const herbs = assignHerbs();
      for (const herb of herbs) {
        taskRecords.push({
          family_code: code,
          herb_code: herb.code,
          herb_name: herb.name,
          herb_icon: '',
          herb_icon_name: herb.icon_name,
          plant_date: PLANT_DATE,
          status: 'growing',
          care_count: 0,
          last_care_date: '',
          last_care_type: '',
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
