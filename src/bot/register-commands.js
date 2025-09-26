import 'dotenv/config';
import { REST, Routes } from 'discord.js';

export async function registerCommands(commands) {
	if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
		return; // no-op if not configured
	}
	const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
	await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands.map(c => c.data.toJSON()) });
}
