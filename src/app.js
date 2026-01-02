// Database API client
const DB_API_BASE = "";

// Hacker News API Client
const API_BASE = "https://hacker-news.firebaseio.com/v0";

// OpenAI Configuration
let openAIConfig = {
  base_url: "https://api.openai.com/v1",
  api_key: "",
  model: "gpt-3.5-turbo",
};

// OpenAI configuration is handled on the server side
async function loadOpenAIConfig() {
  // Configuration is now handled on the server to avoid exposing API keys
  // We keep this function for backward compatibility, but it's not used for API keys
  try {
    const response = await fetch("openai_config.json");
    if (response.ok) {
      const config = await response.json();
      openAIConfig = { ...openAIConfig, ...config };
    }
  } catch (error) {
    console.warn(
      "Could not load OpenAI config, using default settings:",
      error,
    );
  }
}

// Call to load config when the app starts
loadOpenAIConfig();

// OpenAI API Client
class OpenAIClient {
  static async getArticleSummary(content, title) {
    // 通过后端API获取文章摘要，避免在前端暴露API密钥
    const response = await fetch(`${DB_API_BASE}/api/generate-summary`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: content,
        title: title,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.summary;
  }
}

class HackerNewsAPI {
  // 获取文章类型列表
  static async getStories(type = "topstories", limit = 100) {
    try {
      const response = await fetch(`${API_BASE}/${type}.json`);
      const ids = await response.json();
      // 限制请求数量以提高性能
      return ids.slice(0, limit);
    } catch (error) {
      console.error(`Error fetching ${type}:`, error);
      return [];
    }
  }

  // 检查文章是否已存在于本地数据库
  static async isArticleCached(id) {
    try {
      const response = await fetch(`${DB_API_BASE}/api/article/${id}`);
      return response.status === 200;
    } catch (error) {
      console.warn(`Error checking if article ${id} is cached:`, error);
      return false; // 如果数据库访问失败，假设未缓存
    }
  }

  // 获取单个文章详情，优先从数据库获取
  static async getItem(id) {
    // 首先尝试从数据库获取
    let article = await this.getArticleFromDB(id);

    if (article) {
      // 如果数据库中有AI摘要，也一并返回
      try {
        const summaryResponse = await fetch(
          `${DB_API_BASE}/api/ai-summary/${id}`,
        );
        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          article.ai_summary = summaryData.summary;
          article.summary_model = summaryData.model;
          article.summary_created_at = summaryData.created_at;
        }
      } catch (error) {
        console.warn(`Could not fetch AI summary for ${id}:`, error);
      }

      return article;
    }

    // 如果数据库中没有，则从Hacker News API获取
    try {
      const response = await fetch(`${API_BASE}/item/${id}.json`);
      article = await response.json();

      if (article) {
        // 保存到数据库
        try {
          await this.saveArticleToDB(article);
        } catch (saveError) {
          console.warn(`Could not save article ${id} to database:`, saveError);
        }
      }

      return article;
    } catch (error) {
      console.error(`Error fetching item ${id}:`, error);
      return null;
    }
  }

