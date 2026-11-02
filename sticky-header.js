// Track wrapping, save-status changes and device rotation without a scroll listener.
export function installStickyHeader(header, root = document.documentElement) {
  const update = () => {
    const height = Math.ceil(header.getBoundingClientRect().height);
    root.style.setProperty('--app-header-height', `${height}px`);
  };
  update();
  const observer = new ResizeObserver(update);
  observer.observe(header);
  return () => observer.disconnect();
}
