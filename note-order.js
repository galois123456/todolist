// Shared by notebook rows and note cards. Only handles capture touch gestures;
// scrolling and typing elsewhere keep their normal browser behavior.
export function movedIds(ids, id, targetIndex) {
  const from = ids.indexOf(id);
  if (from < 0 || !Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= ids.length || from === targetIndex) return ids.slice();
  const next = ids.slice(); next.splice(from, 1); next.splice(targetIndex, 0, id); return next;
}

export function attachOrderDrag({root, handleSelector, itemSelector, enabled, onMove, scrollContainer}) {
  let drag = null, frame = null, marker = null;
  const win = root.ownerDocument.defaultView, doc = root.ownerDocument;
  const items = () => [...root.querySelectorAll(itemSelector)].filter(el => !el.hidden);
  function clear() {
    if (frame !== null) win.cancelAnimationFrame(frame);
    frame = null;
    const previous=drag; drag=null;
    if (previous) {
      previous.item.classList.remove('order-dragging');
      try { previous.handle.releasePointerCapture(previous.pointerId); } catch {}
    }
    root.querySelectorAll('.order-drop-target').forEach(el=>el.classList.remove('order-drop-target'));
    marker?.remove(); marker = null; drag = null;
  }
  function locate() {
    if (!drag) return;
    let closest = null, distance = Infinity;
    const all = items();
    for (const item of all) {
      const r = item.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const dx = Math.max(r.left-drag.x,0,drag.x-r.right), dy = Math.max(r.top-drag.y,0,drag.y-r.bottom);
      const d = dx*dx+dy*dy;
      if (d < distance) { distance = d; closest = item; }
    }
    root.querySelectorAll('.order-drop-target').forEach(el=>el.classList.remove('order-drop-target'));
    drag.target = closest ? all.indexOf(closest) : -1;
    if (closest && closest!==drag.item) closest.classList.add('order-drop-target');
    if (marker) {
      marker.textContent = `${drag.target+1}번째 위치로 이동`;
      marker.style.left = `${Math.max(8,Math.min(drag.x+14,win.innerWidth-180))}px`;
      marker.style.top = `${Math.max(8,Math.min(drag.y+16,win.innerHeight-48))}px`;
    }
  }
  function tick() {
    if (!drag?.active) return;
    const rect = scrollContainer?.getBoundingClientRect();
    const top = rect ? Math.max(0,rect.top) : 0, bottom = rect ? Math.min(win.innerHeight,rect.bottom) : win.innerHeight;
    const delta = drag.y < top+64 ? -12 : drag.y > bottom-64 ? 12 : 0;
    if (delta) {
      if (scrollContainer) scrollContainer.scrollTop += delta;
      else win.scrollBy(0,delta);
      locate();
    }
    frame = win.requestAnimationFrame(tick);
  }
  root.addEventListener('pointerdown',event=>{
    const handle = event.target.closest(handleSelector);
    if (!handle || handle.disabled || !enabled() || event.button!==0 || event.isPrimary===false) return;
    const item = handle.closest(itemSelector); if (!item) return;
    clear();
    drag = {handle,item,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,active:false,target:-1};
    try { handle.setPointerCapture(event.pointerId); } catch {}
  });
  root.addEventListener('pointermove',event=>{
    if (!drag || event.pointerId!==drag.pointerId) return;
    if (!enabled()) { clear(); return; }
    drag.x=event.clientX; drag.y=event.clientY;
    if (!drag.active && Math.hypot(drag.x-drag.startX,drag.y-drag.startY)<6) return;
    event.preventDefault();
    if (!drag.active) {
      drag.active=true; drag.item.classList.add('order-dragging');
      marker=doc.createElement('div'); marker.className='note-order-drag-label';
      // Keep feedback inside a modal's top layer when dragging notebook rows.
      (root.closest('dialog') || doc.body).append(marker);
      frame=win.requestAnimationFrame(tick);
    }
    locate();
  });
  root.addEventListener('pointerup',event=>{
    if (!drag || event.pointerId!==drag.pointerId) return;
    const {item,target,active}=drag;
    clear();
    if (active && target>=0 && enabled()) onMove(item.dataset.orderId,target);
  });
  root.addEventListener('pointercancel',event=>{if(event.pointerId===drag?.pointerId)clear();});
  root.addEventListener('lostpointercapture',()=>{if(drag)clear();});
  root.addEventListener('keydown',event=>{if(event.key==='Escape' && drag){event.preventDefault();event.stopPropagation();clear();}});
  return {cancel:clear};
}
