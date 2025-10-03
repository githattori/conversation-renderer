import type { DiagramNode } from '../state/store'

export const buildMindmapMarkdown = (nodes: DiagramNode[]): string => {
  if (!nodes.length) return '# Mindmap\n'
  const root = nodes.find((node) => node.parentId === null)
  if (!root) {
    return '# Mindmap\n'
  }
  const lines: string[] = [`# ${root.label}`]
  const renderChildren = (parentId: string, depth: number) => {
    const children = nodes.filter((node) => node.parentId === parentId)
    children.forEach((child) => {
      lines.push(`${'  '.repeat(depth)}- ${child.label || 'Untitled'}`)
      renderChildren(child.id, depth + 1)
    })
  }
  renderChildren(root.id, 1)
  return lines.join('\n')
}

export const getMindmapChildren = (nodes: DiagramNode[], parentId: string | null) =>
  nodes.filter((node) => node.parentId === parentId)
