const express = require("express");
const path = require("path");
const Database = require("./database");
const { JSDOM } = require("jsdom");

// 使用 node-fetch v3 的方式
const { default: fetch } = require("node-fetch");
const puppeteer = require("puppeteer");
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
const db = new Database();

// Middleware to parse JSON
app.use(express.json());

// Serve static files from src directory
app.use(express.static(path.join(__dirname, "src")));

// API endpoint to get cached articles
app.get("/api/articles", async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const articles = await db.getAllArticles(parseInt(limit), parseInt(offset));
    res.json(articles);
  } catch (error) {
    console.error("Error fetching articles:", error);
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

// API endpoint to get specific article
// API endpoint to save article
app.post("/api/article", async (req, res) => {
  try {
    const article = req.body;
    const result = await db.saveArticle(article);
    res.json(result);
  } catch (error) {
    console.error("Error saving article:", error);
    res.status(500).json({ error: "Failed to save article" });
  }
});

// API endpoint to get specific article
app.get("/api/article/:id", async (req, res) => {
  try {
    const article = await db.getArticleById(parseInt(req.params.id));
    if (article) {
      res.json(article);
    } else {
      res.status(404).json({ error: "Article not found" });
    }
  } catch (error) {
    console.error("Error fetching article:", error);
    res.status(500).json({ error: "Failed to fetch article" });
  }
});

// API endpoint to get multiple articles by IDs in batch
app.post("/api/articles/batch", async (req, res) => {
  try {
    const { ids } = req.body;

    // Validate input
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: "IDs array is required" });
    }

    // Limit batch size to prevent abuse
    if (ids.length > 100) {
      return res
        .status(400)
        .json({ error: "Maximum 100 IDs allowed per request" });
    }

    // Remove duplicates and ensure all IDs are integers
    const uniqueIds = [...new Set(ids.map((id) => parseInt(id)))].filter(
      (id) => !isNaN(id),
    );

    if (uniqueIds.length === 0) {
      return res.status(400).json({ error: "No valid IDs provided" });
    }

    // Fetch articles from database first
    const articles = [];

    // Use a more efficient approach: fetch all cached articles in one query
    if (uniqueIds.length > 0) {
      const placeholders = uniqueIds.map(() => "?").join(",");
      const query = `SELECT a.*, s.summary, s.model as summary_model 
        FROM articles a 
        LEFT JOIN ai_summaries s ON a.hn_id = s.article_id 
        WHERE a.hn_id IN (${placeholders})`;

      const cachedArticles = await new Promise((resolve, reject) => {
        db.db.all(query, uniqueIds, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });

      // Create a map for quick lookup
      const cachedMap = {};
      cachedArticles.forEach((article) => {
        cachedMap[article.hn_id] = article;
      });

      // Add cached articles to results and identify uncached IDs
      const uncachedIds = [];
      uniqueIds.forEach((id) => {
        if (cachedMap[id]) {
          articles.push(cachedMap[id]);
        } else {
          uncachedIds.push(id);
        }
      });

      // Fetch uncached articles from Hacker News API if any
      if (uncachedIds.length > 0) {
        // Fetch uncached articles from Hacker News API
        const promises = uncachedIds.map(async (id) => {
          try {
            const response = await fetch(
              `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
            );
            if (response.ok) {
              return await response.json();
            } else {
              console.error(
                `Failed to fetch article ${id}: ${response.status} ${response.statusText}`,
              );
              return null;
            }
          } catch (error) {
            console.error(`Error fetching article ${id}:`, error);
            return null;
          }
        });

        const fetchedArticles = await Promise.all(promises);

        // Filter out null results and save them to database
        for (const article of fetchedArticles) {
          if (article) {
            articles.push(article);

            // Save to database in the background
            try {
              await db.saveArticle(article);
            } catch (saveError) {
              console.error(
                `Error saving article ${article.id} to database:`,
                saveError,
              );
            }
          }
        }
      }
    }

    res.json(articles);
  } catch (error) {
    console.error("Error fetching articles in batch:", error);
    res.status(500).json({ error: "Failed to fetch articles in batch" });
  }
});

// API endpoint to save article
app.post("/api/article", async (req, res) => {
  try {
    const article = req.body;
    const result = await db.saveArticle(article);
    res.json(result);
  } catch (error) {
    console.error("Error saving article:", error);
    res.status(500).json({ error: "Failed to save article" });
  }
});

// API endpoint to save AI summary
app.post("/api/ai-summary", async (req, res) => {
  try {
    const { articleId, summary, model } = req.body;
    const result = await db.saveAISummary(articleId, summary, model);
    res.json(result);
  } catch (error) {
    console.error("Error saving AI summary:", error);
    res.status(500).json({ error: "Failed to save AI summary" });
  }
});

// API endpoint to get AI summary
app.get("/api/ai-summary/:articleId", async (req, res) => {
  try {
    const summary = await db.getAISummary(parseInt(req.params.articleId));
    if (summary) {
      res.json(summary);
    } else {
      res.status(404).json({ error: "AI summary not found" });
    }
  } catch (error) {
    console.error("Error fetching AI summary:", error);
    res.status(500).json({ error: "Failed to fetch AI summary" });
  }
});

// API endpoint to get multiple AI summaries by article IDs in batch
app.post("/api/ai-summaries/batch", async (req, res) => {
  try {
    const { articleIds } = req.body;

    // Validate input
    if (!articleIds || !Array.isArray(articleIds)) {
      return res.status(400).json({ error: "Article IDs array is required" });
    }

    // Limit batch size to prevent abuse
    if (articleIds.length > 100) {
      return res
        .status(400)
        .json({ error: "Maximum 100 article IDs allowed per request" });
    }

    // Remove duplicates and ensure all IDs are integers
    const uniqueIds = [...new Set(articleIds.map((id) => parseInt(id)))].filter(
      (id) => !isNaN(id),
    );

    if (uniqueIds.length === 0) {
      return res.status(400).json({ error: "No valid article IDs provided" });
    }

    // Build query to fetch multiple AI summaries
    const placeholders = uniqueIds.map(() => "?").join(",");
    const query = `SELECT * FROM ai_summaries WHERE article_id IN (${placeholders})`;

    const summaries = await new Promise((resolve, reject) => {
      db.db.all(query, uniqueIds, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    res.json(summaries);
  } catch (error) {
    console.error("Error fetching AI summaries in batch:", error);
    res.status(500).json({ error: "Failed to fetch AI summaries in batch" });
  }
});

// API endpoint to generate article summary on the server side
require("dotenv").config();
app.post("/api/generate-summary", async (req, res) => {
  try {
    const { content, title, model } = req.body;

    // 获取OpenAI配置
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    const defaultModel = process.env.OPENAI_MODEL || "gpt-3.5-turbo";

    if (!apiKey) {
      return res
        .status(400)
        .json({ error: "OpenAI API key not configured on server" });
    }

    // 使用服务器配置的模型，忽略前端传递的模型参数
    const finalModel = defaultModel;

    const prompt = `请提供以下文章的简洁中文摘要：

标题: ${title}

内容: ${content}

摘要（3-5个要点，用中文）：`;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: finalModel,
        messages: [
          {
            role: "system",
            content:
              "你是一个助手，能够用中文提供文章的简洁摘要，以3-5个要点突出关键信息。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(
        "OpenAI API error:",
        response.status,
        response.statusText,
        errorData,
      );
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`,
      );
    }

    const data = await response.json();

    // 检查API响应是否包含预期的结构
    if (
      !data.choices ||
      !data.choices[0] ||
      !data.choices[0].message ||
      !data.choices[0].message.content
    ) {
      console.error("Invalid response format from OpenAI API:", data);
      throw new Error(
        "Invalid response format from OpenAI API - choices not found",
      );
    }

    const summary = data.choices[0].message.content.trim();

    res.json({ summary });
  } catch (error) {
    console.error("Error generating summary:", error);
    res
      .status(500)
      .json({ error: `Failed to generate summary: ${error.message}` });
  }
});

// API endpoint to get content from URL with Puppeteer (for JavaScript-heavy sites)
app.get("/api/render-url-content", async (req, res) => {
  try {
    const { url } = req.query;

    // Validate URL
    if (!url) {
      return res.status(400).json({ error: "URL parameter is required" });
    }

    // Basic URL validation to prevent access to local resources
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return res
          .status(400)
          .json({ error: "Invalid protocol, only http and https are allowed" });
      }
    } catch (_urlError) {
      return res.status(400).json({ error: "Invalid URL format" });
    }

    // First, try to get content with Puppeteer (for JavaScript-heavy sites)
    try {
      // Launch puppeteer browser
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();

      // Set a realistic user agent
      await page.setUserAgent("Mozilla/5.0 (compatible; HackerNewsBot/1.0)");

      try {
        // Navigate to the URL and wait for network to be idle
        await page.goto(url, {
          waitUntil: "networkidle2",
          timeout: 30000, // 30 second timeout
        });

        // Extract the text content from the page after JavaScript execution
        const content = await page.evaluate(() => {
          // Remove script and style elements to avoid extracting their content
          const scripts = document.querySelectorAll("script, style, noscript");
          scripts.forEach((el) => el.remove());

          // Get the text content
          return document.body
            ? document.body.innerText
            : document.documentElement.innerText;
        });

        await browser.close();

        res.json({ content, url: url });
        return; // Exit here to prevent further execution
      } catch (navError) {
        await browser.close();
        console.warn(
          "Puppeteer navigation error, falling back to fetch: ",
          navError.message,
        );
        // Continue to the fallback mechanism
      }
    } catch (puppeteerError) {
      console.warn(
        "Puppeteer initialization error, falling back to fetch: ",
        puppeteerError.message,
      );
      // Continue to the fallback mechanism
    }

    // Fallback: try to get content with node-fetch and JSDOM
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; HackerNewsBot/1.0)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          "Accept-Encoding": "gzip, deflate",
          Connection: "keep-alive",
        },
      });

      if (!response.ok) {
        // 尝试获取错误内容
        let errorText = "";
        try {
          errorText = await response.text();
        } catch (_e) {
          // eslint-disable-line no-unused-vars
          // 忽略错误
        }
        return res.status(400).json({
          error: `Failed to fetch URL with fallback: ${response.status} ${response.statusText}, details: ${errorText}`,
        });
      }

      const html = await response.text();

      // Parse HTML and extract text content
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Remove script and style elements to avoid extracting their content
      const scripts = document.querySelectorAll("script, style, noscript");
      scripts.forEach((el) => el.remove());

      // Get the text content
      let textContent = document.body
        ? document.body.textContent
        : document.textContent;

      // Clean up the text content
      textContent = textContent
        .replace(/\s+/g, " ") // Replace multiple whitespaces with single space
        .trim();

      res.json({ content: textContent, url: url });
      return; // Exit here
    } catch (fetchError) {
      console.error("Error in fallback fetch mechanism:", fetchError);
      res.status(500).json({
        error: `Failed to render URL content with both Puppeteer and fetch: ${fetchError.message}`,
      });
      return;
    }
  } catch (error) {
    console.error("Error in render-url-content:", error);
    res
      .status(500)
      .json({ error: `Failed to render URL content: ${error.message}` });
  }
});

