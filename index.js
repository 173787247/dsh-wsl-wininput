import { detectWsl } from "./lib/wsl-host.js";
import * as core from "./lib/wininput.js";
import { execute } from "./lib/wininput-exec.js";

export const name = "dsh-wsl-wininput";
export const inject = ["tools", "systemPrompt"];

export function apply(ctx, config = {}) {
  const wsl = detectWsl();

  ctx.systemPrompt.section({
    name: "tool:win_invoke",
    order: 211,
    text: "Use win_invoke to act on Windows UI from WSL. action=invoke activates a UI Automation element by the handle uia_tree returned; the element is re-checked before it is invoked, so a handle from an older observation fails instead of clicking the wrong control. action=type and action=click target a window by pid.",
  });

  ctx.tools.register({
    name: "win_invoke",
    description: "Targeted Windows input from WSL: invoke a UI Automation element by handle, type text into a window, or click a window-relative point.",
    parameters: core.parameters(),
    output: {
      schema: core.outputSchema(),
      render: (_args, value) => [{ type: "text", text: core.format(value) }],
    },
    timeoutMs: Number(config.timeoutMs) > 0 ? Number(config.timeoutMs) : 30_000,
    isConcurrencySafe: () => false,
    async execute(args) {
      if (!wsl) return { ok: false, action: args?.action ?? "invoke", error: "not running in WSL" };
      try {
        return await execute(args, config);
      } catch (error) {
        return { ok: false, action: args?.action ?? "invoke", error: String(error?.message ?? error) };
      }
    },
    presentCall: (args) => ({ card: "generic", title: `win_invoke ${args?.action ?? "invoke"}` }),
    presentResult: (_args, result) => ({ card: "generic", title: "win_invoke", content: result?.content }),
  });
}
