# dsh-jyi-select-cite

聊天里选中一段文字，把它变成一条带位置与评价码的输入草稿。

## 缺口

DSH 内置的引用提供选区手势和紧凑预览。要把选中的聊天文字直接转成可编辑的评论草稿，它帮不上忙，位置标注、评价码、自由意见都得手工补齐。

## 这个仓库提供

选中聊天文字后，插件弹出浮层。浮层上方列出预置评价，可以按 E-code 搜索；下方是意见输入框。确认后插件把位置、引用块和意见追加进输入框草稿，发送者检查后发出。

仓库提交了一份示例表 `presets.example.json`，格式是 `[{ code, text }]`。要换成自己的表，把示例复制成 `presets.json` 再改；`presets.json` 已列入忽略清单，不会进仓库。改完下一次打开浮层就生效，既不用重启 DSH，也不用刷新页面。

## 使用

在聊天里选中一段文字，在浮层里搜索预置评价或直接写意见，按 Enter 把内容填入草稿，检查后发送。意见框支持 Shift+Enter 换行；按 Esc 或点击浮层外部可以关闭浮层。

## 依赖

客户端的锚点与弹层行为全部由 [dsh-jyi-hackyapi](https://github.com/jyi2ya/dsh-jyi-hackyapi) 提供。它好，本插件就好；它坏，本插件就坏。

DSH 只为直接装进 profile 的 bundle 建立层，包自己声明的依赖不会变成 profile 层。安装时请把两个包放在同一条命令里。

```sh
dsh plugin --profile <name> add github:jyi2ya/dsh-jyi-hackyapi github:jyi2ya/dsh-jyi-select-cite
```

## 限制

插件只在 DSH `0.2.2-rc.1` 上验证，其它版本不保证。代码按现状提供，不作任何担保。浮层固定 420 像素宽。

## 开发

宿主半边（`dist/index.js`）提供预置表路由，客户端半边（`lib/client.js`）提供浮层与草稿填充。客户端改动要刷新浏览器页面才生效，宿主改动走 HMR 热载。

```sh
dsh plugin --profile <name> add github:jyi2ya/dsh-jyi-select-cite
```

## 许可

本仓库采用 AGPL-3.0 或更新版本，全文见 [LICENSE](LICENSE)。
