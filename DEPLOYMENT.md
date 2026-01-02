# Deployment Guide

This guide explains how to deploy the Hacker News Quick Reader application to various platforms.

## GitHub Pages Deployment

The application is configured for deployment to GitHub Pages using GitHub Actions.

### Setup:

1. Fork this repository to your GitHub account.
2. Enable GitHub Pages in your repository settings (Settings → Pages → Source: GitHub Actions).
3. The workflow in `.github/workflows/deploy.yml` will automatically deploy your changes when you push to the main branch.

### Environment Variables

For AI summary functionality, you'll need to configure these environment variables in GitHub Secrets (Settings → Secrets and variables → Actions):

- `OPENAI_API_KEY` - Your OpenAI API key

## Heroku Deployment

[One-Click Deploy to Heroku]

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/your-username/hacker-news-quick-read)

### Manual Deployment to Heroku:

1. Create a Heroku account at [heroku.com](https://heroku.com)
2. Install the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
3. Run the following commands:

```bash
heroku login
heroku create
git push heroku main
heroku open
```

### Heroku Environment Variables

Set these config vars in your Heroku app:

```bash
heroku config:set OPENAI_API_KEY=your_openai_api_key_here
heroku config:set OPENAI_BASE_URL=https://api.openai.com/v1
heroku config:set OPENAI_MODEL=gpt-3.5-turbo
```

## Docker Deployment

The application includes a Dockerfile for containerized deployment.

### Building and Running with Docker:

```bash
# Build the image
docker build -t hacker-news-quick-read .

# Run the container
docker run -p 3000:3000 -e OPENAI_API_KEY=your_openai_api_key_here hacker-news-quick-read
```

## Node.js Direct Deployment

### Prerequisites:

- Node.js 18 or higher
- npm

### Steps:

1. Clone the repository
2. Install dependencies: `npm install`
3. Set environment variables:
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `PORT` - Port to run the server on (default: 3000)
4. Start the server: `npm start`

The application will be available at `http://localhost:3000` or the port specified in the `PORT` environment variable.

## Environment Variables

The application supports the following environment variables:

- `OPENAI_API_KEY` (required for AI summaries)
- `OPENAI_BASE_URL` (default: https://api.openai.com/v1)
- `OPENAI_MODEL` (default: gpt-3.5-turbo)
- `PORT` (default: 3000)
- `DATABASE_URL` (default: ./hacker_news.db)
