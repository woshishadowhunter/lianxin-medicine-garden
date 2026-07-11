/**
 * 数据初始化脚本
 *
 * 用途：生成 200 组家庭、11 种药材配置、种植任务分配和积分账户
 *
 * 使用方式：
 *   在微信开发者工具中，将此文件内容作为云函数 "initDatabase" 上传并执行一次
 *   或者通过云开发控制台导入 JSON 数据
 *
 * 注意：此脚本仅在项目首次部署时执行一次
 */

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// ============ 配置 ============

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

// ============ 工具函数 ============

/** 生成 200 个家庭编号 */
function generateFamilyCodes() {
  return Array.from({ length: 200 }, (_, i) => {
    const num = String(i + 1).padStart(3, '0');
    return `F${num}`;
  });
}

/** 随机分配社区 */
function assignCommunity(index) {
  return COMMUNITIES[index % COMMUNITIES.length];
}

/** 为每个家庭随机分配 3-5 种药材 */
function assignHerbs() {
  const count = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5
  const shuffled = [...HERBS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/** 生成测试手机号 */
function generatePhone(index) {
  const base = 13800000000;
  return String(base + index);
}

// ============ 主流程 ============

exports.main = async (event = {}) => {
  try {
    const adminPassword = String(event.adminPassword || '').trim();
    if (adminPassword.length < MIN_ADMIN_PASSWORD_LENGTH) {
      return {
        success: false,
        message: `adminPassword must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`,
      };
    }

    console.log('=== 开始初始化数据 ===');

    // 1. 创建管理员账号
    console.log('1/5 创建管理员账号...');
    await db.collection('admins').add({
      data: {
        name: '超级管理员',
        password: adminPassword,
        role: 'super_admin',
        created_at: new Date(),
      },
    });
    console.log('  管理员账号已创建');

    // 2. 创建 11 种药材配置
    console.log('2/5 创建药材配置...');
    const herbInsertTasks = HERBS.map(herb =>
      db.collection('herbs').add({
        data: {
          ...herb,
          description: '',
          created_at: new Date(),
        },
      })
    );
    await Promise.all(herbInsertTasks);
    console.log(`  ${HERBS.length} 种药材已创建`);

    // 3. 创建 200 组家庭
    console.log('3/5 创建家庭数据...');
    const familyCodes = generateFamilyCodes();
    const familyInsertTasks = familyCodes.map((code, i) =>
      db.collection('families').add({
        data: {
          family_code: code,
          community: assignCommunity(i),
          phone: generatePhone(i),
          contact_name: '',
          member_count: 1,
          openid: '',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      })
    );
    await Promise.all(familyInsertTasks);
    console.log(`  ${familyCodes.length} 组家庭已创建`);

    // 4. 为每个家庭分配种植任务
    console.log('4/5 创建种植任务...');
    let taskCount = 0;
    const taskInsertPromises = [];

    for (const code of familyCodes) {
      const herbs = assignHerbs();
      for (const herb of herbs) {
        taskInsertPromises.push(
          db.collection('planting_tasks').add({
            data: {
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
            },
          })
        );
        taskCount++;
      }
    }

    await Promise.all(taskInsertPromises);
    console.log(`  ${taskCount} 个种植任务已创建`);

    // 5. 创建积分银行账户
    console.log('5/5 创建积分银行账户...');
    const accountTasks = familyCodes.map(code => db.collection('points_accounts').doc(code).set({
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
    }));
    await Promise.all(accountTasks);
    console.log('  200 个积分账户已创建');

    console.log('=== 初始化完成 ===');
    return {
      success: true,
      summary: {
        admins: 1,
        herbs: HERBS.length,
        families: familyCodes.length,
        tasks: taskCount,
        points_accounts: familyCodes.length,
      },
    };
  } catch (err) {
    console.error('初始化失败:', err);
    return { success: false, message: err.message };
  }
};
