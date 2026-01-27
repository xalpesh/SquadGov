import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url'; // Required for ES Modules to get __dirname

// Resolve __filename and __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

// For any other requests, serve the index.html (for SPAs)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start the server
try {
  app.listen(PORT, HOST, () => {
    console.log(`SquadGov static server running on http://${HOST}:${PORT}`);
    console.log(`Serving files from: ${path.join(__dirname, 'dist')}`);
  });
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1); // Exit with an error code
}