// API endpoint to get content from URL
app.get("/api/url-content", async (req, res) => {
  try {
    const { url } = req.query;

    // Validate URL
    if (!url) {
      return res.status(400).json({ error: "URL parameter is required" });
    }

    // Basic URL validation to prevent access to local resources
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return res
          .status(400)
          .json({ error: "Invalid protocol, only http and https are allowed" });
      }
    } catch (_urlError) {
      // eslint-disable-line no-unused-vars
      return res.status(400).json({ error: "Invalid URL format" });
    }

    // Fetch the content
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; HackerNewsBot/1.0)",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        Connection: "keep-alive",
      },
    });

    if (!response.ok) {
      // 尝试获取错误内容
      let errorText = "";
      try {
        errorText = await response.text();
      } catch (_e) {
        // eslint-disable-line no-unused-vars
        // 忽略错误
      }
      return res.status(400).json({
        error: `Failed to fetch URL: ${response.status} ${response.statusText}, details: ${errorText}`,
      });
    }

    const html = await response.text();

    // Parse HTML and extract text content
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Remove script and style elements to avoid extracting their content
    const scripts = document.querySelectorAll("script, style, noscript");
    scripts.forEach((el) => el.remove());

    // Get the text content
    let textContent = document.body
      ? document.body.textContent
      : document.textContent;

    // Clean up the text content
    textContent = textContent
      .replace(/\s+/g, " ") // Replace multiple whitespaces with single space
      .trim();

    res.json({ content: textContent, url: url });
  } catch (error) {
    console.error("Error fetching URL content:", error);
    res
      .status(500)
      .json({ error: `Failed to fetch content from URL: ${error.message}` });
  }
});

// Route to serve index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "src", "index.html"));
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down gracefully...");
  db.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Hacker News Reader is running at http://localhost:${PORT}`);
});
