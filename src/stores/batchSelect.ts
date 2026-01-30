import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useFileStore } from './files'

export const useBatchSelectStore = defineStore('batchSelect', () => {
  // 状态
  const isActive = ref(false)                           // 是否在批量选择模式
  const selectedIds = ref<Set<string>>(new Set())       // 选中的ID集合（文件路径或虚拟分组ID）
  const targetPickerVisible = ref(false)                // 目标选择器是否可见

  // 计算属性
  const selectedCount = computed(() => selectedIds.value.size)
  const hasSelection = computed(() => selectedIds.value.size > 0)
  const selectedIdsArray = computed(() => Array.from(selectedIds.value))

  // 获取选中的文件路径（排除虚拟分组）
  const selectedFilePaths = computed(() => {
    return selectedIdsArray.value.filter(id => !id.startsWith('vf_'))
  })

  // 进入批量选择模式
  function startBatchSelect(id?: string) {
    isActive.value = true
    if (id) {
      selectedIds.value.add(id)
    }
  }

  // 退出批量选择模式
  function exitBatchSelect() {
    isActive.value = false
    selectedIds.value.clear()
    targetPickerVisible.value = false
  }

  // 切换选中状态
  function toggleSelect(id: string) {
    if (selectedIds.value.has(id)) {
      selectedIds.value.delete(id)
      // 如果没有选中项了，自动退出批量选择模式
      if (selectedIds.value.size === 0) {
        exitBatchSelect()
      }
    } else {
      selectedIds.value.add(id)
    }
  }

  // 全选
  function selectAll(ids: string[]) {
    ids.forEach(id => selectedIds.value.add(id))
  }

  // 清空选择
  function clearSelection() {
    selectedIds.value.clear()
    exitBatchSelect()
  }

  // 判断是否选中
  function isSelected(id: string): boolean {
    return selectedIds.value.has(id)
  }

  // 打开目标选择器
  function openTargetPicker() {
    targetPickerVisible.value = true
  }

  // 关闭目标选择器
  function closeTargetPicker() {
    targetPickerVisible.value = false
  }

  // 添加到分类（支持虚拟分组：把虚拟分组的成员文件也添加到分类）
  function moveToCategory(categoryId: string): boolean {
    const fileStore = useFileStore()

    // 收集所有要添加的文件路径
    const allPaths: string[] = []

    for (const id of selectedIdsArray.value) {
      if (id.startsWith('vf_')) {
        // 虚拟分组：把其成员文件添加到分类
        const members = fileStore.getVirtualFolderMembers(id)
        allPaths.push(...members.map(m => m.filePath))
      } else {
        // 普通文件
        allPaths.push(id)
      }
    }

    if (allPaths.length === 0) return false

    // 去重
    const uniquePaths = Array.from(new Set(allPaths))
    const success = fileStore.addFilesToCategory(categoryId, uniquePaths)
    if (success) {
      exitBatchSelect()
    }
    return success
  }

  // 添加到虚拟分组
  function moveToVirtualFolder(folderId: string): boolean {
    const fileStore = useFileStore()
    const paths = selectedFilePaths.value
    if (paths.length === 0) return false

    const success = fileStore.addToVirtualFolder(folderId, paths)
    if (success) {
      exitBatchSelect()
    }
    return success
  }

  // 用选中项创建分类（支持虚拟分组：把虚拟分组的成员文件也添加到分类）
  function createCategoryWithSelected(name: string): boolean {
    const fileStore = useFileStore()

    // 收集所有要添加的文件路径
    const allPaths: string[] = []

    for (const id of selectedIdsArray.value) {
      if (id.startsWith('vf_')) {
        // 虚拟分组：把其成员文件添加到分类
        const members = fileStore.getVirtualFolderMembers(id)
        allPaths.push(...members.map(m => m.filePath))
      } else {
        // 普通文件
        allPaths.push(id)
      }
    }

    if (allPaths.length === 0) return false

    // 去重
    const uniquePaths = Array.from(new Set(allPaths))
    const success = fileStore.createCustomCategory(name, { mode: 'manual', filePaths: uniquePaths })
    if (success) {
      exitBatchSelect()
    }
    return success
  }

  // 用选中项创建虚拟分组
  function createVirtualFolderWithSelected(name?: string): boolean {
    const fileStore = useFileStore()
    const paths = selectedFilePaths.value
    if (paths.length < 2) return false // 需要至少2个文件

    const folder = fileStore.createVirtualFolder(paths, name)
    if (folder) {
      exitBatchSelect()
      return true
    }
    return false
  }

  return {
    // 状态
    isActive,
    selectedIds,
    targetPickerVisible,
    // 计算属性
    selectedCount,
    hasSelection,
    selectedIdsArray,
    selectedFilePaths,
    // 方法
    startBatchSelect,
    exitBatchSelect,
    toggleSelect,
    selectAll,
    clearSelection,
    isSelected,
    openTargetPicker,
    closeTargetPicker,
    // 操作
    moveToCategory,
    moveToVirtualFolder,
    createCategoryWithSelected,
    createVirtualFolderWithSelected,
  }
})
