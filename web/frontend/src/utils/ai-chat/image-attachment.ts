// ============================================================
// AI 聊天图片附件处理
// ============================================================

/** 单条消息最多携带的图片数量（与后端 MAX_IMAGES_PER_MESSAGE 对齐） */
export const MAX_ATTACHED_IMAGES = 4;

/** 压缩后最长边的像素上限（超过则等比缩放，控制 base64 体积） */
const MAX_EDGE_PX = 1280;

/** 压缩输出质量（JPEG） */
const JPEG_QUALITY = 0.85;

/**
 * 把 File 转成压缩后的 Data URL
 * @param {File} file - 用户选择的图片文件
 * @returns {Promise<string>} data:image/...;base64 形式的 Data URL
 * @description 用 canvas 等比缩放到最长边 1280px 再转 JPEG base64：
 *   原图直传会让请求体膨胀到十几 MB，既拖慢 SSE 首字也容易触发网关限制；
 *   压缩后单张通常在 200KB 以内，视觉模型识别精度不受影响。
 */
export const fileToCompressedDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read_failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode_failed'));
      img.onload = () => {
        const { width, height } = img;
        const scale = Math.min(1, MAX_EDGE_PX / Math.max(width, height));
        const targetW = Math.max(1, Math.round(width * scale));
        const targetH = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas_unsupported'));
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        // PNG 透明图转 JPEG 会变黑底，故 PNG 保持原格式输出
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(mime, JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

/**
 * 过滤出合法的图片文件
 * @param {File[]} files - 用户选择的文件列表
 * @returns {File[]} type 以 image/ 开头的文件
 */
export const pickImageFiles = (files: File[]): File[] => {
  return files.filter((f) => typeof f.type === 'string' && f.type.startsWith('image/'));
};
