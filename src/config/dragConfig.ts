// 拖拽行为配置常量

export const DRAG_THRESHOLDS = {
  // 排序行为 - 立即触发（0ms）
  REORDER_MS: 0,

  // 虚拟分组行为 - 悬停 600ms 后触发
  VIRTUAL_FOLDER_MS: 600,

  // 真实文件夹行为 - 悬停 600ms 后触发
  REAL_FOLDER_MS: 600,

  // 悬停期间允许的鼠标移动容差（像素）
  HOVER_TOLERANCE_PIXELS: 15,

  // 意图检测刷新间隔（毫秒）
  INTENT_CHECK_INTERVAL_MS: 100,
}

// 拖拽数据类型标识
export const DRAG_DATA_TYPES = {
  // 文件路径（用于文件拖拽）
  FILE_PATH: 'application/x-seconddesk-file',

  // 虚拟分组 ID（用于虚拟分组拖拽）
  VIRTUAL_FOLDER_ID: 'application/x-seconddesk-virtual-folder',

  // 分类 ID（用于分类标签拖拽）
  CATEGORY_ID: 'category-id',
}

// 视觉反馈配置
export const VISUAL_FEEDBACK = {
  // 缩放效果
  MERGE_PREVIEW_SCALE: 1.05,

  // 动画持续时间
  TRANSITION_DURATION_MS: 200,
}
