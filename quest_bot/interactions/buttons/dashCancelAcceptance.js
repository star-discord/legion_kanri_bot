// quest_bot/interactions/buttons/dashCancelAcceptance.js
const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const questDataManager = require('../../../manager/questDataManager');
const { handleInteractionError } = require('../../../utils/interactionErrorLogger');

module.exports = {
    customId: 'dash_open_cancelAcceptanceSelect',
    async handle(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const myAcceptances = await questDataManager.getActiveAcceptances(interaction.guildId, interaction.user.id);

            if (myAcceptances.length === 0) {
                return interaction.editReply({ content: '現在、あなたが受注しているクエストはありません。' });
            }

            const acceptanceOptions = myAcceptances.map(acc => ({
                label: `[${acc.questName}]`,
                description: `あなたの受注: ${acc.players}人`,
                value: acc.questId,
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`dash_select_cancelAcceptance_${interaction.id}`)
                .setPlaceholder('取り消す受注を選択してください')
                .addOptions(acceptanceOptions.slice(0, 25));

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.editReply({
                content: 'どのクエストの受注を取り消しますか？',
                components: [row],
            });
        } catch (error) {
            await handleInteractionError({ interaction, error, context: '受注取消UI表示' });
        }
    },
};