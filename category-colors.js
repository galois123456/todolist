export const categoryColors = [
  ['blue', '파랑', '#1d4ed8', '#93c5fd'],
  ['purple', '보라', '#7e22ce', '#d8b4fe'],
  ['green', '초록', '#15803d', '#86efac'],
  ['orange', '주황', '#ea580c', '#fb923c'],
  ['pink', '분홍', '#ec4899', '#f9a8d4'],
  ['teal', '청록', '#0e7490', '#67e8f9'],
  ['red', '빨강', '#ef4444', '#f87171'],
  ['indigo', '남색', '#4338ca', '#a5b4fc'],
  ['black', '검정', '#111827', '#f3f4f6'],
  ['yellow', '노랑', '#a16207', '#fde047'],
  ['brown', '갈색', '#78350f', '#d6b99a'],
  ['gray', '회색', '#4b5563', '#cbd5e1'],
];
export function categoryColor(category, categories) {
  return categoryColors.find(([key]) => key === category?.color) || categoryColors[Math.max(0, categories.findIndex(c => c.id === category?.id)) % categoryColors.length];
}
