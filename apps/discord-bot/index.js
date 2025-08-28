// Discord bot main entry point
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const { handleFredCommand } = require('./commands/fred');

// Environment variables
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !DISCORD_GUILD_ID) {
  console.error('Missing Discord environment variables!');
  console.error('Required: DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID');
  process.exit(1);
}

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Slash command definition
const fredCommand = {
  name: 'fred',
  description: 'Ouvre une conversation privée avec Fred Wav',
  options: [
    {
      name: 'question',
      description: 'Ta question pour Fred Wav (optionnel)',
      type: 3, // STRING
      required: false,
    },
  ],
};

// Register slash commands
async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    
    console.log('Enregistrement des commandes slash...');
    
    await rest.put(
      Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
      { body: [fredCommand] }
    );
    
    console.log('✅ Commandes slash enregistrées avec succès!');
  } catch (error) {
    console.error('❌ Erreur lors de l\'enregistrement des commandes:', error);
  }
}

// Bot ready event
client.once('ready', async () => {
  console.log(`🤖 Fred Wav Bot connecté en tant que ${client.user.tag}`);
  console.log(`📊 Connecté à ${client.guilds.cache.size} serveur(s)`);
  
  // Register commands
  await registerCommands();
  
  // Set bot status
  client.user.setActivity('Conseils création de contenu', { type: 'WATCHING' });
});

// Handle slash command interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'fred') {
    await handleFredCommand(interaction);
  }
});

// Handle messages in Fred threads
client.on('messageCreate', async (message) => {
  // Skip bot messages
  if (message.author.bot) return;
  
  // Only handle messages in threads with "fred-" prefix
  if (!message.channel.isThread() || !message.channel.name.startsWith('fred-')) {
    return;
  }
  
  // Handle thread message (relay to chat API)
  const { handleThreadMessage } = require('./utils/thread');
  await handleThreadMessage(message);
});

// Error handling
client.on('error', (error) => {
  console.error('❌ Erreur Discord:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Rejection non gérée:', error);
});

// Start the bot
client.login(DISCORD_TOKEN);