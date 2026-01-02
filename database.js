const sqlite3 = require('sqlite3').verbose();
const path = require('path'); // eslint-disable-line no-unused-vars

class Database {
  constructor(dbPath = './hacker_news.db') {
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
      } else {
        console.log('Connected to SQLite database');
        this.init();
      }
    });
  }

  init() {
    // 创建文章表
    const createArticlesTable = `CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY,
      hn_id INTEGER UNIQUE,
      title TEXT NOT NULL,
      url TEXT,
      domain TEXT,
      score INTEGER DEFAULT 0,
      time INTEGER,
      type TEXT,
      author TEXT,
      descendants INTEGER DEFAULT 0,
      content TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`;
    
    // 创建AI摘要表
    const createAISummariesTable = `CREATE TABLE IF NOT EXISTS ai_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER,
      summary TEXT,
      model TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (article_id) REFERENCES articles (hn_id)
    )`;
    
    this.db.run(createArticlesTable, (err) => {
      if (err) {
        console.error('Error creating articles table:', err.message);
      } else {
        console.log('Articles table ready');
      }
    });
    
    this.db.run(createAISummariesTable, (err) => {
      if (err) {
        console.error('Error creating AI summaries table:', err.message);
      } else {
        console.log('AI summaries table ready');
      }
    });
    
    // 创建更新时间触发器
    const updateTrigger = `CREATE TRIGGER IF NOT EXISTS update_articles_timestamp 
      AFTER UPDATE ON articles 
      BEGIN 
        UPDATE articles SET updated_at = CURRENT_TIMESTAMP WHERE hn_id = NEW.hn_id; 
      END`;
    
    this.db.run(updateTrigger, (err) => {
      if (err) {
        console.error('Error creating update trigger:', err.message);
      }
    });
  }

  // 检查文章是否已存在
  async articleExists(hnId) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT hn_id FROM articles WHERE hn_id = ?', [hnId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(!!row);
        }
      });
    });
  }

  // 保存文章
  async saveArticle(article) {
    const exists = await this.articleExists(article.id);
    
    if (exists) {
      // 更新现有文章
      const updateQuery = `UPDATE articles SET 
        title = ?, url = ?, domain = ?, score = ?, time = ?, type = ?, author = ?, descendants = ?, content = ?
        WHERE hn_id = ?`;
      
      return new Promise((resolve, reject) => {
        this.db.run(updateQuery, [
          article.title || '',
          article.url || '',
          article.domain || '',
          article.score || 0,
          article.time || 0,
          article.type || '',
          article.by || '',
          article.descendants || 0,
          article.text || '',
          article.id
        ], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, updated: true });
          }
        });
      });
    } else {
      // 插入新文章
      const insertQuery = `INSERT INTO articles 
        (hn_id, title, url, domain, score, time, type, author, descendants, content) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      
      return new Promise((resolve, reject) => {
        this.db.run(insertQuery, [
          article.id,
          article.title || '',
          article.url || '',
          article.domain || '',
          article.score || 0,
          article.time || 0,
          article.type || '',
          article.by || '',
          article.descendants || 0,
          article.text || ''
        ], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, updated: false });
          }
        });
      });
    }
  }

  // 保存AI摘要
  async saveAISummary(articleId, summary, model) {
    const insertQuery = 'INSERT INTO ai_summaries (article_id, summary, model) VALUES (?, ?, ?)';
    
    return new Promise((resolve, reject) => {
      this.db.run(insertQuery, [articleId, summary, model], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID });
        }
      });
    });
  }

  // 获取AI摘要
  async getAISummary(articleId) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT summary, model, created_at FROM ai_summaries WHERE article_id = ?', [articleId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // 获取所有文章
  async getAllArticles(limit = 100, offset = 0) {
    return new Promise((resolve, reject) => {
      const query = `SELECT a.*, s.summary, s.model as summary_model 
        FROM articles a 
        LEFT JOIN ai_summaries s ON a.hn_id = s.article_id 
        ORDER BY a.time DESC 
        LIMIT ? OFFSET ?`;
      
      this.db.all(query, [limit, offset], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // 根据ID获取文章
  async getArticleById(id) {
    return new Promise((resolve, reject) => {
      const query = `SELECT a.*, s.summary, s.model as summary_model 
        FROM articles a 
        LEFT JOIN ai_summaries s ON a.hn_id = s.article_id 
        WHERE a.hn_id = ?`;
      
      this.db.get(query, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  // 关闭数据库连接
  close() {
    this.db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed');
      }
    });
  }
}

module.exports = Database;