  // 从数据库获取文章
  static async getArticleFromDB(id) {
    try {
      const response = await fetch(`${DB_API_BASE}/api/article/${id}`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.warn(`Error fetching article ${id} from database:`, error);
      return null;
    }
  }

  // 保存文章到数据库
  static async saveArticleToDB(article) {
    try {
      const response = await fetch(`${DB_API_BASE}/api/article`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(article),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error saving article to database:", error);
      throw error;
    }
  }

  // 保存AI摘要到数据库
  static async saveAISummaryToDB(articleId, summary, model) {
    try {
      const response = await fetch(`${DB_API_BASE}/api/ai-summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ articleId, summary, model }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error saving AI summary to database:", error);
      throw error;
    }
  }

  // 并行获取多篇文章详情
  static async getItems(ids) {
    // 批量获取文章详情，优先使用后端批量API端点
    try {
      // 使用后端提供的批量获取API端点，更高效
      const response = await fetch(`${DB_API_BASE}/api/articles/batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids }),
      });

      if (response.ok) {
        const articles = await response.json();

        // 批量获取AI摘要以减少请求数量
        // 首先检查哪些文章已经包含AI摘要信息（从数据库直接获取的）
        const articlesWithSummary = [];
        const missingSummaryIds = [];

        // 分离已有AI摘要的文章和没有AI摘要的文章
        articles.forEach((article) => {
          // 如果文章已经包含从数据库获取的AI摘要信息（summary和summary_model字段）
          if (article.summary != null && article.summary_model != null) {
            // 将数据库中的摘要信息复制到标准字段
            article.ai_summary = article.summary;
            article.summary_model = article.summary_model;
            article.summary_created_at = article.created_at; // 注意：这可能不是摘要创建时间，但暂用此字段
            articlesWithSummary.push(article);
          } else {
            // 需要额外获取AI摘要
            missingSummaryIds.push(article.id);
            articlesWithSummary.push(article); // 先添加到结果中
          }
        });

        if (missingSummaryIds.length > 0) {
          try {
            const summaryResponse = await fetch(
              `${DB_API_BASE}/api/ai-summaries/batch`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ articleIds: missingSummaryIds }),
              },
            );

            if (summaryResponse.ok) {
              const summaries = await summaryResponse.json();

              // 将摘要映射到对应的文章
              const summaryMap = {};
              summaries.forEach((summary) => {
                summaryMap[summary.article_id] = summary;
              });

              // 更新缺少摘要的文章
              articlesWithSummary.forEach((article) => {
                if (!article.ai_summary) {
                  // 只为没有摘要的文章添加
                  const summary = summaryMap[article.id];
                  if (summary) {
                    article.ai_summary = summary.summary;
                    article.summary_model = summary.model;
                    article.summary_created_at = summary.created_at;
                  }
                }
              });
            }
          } catch (summaryError) {
            console.warn(
              "Could not fetch AI summaries in batch:",
              summaryError,
            );
          }
        }

        return articlesWithSummary;
      } else {
        console.warn("Batch API failed, falling back to individual requests");
      }
    } catch (error) {
      console.warn(
        "Batch API request failed, falling back to individual requests:",
        error,
      );
    }

    // Fallback to original implementation if batch API is unavailable
    // 对于已缓存的文章，我们直接从数据库快速获取
    const uncachedIds = [];
    const results = [];

    // 批量获取AI摘要以减少请求数量
    const cachedIds = [];
    for (const id of ids) {
      const cached = await this.getArticleFromDB(id);
      if (cached) {
        results.push(cached);
        cachedIds.push(id);
      } else {
        uncachedIds.push(id);
      }
    }

    // 批量获取缓存文章的AI摘要
    if (cachedIds.length > 0) {
      try {
        const summaryResponse = await fetch(
          `${DB_API_BASE}/api/ai-summaries/batch`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ articleIds: cachedIds }),
          },
        );

        if (summaryResponse.ok) {
          const summaries = await summaryResponse.json();

          // 将摘要映射到对应的文章
          const summaryMap = {};
          summaries.forEach((summary) => {
            summaryMap[summary.article_id] = summary;
          });

          // 更新结果数组中的文章
          results.forEach((cached) => {
            const summary = summaryMap[cached.id];
            if (summary) {
              cached.ai_summary = summary.summary;
              cached.summary_model = summary.model;
              cached.summary_created_at = summary.created_at;
            }
          });
        }
      } catch (summaryError) {
        console.warn(
          "Could not fetch cached AI summaries in batch:",
          summaryError,
        );

        // 如果批量获取失败，回退到单独获取每篇缓存文章的AI摘要
        for (const cached of results) {
          try {
            const summaryResponse = await fetch(
              `${DB_API_BASE}/api/ai-summary/${cached.id}`,
            );
            if (summaryResponse.ok) {
              const summaryData = await summaryResponse.json();
              cached.ai_summary = summaryData.summary;
              cached.summary_model = summaryData.model;
              cached.summary_created_at = summaryData.created_at;
            }
          } catch (error) {
            console.warn(`Could not fetch AI summary for ${cached.id}:`, error);
          }
        }
      }
    }

    // 对于未缓存的文章，从Hacker News API获取
    if (uncachedIds.length > 0) {
      const promises = uncachedIds.map((id) => this.getItem(id));
      const newItems = await Promise.allSettled(promises);

      // 过滤掉失败的项并添加到结果中
      const successfulNewItems = newItems
        .filter((result) => result.status === "fulfilled" && result.value)
        .map((result) => result.value);

      results.push(...successfulNewItems);
    }

    return results;
  }
}

