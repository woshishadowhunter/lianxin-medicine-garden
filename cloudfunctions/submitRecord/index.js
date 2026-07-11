const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { family_code, task_id, herb_code, herb_name, care_type, photos,
          description, weather, growth_stage, care_date, care_time } = event;

  try {
    // 插入养护记录
    const result = await db.collection('care_records').add({
      data: {
        family_code,
        task_id,
        herb_code,
        herb_name,
        care_type,
        photos: photos || [],
        description: description || '',
        weather: weather || '',
        growth_stage: growth_stage || '',
        care_date,
        care_time: care_time || '',
        audit_status: 'pending',
        audit_comment: '',
        created_at: db.serverDate(),
        updated_at: db.serverDate(),
      },
    });

    // 更新种植任务的养护计数
    await db.collection('planting_tasks').doc(task_id).update({
      data: {
        care_count: db.command.inc(1),
        last_care_date: care_date,
        last_care_type: care_type,
        updated_at: db.serverDate(),
      },
    });

    return { success: true, id: result._id };
  } catch (err) {
    console.error('提交记录失败:', err);
    return { success: false, message: err.message };
  }
};
