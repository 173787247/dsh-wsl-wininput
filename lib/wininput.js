// Targeted input. The whole point is that nothing here acts on "whatever is
// focused": every action names a window, and an element action re-checks that
// the element it was told about is still the element it finds.
export const ACTIONS = ["invoke", "type", "click"];

export function assertAction(action) {
  if (!ACTIONS.includes(action)) {
    throw new Error(`unsupported action: ${String(action)} (expected one of ${ACTIONS.join(", ")})`);
  }
  return action;
}

export function safeInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function parseHandle(handle) {
  if (typeof handle !== "string") return null;
  const m = /^(\d+)\.(\d+)$/.exec(handle.trim());
  return m ? { epoch: Number(m[1]), index: Number(m[2]) } : null;
}

/**
 * An element action is accepted only if the element found at the handle's index
 * still looks like the one the caller saw. Comparing name and control type is
 * what makes a handle from an earlier observation detectable: if the list moved,
 * or the button was replaced, this fails instead of clicking the wrong thing.
 */
export function sameElement(observed, current) {
  if (!observed || !current) return false;
  if (String(observed.controlType ?? "") !== String(current.controlType ?? "")) return false;
  if (String(observed.name ?? "") !== String(current.name ?? "")) return false;
  return true;
}

export function format(v) {
  const lines = [`win_invoke ok=${v.ok} action=${v.action}`];
  if (v.window) lines.push(`  window: pid=${v.window.pid} "${v.window.title}"`);
  if (v.element) lines.push(`  element: ${v.element.controlType} "${v.element.name}"`);
  if (v.text) lines.push(`  typed: ${JSON.stringify(v.text)}`);
  if (v.point) lines.push(`  point: ${v.point.x},${v.point.y} (window-relative)`);
  if (v.error) lines.push(`error: ${v.error}`);
  return lines.join("\n");
}

export function parameters() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      action: { type: "string", enum: ACTIONS, description: "invoke: activate a UI Automation element. type: send text to a window. click: click a point inside a window." },
      handle: { type: "string", description: "invoke: an element handle from uia_tree, e.g. 1790525657168.6." },
      expectName: { type: "string", description: "invoke: required. The element name you observed at that handle; the invoke is refused if the element there now has a different name." },
      expectType: { type: "string", description: "invoke: optional control type to check as well, e.g. Button." },
      pid: { type: "number", description: "Target window process id. Defaults to the foreground window." },
      text: { type: "string", description: "type: the text to send." },
      x: { type: "number", description: "click: window-relative x." },
      y: { type: "number", description: "click: window-relative y." },
    },
  };
}

export function outputSchema() {
  return { type: "object", additionalProperties: true };
}
