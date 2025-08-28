// Discord thread utilities
const fetch = require('node-fetch');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

class ThreadManager {
  constructor() {
    this.activeThreads = new Map(); // userId -> threadInfo
    this.conversations = new Map(); // threadId -> conversationId
  }
  
  /**
   * Find existing active thread for a user
   */
  async findActiveThread(userId, channel) {
    try {
      // Check in-memory cache first
      if (this.activeThreads.has(userId)) {
        const threadInfo = this.activeThreads.get(userId);
        
        // Verify thread still exists and is not archived
        try {
          const thread = await channel.guild.channels.fetch(threadInfo.id);
          if (thread && !thread.archived) {
            return thread;
          } else {
            // Thread is archived or deleted, remove from cache
            this.activeThreads.delete(userId);
          }
        } catch (error) {
          // Thread not found, remove from cache
          this.activeThreads.delete(userId);
        }
      }
      
      // Search through existing threads
      const threads = await channel.threads.fetchActive();
      
      for (const [threadId, thread] of threads.threads) {
        if (thread.name.includes(`fred-`) && thread.name.includes(userId)) {
          // Found existing thread, cache it
          this.addActiveThread(userId, thread);
          return thread;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Erreur lors de la recherche de thread:', error);
      return null;
    }
  }
  
  /**
   * Add thread to active threads cache
   */
  addActiveThread(userId, thread) {
    this.activeThreads.set(userId, {
      id: thread.id,
      name: thread.name,
      createdAt: new Date(),
    });
  }
  
  /**
   * Remove thread from active threads cache
   */
  removeActiveThread(userId) {
    this.activeThreads.delete(userId);
  }
  
  /**
   * Process a message in a Fred thread
   */
  async processMessage(thread, user, messageContent) {
    try {
      // Show typing indicator
      await thread.sendTyping();
      
      // Get or create conversation ID for this thread
      let conversationId = this.conversations.get(thread.id);
      
      // Call Fred Wav API
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `FredWav-Discord-Bot/1.0 (Discord: ${user.id})`,
        },
        body: JSON.stringify({
          message: messageContent,
          conversationId: conversationId,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Store conversation ID for future messages
      if (data.conversationId) {
        this.conversations.set(thread.id, data.conversationId);
      }
      
      // Format response for Discord
      let discordResponse = data.response;
      
      // Add metadata indicators
      const indicators = [];
      
      if (data.metadata?.refusal) {
        indicators.push('🛡️ Protection WAB');
      }
      
      if (data.metadata?.sources > 0) {
        indicators.push(`📚 ${data.metadata.sources} source(s)`);
      }
      
      if (data.metadata?.movable) {
        indicators.push('⚠️ Sujet mouvant');
      }
      
      if (indicators.length > 0) {
        discordResponse += `\n\n*${indicators.join(' • ')}*`;
      }
      
      // Split long messages (Discord limit: 2000 characters)
      if (discordResponse.length > 2000) {
        const chunks = this.splitMessage(discordResponse, 2000);
        
        for (let i = 0; i < chunks.length; i++) {
          await thread.send(chunks[i]);
          
          // Small delay between chunks
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      } else {
        await thread.send(discordResponse);
      }
      
    } catch (error) {
      console.error('Erreur lors du traitement du message:', error);
      
      await thread.send(`❌ **Erreur technique**

Désolé, une erreur est survenue lors du traitement de ta question.

✅ **Certifié Wav Anti-Bullshit** — en cas d'erreur, on te le dit clairement !

L'équipe technique a été notifiée. Réessaie dans quelques minutes.`);
    }
  }
  
  /**
   * Split a long message into chunks
   */
  splitMessage(message, maxLength) {
    const chunks = [];
    let currentChunk = '';
    
    const lines = message.split('\n');
    
    for (const line of lines) {
      if ((currentChunk + line + '\n').length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        // If single line is too long, split it
        if (line.length > maxLength) {
          const words = line.split(' ');
          let currentLine = '';
          
          for (const word of words) {
            if ((currentLine + word + ' ').length > maxLength) {
              if (currentLine) {
                chunks.push(currentLine.trim());
                currentLine = '';
              }
              
              // If single word is still too long, truncate it
              if (word.length > maxLength) {
                chunks.push(word.substring(0, maxLength - 3) + '...');
              } else {
                currentLine = word + ' ';
              }
            } else {
              currentLine += word + ' ';
            }
          }
          
          if (currentLine) {
            currentChunk = currentLine;
          }
        } else {
          currentChunk = line + '\n';
        }
      } else {
        currentChunk += line + '\n';
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }
}

/**
 * Handle message in Fred thread (called from main bot)
 */
async function handleThreadMessage(message) {
  try {
    const threadManager = new ThreadManager();
    await threadManager.processMessage(message.channel, message.author, message.content);
  } catch (error) {
    console.error('Erreur lors du traitement du message de thread:', error);
  }
}

module.exports = {
  ThreadManager,
  handleThreadMessage,
};