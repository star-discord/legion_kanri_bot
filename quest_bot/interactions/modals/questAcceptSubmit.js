// quest_bot/interactions/modals/questAcceptSubmit.js
const { EmbedBuilder, MessageFlags } = require('discord.js');
const questDataManager = require('../../../manager/questDataManager');
const { updateQuestMessage } = require('../../utils/questMessageManager');
const { updateDashboard } = require('../../utils/dashboardManager');
const { logAction } = require('../../utils/logger');
const { calculateRemainingSlots } = require('../../utils/questUtils');
const { sendAcceptanceNotification } = require('../../utils/notificationManager');
const { handleInteractionError } = require('../../../utils/interactionErrorLogger');
const { QUEST_ACCEPT_MODAL, QUEST_ACCEPT_PEOPLE_INPUT, QUEST_ACCEPT_COMMENT_INPUT } = require('../../utils/customIds');

module.exports = {
  customId: QUEST_ACCEPT_MODAL,
  async handle(interaction) {
    try {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

      const questId = interaction.customId.replace(QUEST_ACCEPT_MODAL, '');
      const guildId = interaction.guildId;

      // 1. Get data from modal
      const peopleStr = interaction.fields.getTextInputValue(QUEST_ACCEPT_PEOPLE_INPUT);
      const comment = interaction.fields.getTextInputValue(QUEST_ACCEPT_COMMENT_INPUT);

      // 2. Validate input
      const peopleNum = parseInt(peopleStr, 10);

      if (isNaN(peopleNum) || peopleNum <= 0) {
        return interaction.editReply({ content: '⚠️ 人数には1以上の半角数字を入力してください。' });
      }

      // 3. Re-fetch quest data to prevent race conditions
      const quest = await questDataManager.getQuest(guildId, questId);
      if (!quest || quest.isClosed || quest.isArchived) {
        return interaction.editReply({ content: '⚠️ このクエストは現在募集を締め切っているか、見つかりませんでした。' });
      }

      // レースコンディション対策で、ここでも重複受注をチェック (失敗以外)
      const hasAlreadyAccepted = quest.accepted?.some(a => a.userId === interaction.user.id && a.status !== 'failed');
      if (hasAlreadyAccepted) {
          return interaction.editReply({ content: '⚠️ あなたは既にこのクエストを受注済みです。' });
      }

      // 4. Check for available slots
      const { remainingPeople, currentAcceptedPeople } = calculateRemainingSlots(quest);

      if (peopleNum > remainingPeople) {
        return interaction.editReply({ content: `⚠️ 募集枠を超えています。(残り: ${remainingPeople}人)` });
      }

      // 5. Prepare update data
      const newAcceptance = {
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        channelName: interaction.channel.name,
        people: peopleNum,
        players: peopleNum, // 互換性のために両方追加
        comment: comment || null,
        timestamp: Date.now(),
      };

      const updatedAccepted = [...(quest.accepted || []), newAcceptance];

      // Check if the quest is now full
      const newTotalPeople = currentAcceptedPeople + peopleNum;
      const isNowFull = newTotalPeople >= (quest.people || quest.players || 1);

      const updates = {
        accepted: updatedAccepted,
        isClosed: isNowFull ? true : quest.isClosed, // Close if full
      };

      // 6. Update quest data
      const updatedQuest = await questDataManager.updateQuest(guildId, questId, updates, interaction.user);
      if (!updatedQuest) {
        return interaction.editReply({ content: '⚠️ クエストデータの更新に失敗しました。' });
      }

      // 7. Update all messages
      await updateQuestMessage(interaction.client, updatedQuest);
      await updateDashboard(interaction.client, guildId);

      // 8. Log action
      await logAction({ client: interaction.client, guildId: interaction.guildId, user: interaction.user }, {
        title: '👍 クエスト受注',
        color: '#2ecc71',
        details: {
          'クエストタイトル': updatedQuest.title || '無題', // Use updatedQuest for consistency
          'クエストID': questId,
          '受注人数': `${peopleNum}人`,
        },
      });

      // 9. Send notification
      await sendAcceptanceNotification({ interaction, quest: updatedQuest, acceptance: newAcceptance, wasFull: isNowFull });

      // 10. Final reply to user
      let replyMessage = '✅ クエストを受注しました！';
      if (isNowFull) { replyMessage += '\nℹ️ この受注により、募集が定員に達したため自動的に締め切られました。'; }
      await interaction.editReply({ content: replyMessage });
    } catch (error) {
      await handleInteractionError({ interaction, error, context: 'クエスト受注処理' });
    }
  },
};