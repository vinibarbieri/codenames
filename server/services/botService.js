/**
 * Bot Service - Serviço de IA para jogar Codenames
 * Usa embeddings de palavras e lógica heurística para gerar dicas e palpites
 * Integrado com WebSocket para IA externa
 */

import WebSocket from 'ws';

// Configuração do servidor de IA
const HOST = process.env.AI_HOST || '127.0.0.1';
const PORT = process.env.AI_PORT || 8088;
import wordlist from '../data/wordlist.json' assert { type: 'json' };


/**
 * Calcula similaridade semântica entre palavras usando heurística simples
 */
const calculateSimilarity = (word1, word2) => {
  const w1 = word1.toLowerCase();
  const w2 = word2.toLowerCase();
  
  // Verifica se uma palavra contém a outra
  if (w1.includes(w2) || w2.includes(w1)) return 0.7;
  
  // Conta letras em comum
  const commonChars = [...new Set(w1)].filter(char => w2.includes(char)).length;
  return commonChars / Math.max(w1.length, w2.length) * 0.5;
};

const normalizeText = (text = '') =>
  text
    .toString()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

const WORD_HINTS_MAP = new Map(
  wordlist
    .map(entry => {
      if (typeof entry === 'string') {
        return [normalizeText(entry), []];
      }
      if (entry && typeof entry === 'object') {
        const word = entry.palavra || entry.word;
        if (!word) {
          return null;
        }
        return [normalizeText(word), entry.dicas || []];
      }
      return null;
    })
    .filter(Boolean),
);

const getHintsForWord = (word = '') => WORD_HINTS_MAP.get(normalizeText(word)) || [];

const buildHintCandidates = (cards) => {
  const candidates = new Map();

  cards.forEach(card => {
    const hints = getHintsForWord(card.word);
    hints.forEach(hint => {
      const normalizedHint = normalizeText(hint);
      if (!candidates.has(normalizedHint)) {
        candidates.set(normalizedHint, { hint, normalizedHint, cards: [] });
      }
      candidates.get(normalizedHint).cards.push(card);
    });
  });

  return candidates;
};

const getDangerousHints = (cards) => {
  const dangerousHints = new Set();
  cards.forEach(card => {
    getHintsForWord(card.word).forEach(hint => {
      dangerousHints.add(normalizeText(hint));
    });
  });
  return dangerousHints;
};

const pickHintClue = (teamCards, dangerousCards, targetCount) => {
  const candidatesMap = buildHintCandidates(teamCards);
  if (!candidatesMap.size) {
    const fallbackCard = teamCards.find(card => getHintsForWord(card.word).length > 0);
    if (fallbackCard) {
      const fallbackHint = getHintsForWord(fallbackCard.word)[0];
      if (fallbackHint) {
        return {
          word: fallbackHint.toUpperCase(),
          number: 1,
        };
      }
    }
    return null;
  }

  const candidates = [...candidatesMap.values()];
  const dangerousHints = getDangerousHints(dangerousCards);

  candidates.sort((a, b) => {
    const coverageA = Math.min(a.cards.length, targetCount);
    const coverageB = Math.min(b.cards.length, targetCount);
    if (coverageA === coverageB) {
      return b.cards.length - a.cards.length;
    }
    return coverageB - coverageA;
  });

  const chosen =
    candidates.find(candidate => !dangerousHints.has(candidate.normalizedHint)) ||
    candidates[0];

  if (!chosen) {
    return null;
  }

  const number = Math.max(1, Math.min(targetCount, chosen.cards.length));
  return {
    word: chosen.hint.toUpperCase(),
    number,
  };
};

const findHintBasedGuess = (availableCards, clueWord = '', team) => {
  if (!clueWord) {
    return null;
  }

  const normalizedClue = normalizeText(clueWord);
  let bestMatch = null;

  availableCards.forEach(card => {
    const hints = getHintsForWord(card.word);
    if (!hints.length) return;

    let bestHintScore = 0;

    hints.forEach(hint => {
      const normalizedHint = normalizeText(hint);
      if (normalizedHint === normalizedClue) {
        bestHintScore = Math.max(bestHintScore, 3);
      } else if (
        normalizedHint.includes(normalizedClue) ||
        normalizedClue.includes(normalizedHint)
      ) {
        bestHintScore = Math.max(bestHintScore, 2.2);
      } else {
        const similarity = calculateSimilarity(normalizedHint, normalizedClue);
        if (similarity > 0.5) {
          bestHintScore = Math.max(bestHintScore, 1 + similarity);
        }
      }
    });

    if (bestHintScore > 0) {
      const score = bestHintScore + (card.type === team ? 0.3 : 0);
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { score, index: card.index };
      }
    }
  });

  return bestMatch ? bestMatch.index : null;
};

