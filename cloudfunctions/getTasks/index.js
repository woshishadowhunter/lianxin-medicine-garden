const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { family_code } = event;

  try {
    const res = await db.collection('planting_tasks')
      .where({ family_code })
      .orderBy('created_at', 'asc')
      .get();

    const data = res.data.map(task => ({
      ...task,
      plant_code: task.plant_code || task.herb_code || '',
      plant_name: task.plant_name || task.herb_name || '植物',
      plant_category: task.plant_category || 'herb',
      plant_icon_name: task.plant_icon_name || task.herb_icon_name || 'herb',
      source: task.source || 'legacy',
    }));
    return { success: true, data };
  } catch (err) {
    return { success: false, message: err.message };
  }
};
