import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import routes from './routes.js';
import { logger } from '../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api', routes);

// Serve the download page
app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, '../public/index.html'));
});

const PORT = Number(process.env.PORT || 3000);

export function startApiServer() {
	app.listen(PORT, () => {
		logger.info({ port: PORT }, 'API server listening');
	});
}
