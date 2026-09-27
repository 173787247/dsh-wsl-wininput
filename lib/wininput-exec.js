import { runPowerShell } from "./wsl-host.js";
import { assertAction, safeInt, parseHandle } from "./wininput.js";

const PRELUDE = `$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;using System.Runtime.InteropServices;
public class DshIn {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, IntPtr e);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
}
"@
function Dsh-Window([int]$targetPid, [string]$title) {
  $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Window)
  $wins = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, $cond)
  foreach ($w in $wins) {
    if ($w.Current.NativeWindowHandle -eq 0) { continue }
    if ($targetPid -gt 0 -and $w.Current.ProcessId -ne $targetPid) { continue }
    if ($title -ne '' -and $w.Current.Name -notlike "*$title*") { continue }
    return $w
  }
  return $null
}
`;

/**
 * Elements are located by identity, not by index.
 *
 * The first version of this took the index from a `uia_tree` handle and reused
 * it here. Two walks of a live tree do not agree: a notepad window observed 62
 * elements, and the element at index 10 was a different one by the time the
 * second walk ran. An index is a position in a picture that has already moved.
 *
 * So the caller names what it wants, and the match must be unique. Zero matches
 * means the element is gone; more than one means the name is not specific
 * enough to act on, and acting anyway is how you click the wrong thing.
 */
export function buildInvokeScript({ pid, title, expectName, expectType, maxDepth, maxElements }) {
  return `${PRELUDE}
$target = Dsh-Window ${pid} '${title.replace(/'/g, "''")}'
if ($null -eq $target) { ConvertTo-Json -Compress @{ error = 'no matching window' }; exit }
$walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
$matches = New-Object System.Collections.ArrayList
$seen = 0
$queue = New-Object System.Collections.Queue
$queue.Enqueue(@{ el = $target; d = 0 })
while ($queue.Count -gt 0 -and $seen -lt ${maxElements}) {
  $item = $queue.Dequeue(); $el = $item.el; $d = $item.d
  $seen++
  if ($d -gt 0) {
    try {
      $ct = $el.Current.ControlType.ProgrammaticName.Replace('ControlType.','')
      $nm = $el.Current.Name
      $typeOk = ${expectType ? `($ct -eq ${psq(expectType)})` : "$true"}
      if ($typeOk -and $nm -eq ${psq(expectName)}) { [void]$matches.Add($el) }
    } catch {}
  }
  if ($d -lt ${maxDepth}) {
    $c = $walker.GetFirstChild($el)
    while ($c) { $queue.Enqueue(@{ el = $c; d = $d + 1 }); $c = $walker.GetNextSibling($c) }
  }
}
if ($matches.Count -eq 0) { ConvertTo-Json -Compress @{ error = ${psq("no element matched")}; searched = $seen }; exit }
if ($matches.Count -gt 1) {
  ConvertTo-Json -Compress @{ error = ${psq("ambiguous: more than one element matched")}; count = $matches.Count; searched = $seen }
  exit
}
$el = $matches[0]
$o = $null
if (-not $el.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$o)) {
  ConvertTo-Json -Compress @{ error = 'element does not support InvokePattern'; element = @{ controlType = $el.Current.ControlType.ProgrammaticName.Replace('ControlType.',''); name = $el.Current.Name } }
  exit
}
$o.Invoke()
$r = New-Object DshIn+RECT; [void][DshIn]::GetWindowRect([IntPtr]$target.Current.NativeWindowHandle, [ref]$r)
ConvertTo-Json -Compress -Depth 4 @{
  element = @{ controlType = $el.Current.ControlType.ProgrammaticName.Replace('ControlType.',''); name = $el.Current.Name }
  window = @{ pid = $target.Current.ProcessId; title = $target.Current.Name }
  searched = $seen
  x = $r.L; y = $r.T
}
`;
}

