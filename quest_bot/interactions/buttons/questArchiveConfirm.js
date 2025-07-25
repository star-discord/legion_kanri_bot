// quest_bot/interactions/buttons/questArchive.js
const { MessageFlags } = require('discord.js');
const questDataManager = require('../../../manager/questDataManager');
const { canEditQuest } = require('../../../manager/permissionManager');
const { replyWithConfirmation } = require('../../components/confirmationUI');
const { handleInteractionError } = require('../../../utils/interactionErrorLogger');

module.exports = {
  customId: 'quest_open_archiveConfirm_', // Prefix match
  async handle (interaction) {
    try {
      const questId = interaction.customId.split('_')[3];
      const quest = await questDataManager.getQuest(interaction.guildId, questId);

      if (!quest) {
        return interaction.reply({ content: '対象のクエストが見つかりませんでした。', flags: MessageFlags.Ephemeral });
      }

      if (quest.isArchived) {
        return interaction.reply({ content: '⚠️ このクエストは既に完了（アーカイブ）済みです。', flags: MessageFlags.Ephemeral });
      }

      // Permission check: issuer or quest manager/creator
      if (!(await canEditQuest(interaction, quest))) {
        return interaction.reply({ content: 'クエストの完了は、発注者または管理者のみが行えます。', flags: MessageFlags.Ephemeral });
      }

      await replyWithConfirmation(interaction, {
        content: '本当にこのクエストを完了状態にしますか？\n完了したクエストは `/完了クエスト一覧` から確認・復元できます。',
        confirmCustomId: `quest_confirm_archive_${questId}`,
        confirmLabel: 'はい、完了します',
        cancelCustomId: `quest_cancel_archive_${questId}`,
      });
    } catch (error) {
      await handleInteractionError({ interaction, error, context: 'クエスト完了UI表示' });
    }
  },
};