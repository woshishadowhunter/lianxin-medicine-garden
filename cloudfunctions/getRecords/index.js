const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { family_code, herb_code, care_type, audit_status, page = 1, pageSize = 20 } = event;

  try {
    let query = db.collection('care_records');
    const conditions = {};

    if (family_code) conditions.family_code = family_code;
    if (herb_code) conditions.herb_code = herb_code;
    if (care_type) conditions.care_type = care_type;
    if (audit_status) conditions.audit_status = audit_status;

    if (Object.keys(conditions).length) {
      query = query.where(conditions);
    }

    const total = await query.count();

    const res = await query
      .orderBy('care_date', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    return {
      success: true,
      data: res.data,
      total: total.total,
      page,
      pageSize,
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
};