/**
 * Encontra grupos de palavras relacionadas no tabuleiro
 */
const findWordClusters = (words) => {
  const clusters = [];
  
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j < words.length; j++) {
      const similarity = calculateSimilarity(words[i].word, words[j].word);
      if (similarity > 0.3) {
        clusters.push({
          words: [words[i], words[j]],
          similarity,
        });
      }
    }
  }
  
  return clusters.sort((a, b) => b.similarity - a.similarity);
};

/**
 * Comunica com IA via WebSocket
 */
const callAIWebSocket = (prompt) => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${HOST}:${PORT}/`);
    
    // Timeout de 10 segundos
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Timeout ao conectar com IA'));
    }, 40000);

    ws.on('open', () => {
      console.log('[AI WebSocket] Conexão estabelecida');
      ws.send(prompt);
    });

    ws.on('message', (data) => {
      clearTimeout(timeout);
      console.log('[AI WebSocket] Resposta recebida:', data.toString());
      resolve(data.toString());
      ws.close();
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      console.error('[AI WebSocket] Erro:', error.message);
      reject(error);
      ws.close();
    });

    ws.on('close', () => {
      console.log('[AI WebSocket] Conexão fechada');
    });
  });
};

/**
 * Bot Spymaster - Gera dica para equipe
 */
export const generateBotClue = async (board, team, difficulty = 'medium') => {
  try {
    console.log(`[generateBotClue] Gerando dica para time ${team}, dificuldade: ${difficulty}`);
    
    // Filtrar cartas do time que não foram reveladas
    const teamCards = board
      .map((card, index) => ({ ...card, index }))
      .filter(card => card.type === team && !card.revealed);
    
    if (teamCards.length === 0) {
      throw new Error('Nenhuma carta do time disponível');
    }
    
    // Filtrar cartas perigosas (assassino e time adversário)
    const dangerousCards = board
      .map((card, index) => ({ ...card, index }))
      .filter(card => card.type === 'assassin' || (card.type !== team && card.type !== 'neutral'));
    
    // Estratégia baseada na dificuldade
    let targetCount = 1;
    
    if (difficulty === 'easy') {
      // Dificuldade FÁCIL → Usar IA via WebSocket
      console.log('[generateBotClue] Modo EASY - Usando IA via WebSocket');
      return await generateClueWithAI(teamCards, dangerousCards, team);
      
    } else if (difficulty === 'medium') {
      targetCount = Math.min(2, teamCards.length);
      
    } else if (difficulty === 'hard') {
      targetCount = Math.min(3, teamCards.length);
    }

    // Se difficulty não for easy, usar lógica baseada na dica
    const hintClue = pickHintClue(teamCards, dangerousCards, targetCount);
    if (hintClue) {
      return hintClue;
    }
    
    // Fallback: lógica simples baseada em heurística se não houver dica baseada na dica
    console.log('[generateBotClue] Usando heurística (medium/hard)');
    return generateClueHeuristic(teamCards, dangerousCards, targetCount);
    
  } catch (error) {
    console.error('[generateBotClue] Erro:', error);
    
    // Fallback final: dica aleatória
    const randomCard = board.filter(c => c.type === team && !c.revealed)[0];
    return {
      word: randomCard ? randomCard.word.substring(0, 3).toUpperCase() : 'DICA',
      number: 1,
    };
  }
};

/**
 * Gera dica usando IA via WebSocket (adaptado de bot.js)
 */
const generateClueWithAI = async (teamCards, dangerousCards, team) => {
  try {
    console.log('[generateClueWithAI] Preparando prompt para IA');
    
    const teamWords = teamCards.map(c => c.word).join(', ');
    const dangerWords = dangerousCards.map(c => c.word).join(', ');
    
    // Prompt otimizado para o modelo de IA
    let prompt = `Você está jogando o jogo de associação CodeNames. `;
    prompt += `As palavras do time ${team === 'red' ? 'Vermelho' : 'Azul'} são: ${teamWords}. `;
    
    if (dangerWords) {
      prompt += `Palavras perigosas para evitar: ${dangerWords}. `;
    }
    
    prompt += `Você é o spymaster. É sua vez de dar a dica. `;
    prompt += `Dê a dica escrevendo SOMENTE a palavra seguida do número de palavras associadas, sem qualquer outro texto. `;
    prompt += `Exemplo de resposta: "ANIMAL 2"`;

    console.log('[generateClueWithAI] Prompt:', prompt);
    
    // Chamar IA via WebSocket
    const resposta = await callAIWebSocket(prompt);
    
    // Parsear resposta (formato esperado: "PALAVRA NUMERO")
    const partes = resposta.trim().split(' ').filter(p => p.length > 0);
    
    if (partes.length >= 2) {
      const palavra = partes[0].toUpperCase();
      const numero = parseInt(partes[1]) || 1;
      
      console.log('[generateClueWithAI] Dica da IA:', { palavra, numero });
      
      return {
        word: palavra,
        number: Math.min(numero, teamCards.length, 3), // Limitar a 3
      };
    }
    
    // Se resposta inválida, usar primeira palavra como dica
    console.warn('[generateClueWithAI] Resposta inválida da IA, usando fallback');
    return {
      word: partes[0]?.toUpperCase() || 'DICA',
      number: 1,
    };
    
  } catch (error) {
    console.error('[generateClueWithAI] Erro ao comunicar com IA:', error);
    
    // Fallback para heurística
    console.log('[generateClueWithAI] Usando fallback heurístico');
    return generateClueHeuristic(teamCards, dangerousCards, 1);
  }
};

/**
 * Gera dica usando heurística simples (fallback)
 */
const generateClueHeuristic = (teamCards, dangerousCards, targetCount) => {
  // Encontrar clusters de palavras similares
  const clusters = findWordClusters(teamCards);
  
  if (clusters.length > 0 && targetCount > 1) {
    const bestCluster = clusters[0];
    const clueWord = bestCluster.words[0].word.substring(0, 4).toUpperCase();
    return {
      word: clueWord,
      number: Math.min(bestCluster.words.length, targetCount),
    };
  }
  
  // Estratégia conservadora: uma palavra aleatória
  const randomCard = teamCards[Math.floor(Math.random() * Math.min(targetCount, teamCards.length))];
  const clueWord = randomCard.word.substring(0, 3).toUpperCase();
  
  return {
    word: clueWord,
    number: 1,
  };
};

/**
 * Bot Operative - Escolhe carta para adivinhar
 */
export const generateBotGuess = async (board, clue, team, difficulty = 'medium') => {
  try {
    console.log(`[generateBotGuess] Gerando palpite para time ${team}, dificuldade: ${difficulty}`);
    console.log(`[generateBotGuess] Dica recebida: "${clue.word}" ${clue.number}`);

    const availableCards = board
      .map((card, index) => ({ ...card, index }))
      .filter(card => !card.revealed);
    
    if (availableCards.length === 0) {
      throw new Error('Nenhuma carta disponível');
    }

    console.log('[generateBotGuess] Cartas disponíveis:', availableCards.map(c => c.word).join(', '));
    
    if (difficulty === 'easy') {
      // Dificuldade FÁCIL → Usar IA via WebSocket
      console.log('[generateBotGuess] Modo EASY - Usando IA via WebSocket');
      return await generateGuessWithAI(availableCards, clue, team);
    }
    // Se difficulty não for easy, usar lógica baseada na dica
    const hintBasedGuessIndex = findHintBasedGuess(availableCards, clue?.word, team);
    if (hintBasedGuessIndex !== null && hintBasedGuessIndex !== undefined) {
      return hintBasedGuessIndex;
    }

    
    // Fallback: lógica simples
    console.log('[generateBotGuess] Usando heurística (medium/hard)');
    return generateGuessHeuristic(availableCards, clue, team, difficulty);
    
  } catch (error) {
    console.error('[generateBotGuess] Erro:', error);
    
    // Fallback: carta aleatória
    const randomCard = board.filter(c => !c.revealed)[0];
    return randomCard ? board.indexOf(randomCard) : 0;
  }
};

/**
 * Gera palpite usando IA via WebSocket (adaptado de bot.js)
 */
const generateGuessWithAI = async (availableCards, clue, team) => {
  try {
    console.log('[generateGuessWithAI] Preparando prompt para IA');
    
    const palavrasDisponiveis = availableCards.map(c => c.word).join(', ');
    
    // Prompt otimizado para o modelo de IA
    let prompt = `Você está jogando o jogo CodeNames. `;
    prompt += `As palavras disponíveis no tabuleiro são: ${palavrasDisponiveis}. `;
    prompt += `A dica é "${clue.word}" com ${clue.number} palavras associadas. `;
    prompt += `Escolha as palavras mais relacionadas à dica e retorne APENAS elas separadas por vírgula, sem texto adicional. `;
    prompt += `Exemplo de resposta: "GATO, CACHORRO"`;

    console.log('[generateGuessWithAI] Prompt:', prompt);
    
    // Chamar IA via WebSocket
    const resposta = await callAIWebSocket(prompt);
    
    // Parsear resposta (formato esperado: "PALAVRA1, PALAVRA2, ...")
    const palavrasSelecionadas = resposta
      .split(',')
      .map(p => p.trim().toUpperCase())
      .filter(p => p.length > 0);
    
    console.log('[generateGuessWithAI] Palavras selecionadas pela IA:', palavrasSelecionadas);
    
    // Encontrar a primeira palavra que existe no tabuleiro
    for (const palavraIA of palavrasSelecionadas) {
      const cartaEncontrada = availableCards.find(
        card => card.word.toUpperCase() === palavraIA
      );
      
      if (cartaEncontrada) {
        console.log('[generateGuessWithAI] Carta escolhida:', cartaEncontrada.word, 'índice:', cartaEncontrada.index);
        return cartaEncontrada.index;
      }
    }
    
    // Se nenhuma palavra da IA foi encontrada, usar heurística
    console.warn('[generateGuessWithAI] Nenhuma palavra da IA encontrada, usando fallback');
    return generateGuessHeuristic(availableCards, clue, team, 'medium');
    
  } catch (error) {
    console.error('[generateGuessWithAI] Erro ao comunicar com IA:', error);
    
    // Fallback para heurística
    console.log('[generateGuessWithAI] Usando fallback heurístico');
    return generateGuessHeuristic(availableCards, clue, team, 'medium');
  }
};

/**
 * Gera palpite usando heurística (fallback)
 */
const generateGuessHeuristic = (availableCards, clue, team, difficulty) => {
  // Calcular similaridade de cada carta com a dica
  const scores = availableCards.map(card => ({
    ...card,
    similarity: calculateSimilarity(card.word, clue.word),
  }));
  
  // Adicionar ruído baseado na dificuldade
  const noise = {
    easy: 0.05,   // 5% de chance de erro
    medium: 0.15, // 15% de chance de erro
    hard: 0.30,   // 30% de chance de erro
  }[difficulty] || 0.15;
  
  if (Math.random() < noise) {
    // Escolher carta aleatória (simular erro)
    const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
    console.log('[generateGuessHeuristic] Escolha aleatória (ruído):', randomCard.word);
    return randomCard.index;
  }
  
  // Escolher carta com maior similaridade
  scores.sort((a, b) => b.similarity - a.similarity);
  console.log('[generateGuessHeuristic] Melhor match:', scores[0].word, 'similaridade:', scores[0].similarity);
  return scores[0].index;
};

/**
 * Delay para simular "pensamento" do bot
 */
export const botThinkingDelay = (difficulty = 'medium') => {
  const delays = {
    easy: 2000,   // 2 segundos (mais tempo para IA processar)
    medium: 2000, // 2 segundos
    hard: 3000,   // 3 segundos
  };
  
  return new Promise(resolve => 
    setTimeout(resolve, delays[difficulty] || 2000)
  );
};
