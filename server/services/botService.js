/**
 * Bot Service - Serviço de IA para jogar Codenames
 * Usa embeddings de palavras e lógica heurística para gerar dicas e palpites
 */
import wordlist from '../data/wordlist.json' assert { type: 'json' };


/**
 * Calcula similaridade semântica entre palavras usando heurística simples
 * Em produção, usar word embeddings (word2vec, GloVe, ou OpenAI embeddings)
 */
const calculateSimilarity = (word1, word2) => {
  // Heurística simples: palavras com letras em comum têm alguma similaridade
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
const findWordClusters = (words, teamType) => {
  const clusters = [];
  
  // Algoritmo simples: tentar agrupar palavras por similaridade
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
 * Bot Spymaster - Gera dica para equipe
 */
export const generateBotClue = async (board, team, difficulty = 'medium') => {
  try {
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
      // Easy mode stays conservative with single-word clues
      targetCount = 1;
    } else if (difficulty === 'medium') {
      targetCount = Math.min(2, teamCards.length); // Até 2 palavras
    } else if (difficulty === 'hard') {
      targetCount = Math.min(3, teamCards.length); // Até 3 palavras
    }
    
   
    const hintClue = pickHintClue(teamCards, dangerousCards, targetCount);
    if (hintClue) {
      return hintClue;
    }
    
    // Fallback: lógica simples baseada em heurística
    return generateClueHeuristic(teamCards, dangerousCards, targetCount);
    
  } catch (error) {
    console.error('Erro ao gerar dica do bot:', error);
    // Fallback: dica aleatória
    const randomCard = board.filter(c => c.type === team && !c.revealed)[0];
    return {
      word: randomCard ? randomCard.word.substring(0, 3).toUpperCase() : 'DICA',
      number: 1,
    };
  }
};

/**
 * Gera dica usando OpenAI (método avançado)
 */
// const generateClueWithOpenAI = async (teamCards, dangerousCards, targetCount, team) => {
//   const teamWords = teamCards.map(c => c.word).join(', ');
//   const dangerWords = dangerousCards.map(c => c.word).join(', ');
  
//   const prompt = `You are a Codenames spymaster for the ${team} team. 

// Your team's words are: ${teamWords}
// Dangerous words to avoid: ${dangerWords}

// Generate a one-word clue that relates to ${targetCount} of your team's words, but does NOT relate to any dangerous words.

// Respond in JSON format:
// {
//   "clue": "YOUR_CLUE_WORD",
//   "number": ${targetCount},
//   "reasoning": "brief explanation"
// }`;

//   try {
//     
    
//     const response = JSON.parse(completion.choices[0].message.content);
//     console.log('Bot clue reasoning:', response.reasoning);
    
//     return {
//       word: response.clue.toUpperCase(),
//       number: response.number,
//     };
//   } catch (error) {
//     console.error('Erro ao usar OpenAI:', error);
//     throw error;
//   }
// };

/**
 * Gera dica usando heurística simples (fallback)
 */
const generateClueHeuristic = (teamCards, dangerousCards, targetCount) => {
  // Encontrar clusters de palavras similares
  const clusters = findWordClusters(teamCards, teamCards[0].type);
  
  if (clusters.length > 0 && targetCount > 1) {
    // Usar cluster se quisermos múltiplas palavras
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
    const availableCards = board
      .map((card, index) => ({ ...card, index }))
      .filter(card => !card.revealed);
    
    if (availableCards.length === 0) {
      throw new Error('Nenhuma carta disponível');
    }
    
    const hintBasedGuessIndex = findHintBasedGuess(availableCards, clue?.word, team);
    if (hintBasedGuessIndex !== null && hintBasedGuessIndex !== undefined) {
      return hintBasedGuessIndex;
    }
    
    
    // if (openai && process.env.USE_OPENAI_FOR_GUESSES === 'true') {
    //   return await generateGuessWithOpenAI(availableCards, clue, team, difficulty);
    // }
    
    // Fallback: lógica simples
    return generateGuessHeuristic(availableCards, clue, team, difficulty);
    
  } catch (error) {
    console.error('Erro ao gerar palpite do bot:', error);
    // Fallback: carta aleatória
    const randomCard = board.filter(c => !c.revealed)[0];
    return randomCard ? board.indexOf(randomCard) : 0;
  }
};


// const generateGuessWithOpenAI = async (availableCards, clue, team, difficulty) => {
//   const cardWords = availableCards.map((c, i) => `${i}: ${c.word}`).join(', ');
  
//   const prompt = `You are a Codenames operative for the ${team} team.

// Your spymaster gave you the clue: "${clue.word}" ${clue.number}

// Available words: ${cardWords}

// Which word index is most related to the clue "${clue.word}"? Consider that you need to find ${clue.number} words.

// Respond with just the index number (0-${availableCards.length - 1}).`;

//   try {
//     const completion = await openai.chat.completions.create({
//       model: "gpt-4",
//       messages: [{ role: "user", content: prompt }],
//       temperature: 0.5,
//       max_tokens: 10,
//     });
    
//     const chosenIndex = parseInt(completion.choices[0].message.content.trim());
//     return availableCards[chosenIndex].index;
    
//   } catch (error) {
//     console.error('Erro ao usar OpenAI:', error);
//     throw error;
//   }
// };

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
    easy: 0.3,   // 30% de chance de erro
    medium: 0.15, // 15% de chance de erro
    hard: 0.05,   // 5% de chance de erro
  }[difficulty] || 0.15;
  
  if (Math.random() < noise) {
    // Escolher carta aleatória (simular erro)
    const randomCard = availableCards[Math.floor(Math.random() * availableCards.length)];
    return randomCard.index;
  }
  
  // Escolher carta com maior similaridade
  scores.sort((a, b) => b.similarity - a.similarity);
  return scores[0].index;
};

/**
 * Delay para simular "pensamento" do bot
 */
export const botThinkingDelay = (difficulty = 'medium') => {
  const delays = {
    easy: 1000,   // 1 segundo
    medium: 2000, // 2 segundos
    hard: 3000,   // 3 segundos
  };
  
  return new Promise(resolve => 
    setTimeout(resolve, delays[difficulty] || 2000)
  );
};
