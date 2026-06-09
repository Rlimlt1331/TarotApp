import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const PRIMARY_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_MODELS = [
  PRIMARY_GEMINI_MODEL,
  ...(process.env.GEMINI_FALLBACK_MODELS || 'gemini-2.5-flash-lite')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean),
].filter((model, index, models) => models.indexOf(model) === index);

interface Card {
  name: string;
  position: string;
  meaning?: string;
}

interface ReadingImage {
  data: string;
  mimeType?: string;
}

export interface DetectedCard {
  name: string;
  position: string;
  confidence?: string;
  visualEvidence?: string;
}

export interface GeneratedReading {
  detectedCards: DetectedCard[];
  interpretation: string;
}

export class GeminiGenerationError extends Error {
  status: number;
  retryDelay?: string;

  constructor(message: string, status = 502, retryDelay?: string) {
    super(message);
    this.name = 'GeminiGenerationError';
    this.status = status;
    this.retryDelay = retryDelay;
  }
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

function parseJsonObject(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return null;
    }
  }
}

function formatDetectedCards(cards: DetectedCard[]): string {
  if (cards.length === 0) {
    return 'Cards identified from image: None confidently identified.';
  }

  const cardLines = cards.map((card, index) => {
    const confidence = card.confidence ? ` (${card.confidence})` : '';
    const evidence = card.visualEvidence ? ` - ${card.visualEvidence}` : '';
    return `${index + 1}. ${card.position}: ${card.name}${confidence}${evidence}`;
  });

  return `Cards identified from image:\n${cardLines.join('\n')}`;
}

function getRetryDelay(error: any): string | undefined {
  const retryInfo = error?.errorDetails?.find?.((detail: any) => (
    detail?.['@type'] === 'type.googleapis.com/google.rpc.RetryInfo'
  ));

  return retryInfo?.retryDelay;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiError(error: any) {
  return [429, 500, 503, 504].includes(error?.status);
}

function shouldTryNextModel(error: any) {
  return [404, 429, 500, 503, 504].includes(error?.status);
}

function getGeminiErrorMessage(error: any, modelName: string) {
  if (error?.status === 429) {
    const retryDelay = getRetryDelay(error);
    return `Gemini quota exceeded for model "${modelName}".${retryDelay ? ` Retry after ${retryDelay}.` : ''} Check billing, rate limits, or choose a model with available quota.`;
  }

  if (error?.status === 404) {
    return `Gemini model "${modelName}" was not found or does not support generateContent. Choose a model returned by Google's models.list endpoint.`;
  }

  if (error?.status === 503) {
    return `Gemini model "${modelName}" is temporarily unavailable. The server retried and tried fallback models where configured.`;
  }

  return `Gemini generation failed while using model "${modelName}".`;
}

async function generateContentWithFallback(content: any) {
  let lastError: any;
  let lastModel = GEMINI_MODELS[0];

  for (const modelName of GEMINI_MODELS) {
    lastModel = modelName;
    const model = genAI.getGenerativeModel({ model: modelName });
    const attempts = 2;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return {
          result: await model.generateContent(content),
          modelName,
        };
      } catch (error: any) {
        lastError = error;
        console.error(`Gemini API error while using model "${modelName}" (attempt ${attempt}/${attempts}):`, error);

        if (attempt < attempts && isRetryableGeminiError(error)) {
          await sleep(1000 * attempt);
          continue;
        }

        break;
      }
    }

    if (!shouldTryNextModel(lastError)) {
      break;
    }
  }

  throw new GeminiGenerationError(
    `${getGeminiErrorMessage(lastError, lastModel)} Tried models: ${GEMINI_MODELS.join(', ')}.`,
    lastError?.status || 502,
    getRetryDelay(lastError)
  );
}

