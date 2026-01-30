export type MenuPositionInput = {
  x: number
  y: number
  menuWidth: number
  menuHeight: number
  windowWidth: number
  windowHeight: number
  margin?: number
}

export function computeMenuPosition({
  x,
  y,
  menuWidth,
  menuHeight,
  windowWidth,
  windowHeight,
  margin = 12,
}: MenuPositionInput): { left: number; top: number } {
  let left = x
  let top = y

  // 检查右边是否超出，如果超出则向左展开
  if (left + menuWidth > windowWidth - margin) {
    left = x - menuWidth
  }

  // 检查底部是否超出，如果超出则向上展开
  if (top + menuHeight > windowHeight - margin) {
    top = y - menuHeight
  }

  // 确保菜单不会超出左边界
  if (left < margin) {
    left = margin
  }

  // 确保菜单不会超出上边界
  if (top < margin) {
    top = margin
  }

  // 确保菜单不会超出右边界（即使向左调整后）
  const maxLeft = windowWidth - menuWidth - margin
  if (left > maxLeft && maxLeft > margin) {
    left = maxLeft
  }

  // 确保菜单不会超出下边界（即使向上调整后）
  const maxTop = windowHeight - menuHeight - margin
  if (top > maxTop && maxTop > margin) {
    top = maxTop
  }

  return { left, top }
}