function psq(s) {
  return "'" + String(s ?? "").replace(/'/g, "''") + "'";
}

export function buildTypeScript({ pid, title, text }) {
  return `${PRELUDE}
$target = Dsh-Window ${pid} '${title.replace(/'/g, "''")}'
if ($null -eq $target) { ConvertTo-Json -Compress @{ error = 'no matching window' }; exit }
# Synthesized keystrokes go to the focused window, so a background target has to
# be raised first.
[void][DshIn]::SetForegroundWindow([IntPtr]$target.Current.NativeWindowHandle)
Start-Sleep -Milliseconds 250
[System.Windows.Forms.SendKeys]::SendWait(${psq(escapeSendKeys(text))})
ConvertTo-Json -Compress -Depth 4 @{
  window = @{ pid = $target.Current.ProcessId; title = $target.Current.Name }
  typed = ${psq(text)}
}
`;
}

/** SendKeys reserves + ^ % ~ ( ) { } [ ]; literal ones must be braced. */
export function escapeSendKeys(text) {
  return String(text ?? "").replace(/[+^%~(){}[\]]/g, (c) => `{${c}}`);
}

export function buildClickScript({ pid, title, x, y }) {
  return `${PRELUDE}
$target = Dsh-Window ${pid} '${title.replace(/'/g, "''")}'
if ($null -eq $target) { ConvertTo-Json -Compress @{ error = 'no matching window' }; exit }
$r = New-Object DshIn+RECT; [void][DshIn]::GetWindowRect([IntPtr]$target.Current.NativeWindowHandle, [ref]$r)
if ($r.R -le $r.L -or $r.B -le $r.T) { ConvertTo-Json -Compress @{ error = 'window has no drawable area' }; exit }
$sx = $r.L + ${x}; $sy = $r.T + ${y}
[void][DshIn]::SetCursorPos($sx, $sy)
Start-Sleep -Milliseconds 60
[DshIn]::mouse_event(0x0002, 0, 0, 0, [IntPtr]::Zero)
[DshIn]::mouse_event(0x0004, 0, 0, 0, [IntPtr]::Zero)
ConvertTo-Json -Compress -Depth 4 @{
  window = @{ pid = $target.Current.ProcessId; title = $target.Current.Name }
  point = @{ x = ${x}; y = ${y} }
}
`;
}

export async function execute(args, config = {}) {
  const action = assertAction(args?.action ?? "invoke");
  const pid = safeInt(args?.pid);
  const title = typeof args?.titleContains === "string" ? args.titleContains : "";
  const timeoutMs = Math.min(120_000, Math.max(1000, Number(config.timeoutMs) || 30_000));

  if (action === "invoke") {
    const expectName = typeof args?.expectName === "string" ? args.expectName : "";
    if (!expectName) {
      return { ok: false, action, error: "expectName is required: name the element you want, as uia_tree reported it" };
    }
    const expectType = typeof args?.expectType === "string" ? args.expectType : "";
    const maxDepth = Math.min(12, Math.max(1, safeInt(config.invokeMaxDepth, 10)));
    const maxElements = Math.min(3000, Math.max(10, safeInt(config.invokeMaxElements, 1200)));
    const { stdout } = await runPowerShell(
      buildInvokeScript({ pid, title, expectName, expectType, maxDepth, maxElements }),
      { timeoutMs },
    );
    const raw = JSON.parse(stdout.trim() || "{}");
    if (raw.error) return { ok: false, action, error: String(raw.error), element: raw.element, count: raw.count };
    return { ok: true, action, element: raw.element, window: raw.window, searched: raw.searched };
  }

  if (action === "type") {
    if (typeof args?.text !== "string" || !args.text) return { ok: false, action, error: "text is required" };
    const { stdout } = await runPowerShell(buildTypeScript({ pid, title, text: args.text }), { timeoutMs });
    const raw = JSON.parse(stdout.trim() || "{}");
    if (raw.error) return { ok: false, action, error: String(raw.error) };
    return { ok: true, action, window: raw.window, text: raw.typed };
  }

  const x = safeInt(args?.x, NaN), y = safeInt(args?.y, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, action, error: "click requires x and y" };
  const { stdout } = await runPowerShell(buildClickScript({ pid, title, x, y }), { timeoutMs });
  const raw = JSON.parse(stdout.trim() || "{}");
  if (raw.error) return { ok: false, action, error: String(raw.error) };
  return { ok: true, action, window: raw.window, point: raw.point };
}

export { parseHandle };
