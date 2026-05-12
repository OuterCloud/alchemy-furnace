@AGENTS.md

# 项目开发原则

## 交互光标规范

所有可交互元素必须给用户明确的光标反馈：

- **可点击元素**（按钮、链接、可点击卡片等）：`cursor-pointer`
- **禁用元素**：`cursor-not-allowed`（不要用 `pointer-events-none`，那会让光标无法变化，体验差）
- **文本输入框**：浏览器默认的 `cursor-text`，不需要额外设置

实现方式：
- `Button` 组件的 base class 已包含 `cursor-pointer` 和 `disabled:cursor-not-allowed`，直接使用即可
- 其他自定义可点击元素（`div`、`li` 等）需手动加 `cursor-pointer`
- 不要在禁用按钮上手动叠加 `cursor-not-allowed opacity-50`，Button 组件已处理
