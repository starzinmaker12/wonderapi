import 'dotenv/config';
import { Client, Collection, GatewayIntentBits, Partials, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } from 'discord.js';
import { logger } from '../lib/logger.js';

export const client = new Client({
	intents: [
		GatewayIntentBits.Guilds
	],
	partials: [Partials.Channel]
});

client.commands = new Collection();

export async function sendKeyPortalEmbed(channelId) {
	const channel = await client.channels.fetch(channelId);
	if (!channel || channel.type !== ChannelType.GuildText) return;
	const embed = new EmbedBuilder()
		.setTitle('Liberar Acesso')
		.setDescription('Para liberar seu acesso à área de clientes, clique no botão abaixo:')
		.setColor(0x5865F2);
	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder().setCustomId('open_access_modal').setStyle(ButtonStyle.Primary).setLabel('Liberar Acesso')
	);
	await channel.send({ embeds: [embed], components: [row] });
}

client.on('interactionCreate', async (interaction) => {
	try {
		if (interaction.isChatInputCommand()) {
			const command = client.commands.get(interaction.commandName);
			if (!command) return;
			await command.execute(interaction);
			return;
		}
		if (interaction.isButton() && interaction.customId === 'open_access_modal') {
			const modal = new ModalBuilder()
				.setCustomId('access_modal')
				.setTitle('Liberar Acesso');
			const input = new TextInputBuilder()
				.setCustomId('key_input')
				.setLabel('Insira sua key')
				.setPlaceholder('WONDER-PLANO-ABC123-XYZ789')
				.setStyle(TextInputStyle.Short)
				.setRequired(true);
			const row = new ActionRowBuilder().addComponents(input);
			modal.addComponents(row);
			await interaction.showModal(modal);
			return;
		}
		if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'access_modal') {
			try {
				await interaction.deferReply({ ephemeral: true });
				const key = interaction.fields.getTextInputValue('key_input');
				const verifyRes = await fetch(`${process.env.API_BASE_URL}/api/keys/verify`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ key })
				});
				const ver = await verifyRes.json().catch(() => ({}));
				if (!verifyRes.ok || !ver.valid) {
					return interaction.editReply(`Key inválida: ${ver.reason || 'desconhecido'}`);
				}
				const redeemRes = await fetch(`${process.env.API_BASE_URL}/api/keys/redeem`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ key, userId: interaction.user.id })
				});
				const red = await redeemRes.json().catch(() => ({}));
				if (!red.success) return interaction.editReply(`Não foi possível ativar: ${red.reason || 'erro'}`);
				const roleId = process.env[`ROLE_${ver.plan}`];
				if (roleId && interaction.inGuild()) {
					try { await interaction.member.roles.add(roleId); } catch {}
				}
				const embed = new EmbedBuilder().setTitle('Acesso liberado').setDescription(`Plano: ${ver.plan}`).setColor(0x57f287);
				await interaction.editReply({ embeds: [embed] });
			} catch (e) {
				logger.error({ err: e }, 'Modal submit error');
				if (interaction.deferred || interaction.replied) {
					await interaction.editReply('Ocorreu um erro. Tenta novamente.').catch(() => {});
				} else {
					await interaction.reply({ content: 'Ocorreu um erro. Tenta novamente.', ephemeral: true }).catch(() => {});
				}
			}
			return;
		}
	} catch (err) {
		logger.error({ err }, 'Interaction error');
		if (interaction.isRepliable()) {
			if (interaction.deferred || interaction.replied) {
				await interaction.editReply('Ocorreu um erro. Tenta novamente.').catch(() => {});
			} else {
				await interaction.reply({ content: 'Ocorreu um erro. Tenta novamente.', ephemeral: true }).catch(() => {});
			}
		}
	}
});

export async function startDiscordBot() {
	await client.login(process.env.DISCORD_TOKEN);
	logger.info('Discord bot logged in');
}
