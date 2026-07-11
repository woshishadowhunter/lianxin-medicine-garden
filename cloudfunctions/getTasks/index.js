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

    return { success: true, data: res.data };
  } catch (err) {
    return { success: false, message: err.message };
  }
};
