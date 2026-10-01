export const categoryColors = [
  ['blue', '파랑', '#1d4ed8', '#93c5fd'],
  ['purple', '보라', '#7e22ce', '#d8b4fe'],
  ['green', '초록', '#15803d', '#86efac'],
  ['orange', '주황', '#b45309', '#fdba74'],
  ['pink', '분홍', '#be185d', '#f9a8d4'],
  ['teal', '청록', '#0f766e', '#5eead4'],
  ['red', '빨강', '#b91c1c', '#fca5a5'],
  ['indigo', '남색', '#4338ca', '#a5b4fc'],
];
export function categoryColor(category, categories) {
  return categoryColors.find(([key]) => key === category?.color) || categoryColors[Math.max(0, categories.findIndex(c => c.id === category?.id)) % categoryColors.length];
}
