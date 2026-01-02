const express = require('express');
const path = require('path');
const Database = require('./database');
const app = express();
const PORT = 3000;

// Initialize database
const db = new Database();

// Middleware to parse JSON
app.use(express.json());

// Serve static files from src directory
app.use(express.static(path.join(__dirname, 'src')));

// API endpoint to get cached articles
app.get('/api/articles', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const articles = await db.getAllArticles(parseInt(limit), parseInt(offset));
    res.json(articles);
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// API endpoint to get specific article
app.get('/api/article/:id', async (req, res) => {
  try {
    const article = await db.getArticleById(parseInt(req.params.id));
    if (article) {
      res.json(article);
    } else {
      res.status(404).json({ error: 'Article not found' });
    }
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// API endpoint to save article
app.post('/api/article', async (req, res) => {
  try {
    const article = req.body;
    const result = await db.saveArticle(article);
    res.json(result);
  } catch (error) {
    console.error('Error saving article:', error);
    res.status(500).json({ error: 'Failed to save article' });
  }
});

// API endpoint to save AI summary
app.post('/api/ai-summary', async (req, res) => {
  try {
    const { articleId, summary, model } = req.body;
    const result = await db.saveAISummary(articleId, summary, model);
    res.json(result);
  } catch (error) {
    console.error('Error saving AI summary:', error);
    res.status(500).json({ error: 'Failed to save AI summary' });
  }
});

// API endpoint to get AI summary
app.get('/api/ai-summary/:articleId', async (req, res) => {
  try {
    const summary = await db.getAISummary(parseInt(req.params.articleId));
    if (summary) {
      res.json(summary);
    } else {
      res.status(404).json({ error: 'AI summary not found' });
    }
  } catch (error) {
    console.error('Error fetching AI summary:', error);
    res.status(500).json({ error: 'Failed to fetch AI summary' });
  }
});

// Route to serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'index.html'));
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  db.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Hacker News Reader is running at http://localhost:${PORT}`);
});