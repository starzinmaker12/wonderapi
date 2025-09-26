import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
	.setName('verificar')
	.setDescription('Verifica e ativa a tua key')
	.addStringOption(o => o.setName('key').setDescription('A tua key WONDER-...').setRequired(true));

export async function execute(interaction) {
	await interaction.deferReply({ ephemeral: true });
	const key = interaction.options.getString('key', true);
	const verifyRes = await fetch(`${process.env.API_BASE_URL}/api/keys/verify`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ key })
	});
	const ver = await verifyRes.json();
	if (!ver.valid) {
		return interaction.editReply(`Key inválida: ${ver.reason || 'desconhecido'}`);
	}
	const redeemRes = await fetch(`${process.env.API_BASE_URL}/api/keys/redeem`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ key, userId: interaction.user.id })
	});
	const red = await redeemRes.json();
	if (!red.success) {
		return interaction.editReply(`Não foi possível ativar: ${red.reason}`);
	}
	const roleId = process.env[`ROLE_${ver.plan}`];
	if (roleId && interaction.inGuild()) {
		try {
			await interaction.member.roles.add(roleId);
		} catch {}
	}
	const embed = new EmbedBuilder()
		.setTitle('Ativado com sucesso')
		.setDescription(`Plano: ${ver.plan}`)
		.setColor(0x57f287);
	await interaction.editReply({ embeds: [embed] });
}

export default { data, execute };
