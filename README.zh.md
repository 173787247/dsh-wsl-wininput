# dsh-wsl-wininput

> 从 WSL 定向操作 Windows：按元素名调用 UI Automation 元素，或向指定窗口发送按键与点击，不抢焦点。

DeepSeek Harness 插件：Targeted Windows input from WSL: invoke a UI Automation element, or send keys and clicks to a chosen window without stealing focus.

属于 **[dsh-wsl-kit](https://github.com/173787247/dsh-wsl-kit)** 的一部分。

[English → README.md](./README.md)

## 安装

```sh
dsh plugin --profile web add github:173787247/dsh-wsl-wininput
```

## 用法

```
win_invoke action=invoke pid=1234 expectName="Save" expectType=Button
win_invoke action=type pid=1234 text="hello"
win_invoke action=click pid=1234 x=100 y=40
```

## 说明

`expectName` is **required** for `invoke`. Elements are found by name, and the
match must be unique: no match means the element is gone, more than one means the name
is too general to act on. Both are refusals, not best-effort clicks.

An earlier version took the element *index* from a `uia_tree` handle. Testing showed
two consecutive walks of a live window disagree about what sits at a given index, which
turned an invoke into a click on whatever had moved into that slot.

## 依赖

- Windows + WSL，DeepSeek Harness 跑在 WSL 里。
- PowerShell 位于标准路径（插件自己会找）。

## 测试

```sh
npm test
```

单元测试在任何平台都能跑；实时测试在 WSL 之外自动跳过。

## 许可

MIT
