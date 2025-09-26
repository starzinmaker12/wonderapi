import 'dotenv/config';
import { startApiServer } from './api/server.js';
import { client, sendKeyPortalEmbed } from './bot/client.js';
import { registerCommands } from './bot/register-commands.js';
import gen from './commands/generate.js';
import ver from './commands/verify.js';
import { logger } from './lib/logger.js';

async function main() {
	startApiServer();
	if (process.env.DISCORD_TOKEN) {
		client.commands.set(gen.data.name, gen);
		client.commands.set(ver.data.name, ver);
		await registerCommands([gen, ver]);
		const { startDiscordBot } = await import('./bot/client.js');
		await startDiscordBot();
		if (process.env.KEY_PORTAL_CHANNEL_ID) {
			client.once('ready', () => {
				sendKeyPortalEmbed(process.env.KEY_PORTAL_CHANNEL_ID);
			});
		}
	} else {
		logger.warn('DISCORD_TOKEN not set. Running API only.');
	}
}

main().catch(err => {
	logger.error({ err }, 'Fatal error in startup');
	process.exit(1);
});
