// /fred slash command implementation
const { ThreadManager } = require('../utils/thread');
const fetch = require('node-fetch');

const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

if (!CHANNEL_ID) {
  console.error('Missing DISCORD_CHANNEL_ID environment variable!');
}

const threadManager = new ThreadManager();

async function handleFredCommand(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    const user = interaction.user;
    const guild = interaction.guild;
    const channel = guild.channels.cache.get(CHANNEL_ID);
    
    if (!channel) {
      await interaction.editReply({
        content: '❌ Canal configuré introuvable. Contacte un administrateur.',
      });
      return;
    }
    
    // Check if user already has an active thread
    const existingThread = await threadManager.findActiveThread(user.id, channel);
    
    if (existingThread) {
      await interaction.editReply({
        content: `💬 Tu as déjà une conversation active avec Fred Wav: ${existingThread}
        
Continue la conversation dans ce thread !`,
      });
      return;
    }
    
    // Create new private thread
    const threadName = `fred-${user.username}-${Date.now()}`;
    
    const thread = await channel.threads.create({
      name: threadName,
      type: 12, // GUILD_PRIVATE_THREAD
      reason: `Conversation privée Fred Wav pour ${user.tag}`,
    });
    
    // Add user to thread
    await thread.members.add(user.id);
    
    // Send welcome message
    const welcomeMessage = `👋 **Salut ${user.displayName} !**

🎥 Je suis **Fred Wav**, ton expert en création de contenu vidéo/audio.

**Mon expertise :**
• TikTok & algorithmes 
• Lives & Multi-plateformes
• Audiovisuel & Montage
• Monétisation & Communauté

**✅ Certifié Wav Anti-Bullshit**
Je ne raconte jamais de conneries - si je ne sais pas, je te le dis clairement plutôt que d'inventer.

**📋 Charte de la conversation :**
• Sois précis dans tes questions
• Donne du contexte (ton niveau, ton objectif)
• Je réponds selon le protocole : Diagnostic → Plan → Check-list → Prochaine étape

**🎯 Pose-moi tes questions sur la création de contenu !**`;
    
    await thread.send(welcomeMessage);
    
    // Handle initial question if provided
    const initialQuestion = interaction.options.getString('question');
    if (initialQuestion) {
      // Send user's question to thread
      await thread.send(`**${user.displayName} :** ${initialQuestion}`);
      
      // Process with Fred Wav API
      await threadManager.processMessage(thread, user, initialQuestion);
    }
    
    // Store thread info
    threadManager.addActiveThread(user.id, thread);
    
    await interaction.editReply({
      content: `✅ **Conversation privée créée avec Fred Wav !**
      
📩 Check tes DMs ou va dans ${thread} pour continuer.
      
🔒 Cette conversation est **100% privée** - seuls toi et Fred Wav y avez accès.`,
    });
    
  } catch (error) {
    console.error('Erreur lors de la création du thread Fred:', error);
    
    try {
      await interaction.editReply({
        content: `❌ Erreur lors de la création de la conversation. 

L'équipe technique a été notifiée. Réessaie dans quelques minutes.`,
      });
    } catch (editError) {
      console.error('Erreur lors de l\'édition de la réponse:', editError);
    }
  }
}

module.exports = {
  handleFredCommand,
};