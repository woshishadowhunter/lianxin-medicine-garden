/**
 * 照片处理工具：压缩 + 水印 + 上传
 */

/**
 * 压缩图片，限制单张不超过 maxSize MB
 * 直接用 compressImage 压缩，不通过 getFileInfo 判定大小，
 * 避免模拟器上 getFileInfo 挂起导致卡死
 */
function compressImage(filePath, quality = 80) {
  return new Promise((resolve) => {
    wx.compressImage({
      src: filePath,
      quality,
      success: (res) => resolve(res.tempFilePath),
      fail: () => resolve(filePath), // 压缩失败用原图
    });
  });
}

/**
 * 批量压缩
 */
async function compressImages(filePaths) {
  const results = [];
  for (const path of filePaths) {
    const compressed = await compressImage(path);
    results.push(compressed);
  }
  return results;
}

/**
 * 给图片添加水印（使用离屏 Canvas）
 * 绘制半透明对角线平铺文字：连心植物园 · 家庭编号 · 日期
 * @param {string} filePath - 源图片路径
 * @param {object} options - { familyCode, date }
 * @returns {Promise<string>} 带水印的图片路径
 */
function addWatermark(filePath, options = {}) {
  return new Promise((resolve) => {
    const { familyCode = '', date = '' } = options;
    const watermarkText = familyCode ? `连心植物园 · ${familyCode} · ${date}` : `连心植物园 · ${date}`;

    // 超时保护：模拟器中 getImageInfo 可能挂起，5秒后回退原图
    const safetyTimer = setTimeout(() => {
      console.warn('水印超时，使用原图');
      resolve(filePath);
    }, 5000);

    const done = (resultPath) => {
      clearTimeout(safetyTimer);
      resolve(resultPath);
    };

    wx.getImageInfo({
      src: filePath,
      success: (imgInfo) => {
        const imgW = imgInfo.width;
        const imgH = imgInfo.height;

        const canvas = wx.createOffscreenCanvas({
          type: '2d',
          width: imgW,
          height: imgH,
        });

        if (!canvas) {
          console.warn('离屏 Canvas 不可用，跳过水印');
          done(filePath);
          return;
        }

        const ctx = canvas.getContext('2d');
        const img = canvas.createImage();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, imgW, imgH);

          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.font = `${Math.max(16, imgW / 40)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.rotate(-25 * Math.PI / 180);

          const stepX = Math.max(200, imgW / 4);
          const stepY = Math.max(120, imgH / 6);

          for (let y = -imgH; y < imgH * 2; y += stepY) {
            for (let x = -imgW; x < imgW * 2; x += stepX) {
              ctx.fillText(watermarkText, x, y);
            }
          }

          canvas.toTempFilePath({
            fileType: 'jpg',
            quality: 0.85,
            success: (res) => done(res.tempFilePath),
            fail: () => done(filePath),
          });
        };
        img.onerror = () => done(filePath);
        img.src = filePath;
      },
      fail: () => done(filePath),
    });
  });
}

/**
 * 批量添加水印
 */
async function addWatermarks(filePaths, options) {
  const results = [];
  for (const path of filePaths) {
    const watermarked = await addWatermark(path, options);
    results.push(watermarked);
  }
  return results;
}

/**
 * 上传图片到云存储
 */
function uploadPhoto(filePath, cloudPath) {
  return wx.cloud.uploadFile({
    cloudPath,
    filePath,
  });
}

/**
 * 生成云存储路径
 * families/{familyCode}/{taskId}/{date}/{filename}
 */
function getCloudPath(familyCode, taskId, date, filename) {
  return `families/${familyCode}/${taskId}/${date}/${filename}`;
}

module.exports = {
  compressImage,
  compressImages,
  addWatermark,
  addWatermarks,
  uploadPhoto,
  getCloudPath,
};
