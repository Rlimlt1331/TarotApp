import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface Card {
  name: string;
  position: string;
  meaning?: string;
}

interface ReadingImage {
  data: string;
  mimeType?: string;
}

function parseImageData(image?: ReadingImage | string): ReadingImage | null {
  if (!image) return null;

  if (typeof image === 'string') {
    const dataUrlMatch = image.match(/^data:(.+);base64,(.+)$/);
    return dataUrlMatch
      ? { mimeType: dataUrlMatch[1], data: dataUrlMatch[2] }
      : { mimeType: 'image/jpeg', data: image };
  }

  const dataUrlMatch = image.data.match(/^data:(.+);base64,(.+)$/);
  return dataUrlMatch
    ? { mimeType: image.mimeType || dataUrlMatch[1], data: dataUrlMatch[2] }
    : { mimeType: image.mimeType || 'image/jpeg', data: image.data };
}

export async function generateReading(
  cards: Card[] = [],
  title?: string,
  image?: ReadingImage | string
): Promise<string> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not set, using placeholder interpretation');
      return generatePlaceholderInterpretation(cards, title);
    }

    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    });
    const imagePart = parseImageData(image);

    const cardsDescription = cards
      .map((card, index) => {
        const cardInfo = `Card ${index + 1} (${card.position}): ${card.name}`;
        return card.meaning ? `${cardInfo} - ${card.meaning}` : cardInfo;
      })
      .join('\n');

    const prompt = `You are an expert tarot card reader. Generate a detailed and insightful tarot reading interpretation.

${cardsDescription ? `Known or selected cards/context:\n${cardsDescription}` : 'No cards were manually selected. If an image is provided, identify the visible tarot cards and their spread positions from the photo.'}

${title ? `Reading Title: ${title}` : ''}

Provide a comprehensive interpretation that:
1. Explains the overall theme and message of the reading
2. Identifies and interprets each visible or selected card in the context of its position
3. Discusses the relationships and interactions between cards
4. Offers guidance or insights based on the spread
5. Is written in a poetic yet clear manner

Keep the interpretation between 300-500 words.`;

    const content = imagePart
      ? [
          prompt,
          {
            inlineData: {
              data: imagePart.data,
              mimeType: imagePart.mimeType || 'image/jpeg',
            },
          },
        ]
      : prompt;

    const result = await model.generateContent(content);
    const interpretation = result.response.text();

    return interpretation || generatePlaceholderInterpretation(cards, title);
  } catch (error) {
    console.error('Gemini API error:', error);
    return generatePlaceholderInterpretation(cards, title);
  }
}

function generatePlaceholderInterpretation(cards: Card[], title?: string): string {
  if (cards.length === 0) {
    return `This reading could not reach Gemini, but the uploaded spread still invites reflection.

Look at the strongest visual symbols in the spread, the cards that feel most central, and the story created by their positions. The clearest guidance is to name the present tension, notice what pattern is repeating, and choose one grounded action that restores agency.`;
  }

  const cardNames = cards.map((c) => c.name).join(', ');
  return `This reading features the following cards: ${cardNames}. 

Each card carries its own symbolism and energy. In this spread, ${cards[0].name} in the ${cards[0].position} position sets the foundation or focus. 

This reading invites you to reflect on the interconnected messages these cards bring together, considering both their individual meanings and how they interact as a unified whole.`;
}
