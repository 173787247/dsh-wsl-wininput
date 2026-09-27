# dsh-wsl-wininput

DeepSeek Harness plugin: Targeted Windows input from WSL: invoke a UI Automation element, or send keys and clicks to a chosen window without stealing focus.

Part of **[dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit)**.

[中文说明 → README.zh.md](./README.zh.md)

## Install

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-wininput
```

## Usage

```
win_invoke action=invoke pid=1234 expectName="Save" expectType=Button
win_invoke action=type pid=1234 text="hello"
win_invoke action=click pid=1234 x=100 y=40
```

## Notes

`expectName` is **required** for `invoke`. Elements are found by name, and the
match must be unique: no match means the element is gone, more than one means the name
is too general to act on. Both are refusals, not best-effort clicks.

An earlier version took the element *index* from a `uia_tree` handle. Testing showed
two consecutive walks of a live window disagree about what sits at a given index, which
turned an invoke into a click on whatever had moved into that slot.

## Requirements

- Windows with WSL, and DeepSeek Harness running inside it.
- PowerShell reachable at the standard path (the plugin finds it itself).

## Tests

```sh
npm test
```

The unit tests run anywhere. The live tests are skipped outside WSL.

## License

MIT
