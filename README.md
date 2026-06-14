# AA 分账 MVP

纯前端 Web App：多笔支出、净额结算、贪心算法最小化转账次数。

## 功能

- 创建/管理多个分账活动
- 添加人员、记录支出（付款人可不在参与人中）
- 默认均分，金额内部以「分」整数计算
- 自动计算净余额 + 最少转账方案
- `localStorage` 持久化，刷新不丢数据
- 一键加载 ABCDE 示例

## 本地运行

ES Module 需要 HTTP 服务，不能直接双击 `index.html`。

### 方式一：Python（推荐）

```bash
python -m http.server 53208
```

将端口号换成任意未被占用的端口即可。浏览器打开 http://localhost:53208

### 方式二：Node.js

```bash
npx serve .
```

## 部署到 Cloudflare Pages（免费）

1. 将本仓库推送到 GitHub
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → Pages → Create a project
3. 连接 GitHub 仓库，构建设置：
   - **Build command**: 留空
   - **Build output directory**: `/`
4. 部署完成后即可通过 `*.pages.dev` 访问

也可直接用 Wrangler CLI：

```bash
npx wrangler pages deploy . --project-name aa-splitter
```

## 文件结构

```
├── index.html      # 入口
├── app.js          # UI + localStorage
├── settlement.js   # 净余额 + 贪心简化算法
├── styles.css      # 样式
└── README.md
```

## 算法说明

1. **净余额**：每笔支出中，付款人 +全额，各参与人 −均分份额
2. **贪心简化**：每次让最大债务人向最大债权人转账，直到全部结清
3. 转账笔数上限为 `n − 1`（n = 有余额的人数），此贪心方案最优

## 示例场景

| 支出 | 付款人 | 参与人 | 金额 |
|------|--------|--------|------|
| 吃饭 | A | A,B,C,D | ¥100 |
| 打车 | B | B,C,D,E | ¥100 |
| 电影 | C | A,C,E | ¥100 |

点击「加载示例」可自动填入并查看结算结果。
