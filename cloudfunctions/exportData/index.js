const cloud = require('wx-server-sdk');
const { CATEGORY_LABELS, buildPlantStatusRows, getPlantCategory, getPlantName } = require('./domain');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

exports.main = async (event) => {
  const { type, dateRange } = event;

  try {
    const openid = cloud.getWXContext().OPENID;
    const admin = await db.collection('admins').where({ openid }).limit(1).get();
    if (!admin.data.length) return { success: false, message: '管理员身份已失效，请重新登录' };

    let sheets = [];

    switch (type) {
      case 'all_records':
        sheets = await exportAllRecords();
        break;
      case 'family_summary':
        sheets = await exportFamilySummary();
        break;
      case 'community_compare':
        sheets = await exportCommunityCompare();
        break;
      case 'plant_status':
      case 'herb_status':
        sheets = await exportPlantStatus();
        break;
      case 'points_ledger':
        sheets = await exportPointsLedger();
        break;
      case 'annual_report':
        sheets = await exportAnnualReport();
        break;
      default:
        return { success: false, message: '未知导出类型: ' + type };
    }

    // 尝试使用 node-xlsx 生成 .xlsx，不可用时回退 CSV
    try {
      const xlsx = require('node-xlsx');
      const buffer = xlsx.build(sheets);
      const cloudPath = `exports/${type}_${Date.now()}.xlsx`;
      const uploadRes = await cloud.uploadFile({ cloudPath, fileContent: buffer });
      const fileList = await cloud.getTempFileURL({ fileList: [uploadRes.fileID] });

      return {
        success: true,
        fileUrl: fileList.fileList[0].tempFileURL,
        format: 'xlsx',
        sheets: sheets.length,
      };
    } catch (xlsxErr) {
      return fallbackCSV(sheets, type);
    }
  } catch (err) {
    console.error('导出失败:', err);
    return { success: false, message: err.message };
  }
};

// ============ 各导出模板 ============

async function exportAllRecords() {
  const res = await db.collection('care_records').orderBy('care_date', 'desc').limit(5000).get();
  const rows = [['家庭编号', '植物类别', '植物名称', '养护类型', '养护日期', '养护时间', '天气', '生长阶段', '描述', '审核状态', '审核意见', '创建时间']];
  res.data.forEach(r => {
    rows.push([
      r.family_code, CATEGORY_LABELS[getPlantCategory(r)] || CATEGORY_LABELS.other, getPlantName(r), r.care_type,
      r.care_date, r.care_time || '', r.weather || '',
      r.growth_stage || '', r.description || '',
      r.audit_status === 'confirmed' ? '已确认' : r.audit_status === 'pending' ? '待审核' : '需修正',
      r.audit_comment || '', fmtTime(r.created_at),
    ]);
  });
  return [{ name: '养护记录明细', data: rows }];
}

async function exportFamilySummary() {
  const [familiesRes, recordsRes, tasksRes] = await Promise.all([
    db.collection('families').orderBy('family_code', 'asc').get(),
    db.collection('care_records').get(),
    db.collection('planting_tasks').get(),
  ]);

  const careCounts = {}, lastCare = {};
  recordsRes.data.forEach(r => {
    careCounts[r.family_code] = (careCounts[r.family_code] || 0) + 1;
    if (!lastCare[r.family_code] || r.care_date > lastCare[r.family_code]) lastCare[r.family_code] = r.care_date;
  });

  const taskCounts = {};
  tasksRes.data.forEach(t => { taskCounts[t.family_code] = (taskCounts[t.family_code] || 0) + 1; });

  const rows = [['家庭编号', '社区', '联系人', '手机号', '种植任务数', '养护总次数', '最近养护日期', '活跃状态']];
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

  familiesRes.data.forEach(f => {
    const last = lastCare[f.family_code];
    rows.push([
      f.family_code, f.community || '', f.contact_name || '',
      f.phone || '', String(taskCounts[f.family_code] || 0),
      String(careCounts[f.family_code] || 0),
      last || '暂无', last && new Date(last) >= sevenDaysAgo ? '活跃' : '不活跃',
    ]);
  });

  return [{ name: '家庭养护统计', data: rows }];
}

