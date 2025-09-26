import { SlashCommandBuilder } from 'discord.js';

function getApiBase() {
	return process.env.API_BASE_URL || 'http://localhost:3000';
}

async function fetchJson(url, options = {}) {
	const res = await fetch(url, options);
	const ct = res.headers.get('content-type') || '';
	if (!ct.includes('application/json')) {
		const text = await res.text().catch(() => '');
		return { ok: false, status: res.status, error: 'invalid_response', body: text.slice(0, 200) };
	}
	const json = await res.json();
	return { ok: res.ok, status: res.status, json };
}

export const data = new SlashCommandBuilder()
	.setName('gerar')
	.setDescription('Gera keys para um plano')
	.addStringOption(o => o.setName('plano').setDescription('BASICO | PREMIUM | VIP').setRequired(true).addChoices(
		{ name: 'BASICO', value: 'BASICO' },
		{ name: 'PREMIUM', value: 'PREMIUM' },
		{ name: 'VIP', value: 'VIP' }
	))
	.addIntegerOption(o => o.setName('quantidade').setDescription('Numero de keys (1-100)').setMinValue(1).setMaxValue(100).setRequired(true));

export async function execute(interaction) {
	try {
		await interaction.deferReply({ ephemeral: true });
		const plan = interaction.options.getString('plano');
		const count = interaction.options.getInteger('quantidade');
		const apiBase = getApiBase();
		const token = process.env.API_TOKEN || '';
		const resp = await fetchJson(`${apiBase}/api/keys/generate`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-api-token': token },
			body: JSON.stringify({ plan, count })
		});
		if (!resp.ok) {
			const reason = resp.json?.error || resp.error || `HTTP ${resp.status}`;
			return interaction.editReply('Erro a gerar keys: ' + reason);
		}
		const keys = resp.json.keys || [];
		const content = 'Keys geradas:\n' + keys.map(k => '`' + k + '`').join('\n');
		await interaction.editReply({ content });
	} catch (err) {
		const msg = 'Falha ao gerar keys. Verifique API_BASE_URL e API_TOKEN.';
		if (interaction.deferred || interaction.replied) {
			return interaction.editReply(msg).catch(() => {});
		} else {
			return interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
		}
	}
}

export default { data, execute };
