const express = require('express');
const path = require('path');
const app = express();

const publicDir = path.join(__dirname, '../frontend/public');

app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.sendFile(path.join(publicDir, 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');
  res.sendFile(path.join(publicDir, 'sitemap.xml'));
});

app.use(express.static(publicDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.xml')) {
      res.setHeader('Content-Type', 'application/xml');
    } else if (filePath.endsWith('.txt')) {
      res.setHeader('Content-Type', 'text/plain');
    }
  }
}));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(3000, () => console.log('Server running on port 3000'));