async function exportCommunityCompare() {
  const [familiesRes, recordsRes, tasksRes] = await Promise.all([
    db.collection('families').get(),
    db.collection('care_records').get(),
    db.collection('planting_tasks').get(),
  ]);

  const codeToCom = {};
  familiesRes.data.forEach(f => { codeToCom[f.family_code] = f.community || '未知'; });

  const comData = {};
  recordsRes.data.forEach(r => {
    const c = codeToCom[r.family_code] || '未知';
    if (!comData[c]) comData[c] = { records: 0, families: new Set(), tasks: 0 };
    comData[c].records++;
    comData[c].families.add(r.family_code);
  });
  familiesRes.data.forEach(f => {
    const c = f.community || '未知';
    if (!comData[c]) comData[c] = { records: 0, families: new Set(), tasks: 0 };
    comData[c].families.add(f.family_code);
  });
  tasksRes.data.forEach(t => {
    const c = codeToCom[t.family_code] || '未知';
    if (!comData[c]) comData[c] = { records: 0, families: new Set(), tasks: 0 };
    comData[c].tasks++;
  });

  const rows = [['社区名称', '家庭数量', '种植任务数', '养护记录数', '户均养护次数', '排名']];
  const sorted = Object.entries(comData)
    .map(([name, d]) => ({ name, ...d, avg: (d.records / d.families.size).toFixed(1) }))
    .sort((a, b) => parseFloat(b.avg) - parseFloat(a.avg));

  sorted.forEach((item, idx) => {
    rows.push([item.name, String(item.families.size), String(item.tasks), String(item.records), item.avg, String(idx + 1)]);
  });

  return [{ name: '社区养护对比', data: rows }];
}

async function exportPlantStatus() {
  const tasksRes = await db.collection('planting_tasks').get();
  return [{ name: '植物生长状况', data: buildPlantStatusRows(tasksRes.data) }];
}

async function exportPointsLedger() {
  const [accountsRes, transactionsRes, familiesRes] = await Promise.all([
    db.collection('points_accounts').orderBy('family_code', 'asc').limit(200).get(),
    db.collection('points_transactions').orderBy('created_at', 'desc').limit(5000).get(),
    db.collection('families').orderBy('family_code', 'asc').limit(200).get(),
  ]);

  const familyMap = {};
  familiesRes.data.forEach(item => { familyMap[item.family_code] = item; });
  const accountRows = [['家庭编号', '社区', '当前余额', '累计入账', '累计冲正', '交易笔数', '更新时间']];
  accountsRes.data.forEach(account => {
    accountRows.push([
      account.family_code,
      familyMap[account.family_code] && familyMap[account.family_code].community || '',
      String(account.balance || 0),
      String(account.total_earned || 0),
      String(account.total_reversed || 0),
      String(account.transaction_count || 0),
      fmtTime(account.updated_at),
    ]);
  });

  const transactionRows = [['交易编号', '家庭编号', '金额', '交易后余额', '类型', '规则', '说明', '来源ID', '操作人', '交易时间']];
  transactionsRes.data.forEach(item => {
    transactionRows.push([
      item.transaction_no,
      item.family_code,
      String(item.amount),
      String(item.balance_after),
      item.type,
      item.rule_code || '',
      item.description || '',
      item.source_id || '',
      item.operator_openid || '',
      fmtTime(item.created_at),
    ]);
  });

  return [
    { name: '积分账户', data: accountRows },
    { name: '积分流水', data: transactionRows },
  ];
}

async function exportAnnualReport() {
  const s1 = await exportFamilySummary();
  const s2 = await exportCommunityCompare();
  const s3 = await exportPlantStatus();
  const s4 = await exportPointsLedger();
  return [...s1, ...s2, ...s3, ...s4];
}

// ============ CSV 回退 ============

function fallbackCSV(sheets, type) {
  const allRows = [];
  sheets.forEach(sheet => {
    allRows.push(`【${sheet.name}】`);
    sheet.data.forEach(row => {
      allRows.push(row.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(','));
    });
    allRows.push('');
  });

  const csvContent = allRows.join('\n');
  const cloudPath = `exports/${type}_${Date.now()}.csv`;

  return cloud.uploadFile({ cloudPath, fileContent: csvContent }).then(uploadRes =>
    cloud.getTempFileURL({ fileList: [uploadRes.fileID] }).then(fileList => ({
      success: true,
      fileUrl: fileList.fileList[0].tempFileURL,
      format: 'csv',
      sheets: sheets.length,
    }))
  );
}

function fmtTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
