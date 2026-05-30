import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface Card {
  name: string;
  position: string;
  meaning?: string;
}

export async function generateReading(cards: Card[], title?: string): Promise<string> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not set, using placeholder interpretation');
      return generatePlaceholderInterpretation(cards, title);
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const cardsDescription = cards
      .map((card, index) => {
        const cardInfo = `Card ${index + 1} (${card.position}): ${card.name}`;
        return card.meaning ? `${cardInfo} - ${card.meaning}` : cardInfo;
      })
      .join('\n');

    const prompt = `You are an expert tarot card reader. Generate a detailed and insightful tarot reading interpretation based on the following cards:

${cardsDescription}

${title ? `Reading Title: ${title}` : ''}

Provide a comprehensive interpretation that:
1. Explains the overall theme and message of the reading
2. Interprets each card's meaning in the context of its position
3. Discusses the relationships and interactions between cards
4. Offers guidance or insights based on the spread
5. Is written in a poetic yet clear manner

Keep the interpretation between 300-500 words.`;

    const result = await model.generateContent(prompt);
    const interpretation = result.response.text();

    return interpretation || generatePlaceholderInterpretation(cards, title);
  } catch (error) {
    console.error('Gemini API error:', error);
    return generatePlaceholderInterpretation(cards, title);
  }
}

function generatePlaceholderInterpretation(cards: Card[], title?: string): string {
  const cardNames = cards.map((c) => c.name).join(', ');
  return `This reading features the following cards: ${cardNames}. 

Each card carries its own symbolism and energy. In this spread, ${cards[0].name} in the ${cards[0].position} position sets the foundation or focus. 

This reading invites you to reflect on the interconnected messages these cards bring together, considering both their individual meanings and how they interact as a unified whole.`;
}
