# Hacker News Quick Reader

一个用于浏览 Hacker News 文章的现代化网页应用，具备强大的搜索和过滤功能，采用 Zen-iOS Hybrid 设计理念打造精美界面。

## 主要特性

- **现代化UI**：采用 Zen-iOS Hybrid 设计理念，提供高端视觉体验
- **实时数据**：从 Hacker News API 获取最新文章
- **智能搜索**：按关键词搜索文章标题和内容
- **类型过滤**：按文章类型筛选（新闻、招聘、Ask HN、投票）
- **AI 内容摘要**：使用 OpenAI API 生成文章智能摘要
- **本地数据库**：SQLite 数据库缓存文章和 AI 摘要
- **响应式布局**：大屏幕下采用双栏布局
- **紧凑设计**：优化间距的高密度信息显示
- **响应式适配**：支持所有设备尺寸
- **高性能**：优化的加载和渲染性能，支持缓存

## 技术栈

- **前端**：原生 JavaScript，支持现代 ES6+ 特性
- **后端**：Node.js + Express.js
- **样式**：Tailwind CSS
- **数据库**：SQLite3
- **浏览器自动化**：Puppeteer（用于提取 JavaScript 渲染的页面内容）
- **DOM 操作**：JSDOM
- **HTTP 请求**：node-fetch
- **设计风格**：采用 Zen-iOS Hybrid 设计语言

## 快速开始

### 环境要求

- Node.js 18 或更高版本
- npm 包管理器

### 安装步骤

1. 克隆项目仓库

   ```bash
   git clone <your-repo-url>
   cd hacker-news-quick-read
   ```

2. 安装依赖

   ```bash
   npm install
   ```

3. 配置环境变量
   - 复制 `.env.example` 文件为 `.env`
   - 编辑 `.env` 文件，添加你的 OpenAI API 密钥:
     ```
     OPENAI_API_KEY=your_openai_api_key_here
     OPENAI_BASE_URL=https://api.openai.com/v1
     OPENAI_MODEL=gpt-3.5-turbo
     ```

   ⚠️ **安全提醒**：`.env` 文件不会被 Git 跟踪，保护你的 API 密钥安全

4. 启动应用
   - 开发模式：`npm run dev` (需要 nodemon)
   - 生产模式：`npm start` 或 `node server.js`

5. 打开浏览器访问 `http://localhost:3000`

## 环境变量

应用支持以下环境变量：

- `OPENAI_API_KEY` - OpenAI API 密钥（AI 摘要功能必需）
- `OPENAI_BASE_URL` - OpenAI 服务地址（默认：https://api.openai.com/v1）
- `OPENAI_MODEL` - OpenAI 模型（默认：gpt-3.5-turbo）
- `PORT` - 服务端口（默认：3000）

## API 接口说明

应用提供了以下后端 API 接口：

### 文章相关 API

- `GET /api/articles` - 获取缓存的文章列表
  - 参数：`limit`（限制数量，默认100）、`offset`（偏移量）
- `GET /api/article/:id` - 获取特定文章详情
- `POST /api/article` - 保存文章到数据库

### AI 摘要相关 API

- `POST /api/generate-summary` - 生成文章 AI 摘要
  - 参数：`content`（文章内容）、`title`（文章标题）
- `POST /api/ai-summary` - 保存 AI 摘要到数据库
  - 参数：`articleId`、`summary`、`model`
- `GET /api/ai-summary/:articleId` - 获取特定文章的 AI 摘要

### 内容提取 API

- `GET /api/render-url-content` - 渲染并提取 URL 内容（使用 Puppeteer）
  - 参数：`url`（目标 URL）
- `GET /api/url-content` - 提取 URL 内容（使用 JSDOM）
  - 参数：`url`（目标 URL）

## 设计语言

本应用采用 **Zen-iOS Hybrid** 设计语言，具有以下特点：

- **玻璃态效果**：使用 backdrop-filter 实现毛玻璃效果
- **双重边框**：物理感的内外边框设计
- **iOS 式圆角**：遵循 iOS 设计规范的圆角
- **高对比度**：深色模式启发的深空灰黑色调
- **触觉反馈**：交互元素具有缩放反馈
- **呼吸空间**：合理的内边距和留白提升可读性

## 部署方式

### GitHub Pages 部署

应用已配置通过 GitHub Actions 部署到 GitHub Pages。

### Docker 部署

应用包含 Dockerfile，支持容器化部署：

```bash
# 构建镜像
docker build -t hacker-news-quick-read .

# 运行容器
docker run -p 3000:3000 -e OPENAI_API_KEY=your_openai_api_key_here hacker-news-quick-read
```

### Heroku 部署

支持一键部署到 Heroku，或手动部署：

```bash
heroku login
heroku create
git push heroku main
heroku open
```

设置环境变量：

```bash
heroku config:set OPENAI_API_KEY=your_openai_api_key_here
heroku config:set OPENAI_BASE_URL=https://api.openai.com/v1
heroku config:set OPENAI_MODEL=gpt-3.5-turbo
```

## 开发说明

- 前端代码位于 `src/app.js`
- 后端代码位于 `server.js`
- 数据库操作封装在 `database.js`
- 用户界面位于 `src/index.html`

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。