export async function generateReadingAnalysis(
  cards: Card[] = [],
  title?: string,
  image?: ReadingImage | string
): Promise<GeneratedReading> {
  const fallbackInterpretation = generatePlaceholderInterpretation(cards, title);

  try {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY not set, using placeholder interpretation');
      return {
        detectedCards: cards.map((card) => ({
          name: card.name,
          position: card.position,
          confidence: 'selected manually',
        })),
        interpretation: fallbackInterpretation,
      };
    }

    const imagePart = parseImageData(image);

    const cardsDescription = cards
      .map((card, index) => {
        const cardInfo = `Card ${index + 1} (${card.position}): ${card.name}`;
        return card.meaning ? `${cardInfo} - ${card.meaning}` : cardInfo;
      })
      .join('\n');

    const prompt = `You are an expert tarot card reader.

First identify the tarot cards visible in the image if an image is provided. Be explicit about uncertainty. If text on a card is readable, use it. If the image is unclear, say "Unknown card" and describe the visible symbols instead of pretending.

${cardsDescription ? `Known or selected cards/context:\n${cardsDescription}` : 'No cards were manually selected. Identify the visible tarot cards and spread positions from the photo.'}

${title ? `Reading Title: ${title}` : ''}

Return only valid JSON with this exact shape:
{
  "detectedCards": [
    {
      "name": "The card name or Unknown card",
      "position": "Visible spread position, such as left, center, right, past, present, future",
      "confidence": "high, medium, low, or selected manually",
      "visualEvidence": "short reason based on the image"
    }
  ],
  "interpretation": "A 300-500 word tarot reading that references the detected or selected cards."
}`;

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

    const { result, modelName } = await generateContentWithFallback(content);
    console.log(`Gemini reading generated with model "${modelName}"`);
    const responseText = result.response.text();
    const parsed = parseJsonObject(responseText);
    const detectedCards = Array.isArray(parsed?.detectedCards)
      ? parsed.detectedCards
          .filter((card: any) => card && typeof card.name === 'string')
          .map((card: any) => ({
            name: card.name,
            position: typeof card.position === 'string' ? card.position : 'Unknown position',
            confidence: typeof card.confidence === 'string' ? card.confidence : undefined,
            visualEvidence: typeof card.visualEvidence === 'string' ? card.visualEvidence : undefined,
          }))
      : cards.map((card) => ({
          name: card.name,
          position: card.position,
          confidence: 'selected manually',
        }));
    const interpretation = typeof parsed?.interpretation === 'string' && parsed.interpretation.trim()
      ? parsed.interpretation.trim()
      : responseText || fallbackInterpretation;

    return {
      detectedCards,
      interpretation: imagePart
        ? `${formatDetectedCards(detectedCards)}\n\n${interpretation}`
        : interpretation,
    };
  } catch (error) {
    if (error instanceof GeminiGenerationError) {
      throw error;
    }

    console.error(`Gemini API error while using models "${GEMINI_MODELS.join(', ')}":`, error);
    throw new GeminiGenerationError(
      `${getGeminiErrorMessage(error, PRIMARY_GEMINI_MODEL)} Tried models: ${GEMINI_MODELS.join(', ')}.`,
      (error as any)?.status || 502,
      getRetryDelay(error)
    );
  }
}

export async function generateReading(
  cards: Card[] = [],
  title?: string,
  image?: ReadingImage | string
): Promise<string> {
  const generated = await generateReadingAnalysis(cards, title, image);
  return generated.interpretation;
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

export async function generateAdvancedReading(
  image: string | undefined,
  manualCards: string[],
  question: string,
  horoscope: string
) {
  let detectedCards: string[] = [...manualCards];
  if (image) {
    const analysis = await generateReadingAnalysis([], question, image);
    detectedCards = analysis.detectedCards.map(c => c.name);
  }
  const cardsToUse = detectedCards.length > 0 ? detectedCards : manualCards;
  
  if (!process.env.GEMINI_API_KEY) {
    return {
      detectedCards: cardsToUse,
      tarotReading: "Placeholder Tarot Reading because Gemini API key is missing.",
      horoscopeReading: "Placeholder Horoscope Reading because Gemini API key is missing.",
      harmonizedReading: "Placeholder Harmonized Reading because Gemini API key is missing."
    };
  }

  try {
    const tarotPrompt = `You are a Tarot Vision AI. Based on the cards: ${cardsToUse.join(', ')} and the question: "${question}", provide a focused tarot reading.`;
    const tarotResult = await generateContentWithFallback(tarotPrompt);
    const tarotReading = tarotResult.result.response.text();

    const horoscopePrompt = `You are a Horoscope AI. The user's horoscope is ${horoscope}. Based on their sign, the cards: ${cardsToUse.join(', ')} and the question: "${question}", provide a horoscope reading.`;
    const horoscopeResult = await generateContentWithFallback(horoscopePrompt);
    const horoscopeReading = horoscopeResult.result.response.text();

    const harmonizePrompt = `You are an expert harmonizer. Combine the following Tarot reading and Horoscope reading into a single cohesive, harmonized reading for the user's question: "${question}".\n\nTarot Reading: ${tarotReading}\n\nHoroscope Reading: ${horoscopeReading}`;
    const harmonizeResult = await generateContentWithFallback(harmonizePrompt);
    const harmonizedReading = harmonizeResult.result.response.text();

    return {
      detectedCards: cardsToUse,
      tarotReading,
      horoscopeReading,
      harmonizedReading
    };
  } catch (error: any) {
    console.error("Advanced reading generation failed:", error);
    throw new GeminiGenerationError("Failed to generate advanced AI reading.");
  }
}