// 文章显示组件
class ArticleRenderer {
  static renderArticle(article) {
    if (!article || !article.title) return "";

    const score = article.score || 0;
    const time = this.formatTime(article.time);
    const url = article.url || "#";
    const domain = url ? this.extractDomain(url) : "";
    const commentsCount = article.descendants || 0;

    const typeClass = this.getTypeClass(article.type);
    const typeLabel = this.getTypeLabel(article.type);

    return `
      <div class="article-card frosted-glass dual-stroke bg-white/60 rounded-[16px] p-3 shadow-md">
        <div class="flex items-start">
          <div class="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full ${typeClass} mr-2">
            <span class="text-white font-bold text-xs">${typeLabel.charAt(0)}</span>
          </div>
          <div class="flex-1">
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <h3 class="text-base font-bold text-gray-900 mb-1">
                  <a href="${url}" target="_blank" rel="noopener noreferrer" class="hover:underline">
                    ${this.escapeHtml(article.title)}
                  </a>
                </h3>
                ${domain ? `<p class="text-gray-500 text-xs mb-1 truncate">${this.escapeHtml(domain)}</p>` : ""}
                <div class="flex items-center text-xs text-gray-600 space-x-2">
                  <span class="flex items-center">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                    </svg>
                    ${score} pts
                  </span>
                  <span class="flex items-center">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
                    </svg>
                    ${time}
                  </span>
                  <span class="flex items-center">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd" />
                    </svg>
                    ${commentsCount} cmts
                  </span>
                  <span class="px-1 py-0.5 bg-gray-100 rounded text-[0.6rem] font-bold uppercase tracking-widest">
                    ${typeLabel}
                  </span>
                </div>
                ${
                  article.text
                    ? `
                  <div class="mt-1 text-gray-700 text-xs">
                    <p class="line-clamp-2">${this.truncateText(this.stripHtml(article.text), 120)}</p>
                  </div>
                `
                    : ""
                }
                ${
                  article.by
                    ? `
                  <div class="mt-1 flex items-center">
                    <span class="text-xs text-gray-600">
                      by <span class="font-semibold text-gray-800 truncate max-w-[80px]">${this.escapeHtml(article.by)}</span>
                    </span>
                  </div>
                `
                    : ""
                }
              </div>
              <button 
                class="ai-summary-btn ml-3 px-2 py-1 dual-stroke bg-white/70 rounded text-[0.6rem] font-medium text-gray-700 active:scale-[0.98] transition-transform duration-200"
                data-article-id="${article.id}"
              >
                ${article.ai_summary ? "Regenerate" : "AI Summary"}
              </button>
            </div>
            <div id="ai-summary-${article.id}" class="ai-summary-content ${article.ai_summary ? "" : "hidden"} mt-2 p-2 bg-gray-100/50 rounded-lg text-xs text-gray-700">
              ${
                article.ai_summary
                  ? `
                <div class="font-semibold mb-1 flex items-center">
                  <svg class="w-3 h-3 mr-1 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                  </svg>
                  AI Summary
                </div>
                <div class="ai-summary-text">${ArticleRenderer.formatSummaryAsHTML(article.ai_summary)}</div>
                <div class="mt-2 text-[0.5rem] text-gray-500 italic">Generated by ${article.summary_model || openAIConfig.model}</div>
              `
                  : ""
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }

  static getTypeClass(type) {
    switch (type) {
      case "story":
        return "bg-blue-500";
      case "job":
        return "bg-green-500";
      case "ask_hn":
        return "bg-purple-500";
      case "poll":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  }

  static getTypeLabel(type) {
    switch (type) {
      case "ask_hn":
        return "Ask HN";
      case "show_hn":
        return "Show HN";
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  }

  static formatTime(timestamp) {
    const now = Date.now() / 1000;
    const diff = now - timestamp;

    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;

    return new Date(timestamp * 1000).toLocaleDateString();
  }

  static extractDomain(url) {
    try {
      const domain = new URL(url).hostname.replace("www.", "");
      return domain;
    } catch {
      return "";
    }
  }

  static escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  static stripHtml(html) {
    if (!html) return "";
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  }

  static truncateText(text, maxLength) {
    if (!text) return "";
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  }

  static formatSummaryAsHTML(summary) {
    // 将AI返回的摘要转换为HTML格式，支持markdown格式
    if (!summary) return "";

    // 处理markdown格式的粗体和斜体
    let html = summary
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // **bold**
      .replace(/\*(.*?)\*/g, "<em>$1</em>") // *italic*
      .replace(/__(.*?)__/g, "<strong>$1</strong>") // __bold__
      .replace(/_(.*?)_/g, "<em>$1</em>"); // _italic_

    // 按行分割并处理列表项
    return html
      .split("\n")
      .map((line) => {
        line = line.trim();
        if (!line) return '<div class="my-1"><br></div>'; // 空行

        // 检查是否是列表项
        if (
          line.startsWith("- ") ||
          line.startsWith("* ") ||
          /^\d+\./.test(line)
        ) {
          return `<div class="ml-2 my-1">• ${line.substring(2).replace(/^\d+\.\s*/, "")}</div>`;
        }

        // 检查是否是标题
        if (line.startsWith("# ")) {
          return `<h3 class="font-bold text-sm mt-2 mb-1">${line.substring(2)}</h3>`;
        } else if (line.startsWith("## ")) {
          return `<h4 class="font-bold text-xs mt-2 mb-1">${line.substring(3)}</h4>`;
        }

        // 检查是否包含链接
        const linkRegex = /(https?:\/\/[^\s]+)/g;
        if (linkRegex.test(line)) {
          line = line.replace(
            linkRegex,
            '<a href="$1" target="_blank" class="text-blue-500 hover:underline">$1</a>',
          );
        }

        return `<div class="my-1">${line}</div>`;
      })
      .join("");
  }
}

// 主应用类
class HackerNewsApp {
  constructor() {
    this.articles = [];
    this.filteredArticles = [];
    this.currentFilter = "all";
    this.currentSearch = "";
    this.articlesPerPage = 20;
    this.currentPage = 0;

    this.initializeElements();
    this.bindEvents();
    this.loadInitialData();
  }

  initializeElements() {
    this.searchInput = document.getElementById("searchInput");
    this.searchBtn = document.getElementById("searchBtn");
    this.articlesContainer = document.getElementById("articlesContainer");
    this.loadingElement = document.getElementById("loading");
    this.loadMoreContainer = document.getElementById("loadMoreContainer");
    this.loadMoreBtn = document.getElementById("loadMoreBtn");
    this.filterButtons = document.querySelectorAll(".filter-btn");
  }

  bindEvents() {
    this.searchBtn.addEventListener("click", () => this.performSearch());
    this.searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.performSearch();
      }
    });

    this.loadMoreBtn.addEventListener("click", () => this.loadMore());

    this.filterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.filterButtons.forEach((b) =>
          b.classList.remove("bg-[#1C1C1E]", "text-white"),
        );
        btn.classList.add("bg-[#1C1C1E]", "text-white");
        this.currentFilter = btn.dataset.type;
        this.applyFilters();
      });
    });

    // 为AI总结按钮添加事件委托
    this.articlesContainer.addEventListener("click", async (e) => {
      if (e.target.classList.contains("ai-summary-btn")) {
        const articleId = e.target.dataset.articleId;
        await this.handleAISummary(articleId);
      }
    });
  }

  async handleAISummary(articleId) {
    const btn = document.querySelector(`[data-article-id="${articleId}"]`);
    const summaryContainer = document.getElementById(`ai-summary-${articleId}`);

    if (!btn || !summaryContainer) return;

    // 防止重复点击
    if (btn.disabled || summaryContainer.classList.contains("loading")) return;

    try {
      // 显示加载状态
      btn.disabled = true;
      btn.textContent = "...";
      summaryContainer.classList.remove("hidden");
      summaryContainer.classList.add("loading");
      summaryContainer.innerHTML =
        '<div class="text-blue-500">Generating AI summary...</div>';

      // 首先检查数据库中是否已有AI摘要
      let summary = null;
      try {
        const summaryResponse = await fetch(
          `${DB_API_BASE}/api/ai-summary/${articleId}`,
        );
        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          summary = summaryData.summary;

          // 如果数据库中有摘要，直接使用
          summaryContainer.innerHTML = `
            <div class="font-semibold mb-1 flex items-center">
              <svg class="w-3 h-3 mr-1 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
              </svg>
              AI Summary (from cache)
            </div>
            <div class="ai-summary-text">${ArticleRenderer.formatSummaryAsHTML(summary)}</div>
            <div class="mt-2 text-[0.5rem] text-gray-500 italic">Generated by ${summaryData.model}</div>
          `;

          // 更新按钮状态
          btn.textContent = "AI Summary";
          btn.classList.add("text-green-600");
          return;
        }
      } catch (dbError) {
        console.warn(
          "Could not fetch cached summary, will generate new one:",
          dbError,
        );
      }

      // 获取文章详细信息
      let article = this.articles.find((a) => a.id == articleId);

      // 如果没有在内存中找到，尝试从数据库获取
      if (!article) {
        article = await HackerNewsAPI.getArticleFromDB(articleId);
      }

      if (!article) {
        throw new Error("Article not found");
      }

      // 使用API获取文章内容
      let content = article.text || "";

      // 如果没有内容但有URL，尝试从URL获取实际内容
      if (!content && article.url) {
        try {
          // 显示获取URL内容的进度
          summaryContainer.innerHTML =
            '<div class="text-blue-500">Fetching content from URL...</div>';

          // 使用后端无头浏览器API获取内容，可以处理JavaScript渲染的页面
          const response = await fetch(
            `${DB_API_BASE}/api/render-url-content?url=${encodeURIComponent(article.url)}`,
          );

          if (response.ok) {
            const data = await response.json();
            content = data.content;

            // 清理文本内容
            content = content
              .replace(/\s+/g, " ") // 将多个空白字符替换为单个空格
              .trim();

            // 确保内容不是太长，如果太长则截断
            if (content.length > 10000) {
              // 限制为10000字符
              content =
                content.substring(0, 10000) +
                "... [Content truncated due to length]";
            }
          } else {
            // 如果获取URL内容失败，使用原文URL和标题作为fallback
            console.warn(
              `Failed to fetch content with backend API: ${response.status} ${response.statusText}`,
            );
            content = `External link: ${article.url}. Title: ${article.title}. Content not available.`;
          }
        } catch (urlError) {
          console.warn(
            "Could not fetch content from URL via backend API, using fallback:",
            urlError,
          );
          // 如果通过后端API获取URL内容失败，使用原文URL和标题作为fallback
          content = `External link: ${article.url}. Title: ${article.title}. Content not available.`;
        }
      }

      // 如果仍然没有内容，使用标题
      if (!content) {
        content = `Title: ${article.title}. No content available.`;
      }

      // 调用OpenAI API获取摘要
      summary = await OpenAIClient.getArticleSummary(content, article.title);

      // 保存AI摘要到数据库
      try {
        await HackerNewsAPI.saveAISummaryToDB(
          articleId,
          summary,
          openAIConfig.model,
        );
      } catch (saveError) {
        console.error("Could not save AI summary to database:", saveError);
      }

      // 显示摘要
      summaryContainer.innerHTML = `
        <div class="font-semibold mb-1 flex items-center">
          <svg class="w-3 h-3 mr-1 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>
          AI Summary
        </div>
        <div class="ai-summary-text">${ArticleRenderer.formatSummaryAsHTML(summary)}</div>
        <div class="mt-2 text-[0.5rem] text-gray-500 italic">Generated by ${openAIConfig.model}</div>
      `;

      // 更新按钮状态
      btn.textContent = "Regenerate";
      btn.classList.add("text-green-600");
    } catch (error) {
      console.error("Error generating AI summary:", error);
      summaryContainer.innerHTML = `<div class="text-red-500 text-xs">Error: ${error.message}</div>`;
      btn.textContent = "AI Summary";

      // 服务器端会处理API密钥验证，这里不因API密钥问题禁用按钮
      if (error.message.includes("API key")) {
        btn.disabled = false; // 服务器端处理密钥检查，按钮保持可用
        btn.title = "";
        btn.textContent = "AI Summary";
      } else {
        btn.disabled = false;
      }
    } finally {
      btn.disabled = false;
      summaryContainer.classList.remove("loading");
    }
  }

  formatSummaryAsHTML(summary) {
    // 将AI返回的摘要转换为HTML格式，特别是处理项目符号
    return summary
      .split("\n")
      .map((line) => {
        // 检查是否是列表项
        if (
          line.trim().startsWith("- ") ||
          line.trim().startsWith("* ") ||
          /^\d+\./.test(line.trim())
        ) {
          return `<div class="ml-2">• ${line
            .trim()
            .substring(2)
            .replace(/^\d+\.\s*/, "")}</div>`;
        }
        return `<div>${line}</div>`;
      })
      .join("");
  }

  async loadInitialData() {
    this.showLoading();
    try {
      // 获取前30个热门文章ID（减少初始加载量以提升性能）
      const topIds = await HackerNewsAPI.getStories("topstories", 30);
      // 获取前20个新文章ID（减少初始加载量以提升性能）
      const newIds = await HackerNewsAPI.getStories("newstories", 20);
      // 获取前20个最佳文章ID（减少初始加载量以提升性能）
      const bestIds = await HackerNewsAPI.getStories("beststories", 20);

      // 合并所有ID并去重
      const allIds = [...new Set([...topIds, ...newIds, ...bestIds])];

      // 获取文章详情
      this.articles = await HackerNewsAPI.getItems(allIds);
      this.filteredArticles = this.articles;

      // 按时间排序（最新的在前）
      this.filteredArticles.sort((a, b) => (b.time || 0) - (a.time || 0));

      this.renderArticles();
    } catch (error) {
      console.error("Error loading initial data:", error);
    } finally {
      this.hideLoading();
    }
  }

  performSearch() {
    const searchTerm = this.searchInput.value.trim().toLowerCase();
    this.currentSearch = searchTerm;

    this.showLoading();

    // 异步执行搜索以避免阻塞UI
    setTimeout(() => {
      this.applyFilters();
      this.hideLoading();
    }, 100);
  }

  applyFilters() {
    let results = this.articles;

    // 应用类型过滤
    if (this.currentFilter !== "all") {
      const filterType =
        this.currentFilter === "ask_hn" ? "story" : this.currentFilter;
      results = results.filter((article) => {
        if (this.currentFilter === "ask_hn") {
          return (
            article.type === "story" &&
            (article.title.toLowerCase().includes("ask hn") ||
              (article.text && article.text.toLowerCase().includes("ask hn")))
          );
        }
        return article.type === filterType;
      });
    }

    // 应用搜索关键词过滤
    if (this.currentSearch) {
      const searchTerms = this.currentSearch.toLowerCase().split(" ");
      results = results.filter((article) => {
        if (!article.title) return false;

        const title = article.title.toLowerCase();
        const text = article.text
          ? this.stripHtml(article.text).toLowerCase()
          : "";

        return searchTerms.some(
          (term) => title.includes(term) || text.includes(term),
        );
      });
    }

    this.filteredArticles = results;
    this.currentPage = 0;

    // 按时间排序（最新的在前）
    this.filteredArticles.sort((a, b) => (b.time || 0) - (a.time || 0));

    this.renderArticles();
    this.updateLoadMoreButton();
  }

  renderArticles() {
    const startIndex = this.currentPage * this.articlesPerPage;
    const endIndex = Math.min(
      startIndex + this.articlesPerPage,
      this.filteredArticles.length,
    );
    const articlesToShow = this.filteredArticles.slice(startIndex, endIndex);

    if (articlesToShow.length === 0) {
      this.articlesContainer.innerHTML = `
        <div class="text-center py-6">
          <div class="frosted-glass dual-stroke bg-white/60 rounded-xl p-4 inline-block">
            <svg class="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 class="text-lg font-bold mt-2 text-gray-800">No articles found</h3>
            <p class="text-gray-600 text-sm mt-1">Try adjusting your search or filter criteria</p>
          </div>
        </div>
      `;
      return;
    }

    const articlesHTML = articlesToShow
      .map((article) => ArticleRenderer.renderArticle(article))
      .join("");

    if (this.currentPage === 0) {
      this.articlesContainer.innerHTML = articlesHTML;
    } else {
      this.articlesContainer.innerHTML += articlesHTML;
    }
  }

  loadMore() {
    this.currentPage++;
    this.renderArticles();
    this.updateLoadMoreButton();
  }

  updateLoadMoreButton() {
    const totalLoaded = (this.currentPage + 1) * this.articlesPerPage;
    const hasMore = totalLoaded < this.filteredArticles.length;

    // 修正：确保按钮的显示逻辑正确
    if (hasMore) {
      this.loadMoreContainer.classList.remove("hidden");
    } else {
      this.loadMoreContainer.classList.add("hidden");
    }
  }

  showLoading() {
    this.loadingElement.classList.remove("hidden");
  }

  hideLoading() {
    this.loadingElement.classList.add("hidden");
  }

  stripHtml(html) {
    if (!html) return "";
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  }
}

// 初始化应用
document.addEventListener("DOMContentLoaded", () => {
  new HackerNewsApp();
});
