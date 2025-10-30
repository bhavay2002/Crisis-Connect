import { useState, useCallback, useEffect } from 'react';
import * as mobilenet from '@tensorflow-models/mobilenet';
import * as tf from '@tensorflow/tfjs';

type DisasterType = 'fire' | 'flood' | 'earthquake' | 'storm' | 'road_accident' | 'landslide' | 'other';

interface ClassificationResult {
  disasterType: DisasterType;
  confidence: number;
  rawPredictions: Array<{
    className: string;
    probability: number;
  }>;
}

const DISASTER_KEYWORDS: Record<DisasterType, string[]> = {
  fire: ['flame', 'fire', 'smoke', 'burning', 'inferno', 'blaze', 'torch', 'volcano'],
  flood: ['flood', 'water', 'rain', 'river', 'ocean', 'wave', 'tsunami', 'storm surge', 'underwater'],
  earthquake: ['rubble', 'debris', 'collapsed', 'destruction', 'crack', 'ruins', 'damaged building'],
  storm: ['hurricane', 'tornado', 'cyclone', 'storm', 'thunder', 'lightning', 'wind', 'typhoon'],
  road_accident: ['car', 'vehicle', 'truck', 'crash', 'accident', 'collision', 'ambulance', 'wreck'],
  landslide: ['landslide', 'mud', 'cliff', 'erosion', 'rockslide', 'avalanche', 'debris flow'],
  other: []
};

function mapPredictionToDisasterType(predictions: Array<{ className: string; probability: number }>): ClassificationResult {
  const disasterScores: Record<DisasterType, number> = {
    fire: 0,
    flood: 0,
    earthquake: 0,
    storm: 0,
    road_accident: 0,
    landslide: 0,
    other: 0
  };

  predictions.forEach(pred => {
    const className = pred.className.toLowerCase();
    
    Object.entries(DISASTER_KEYWORDS).forEach(([disasterType, keywords]) => {
      const matchScore = keywords.reduce((score, keyword) => {
        if (className.includes(keyword.toLowerCase())) {
          return score + pred.probability;
        }
        return score;
      }, 0);
      
      disasterScores[disasterType as DisasterType] += matchScore;
    });
  });

  const entries = Object.entries(disasterScores) as Array<[DisasterType, number]>;
  entries.sort((a, b) => b[1] - a[1]);
  
  const topMatch = entries[0];
  const detectedType = topMatch[1] > 0 ? topMatch[0] : 'other';
  
  return {
    disasterType: detectedType,
    confidence: Math.min(topMatch[1] * 100, 100),
    rawPredictions: predictions.slice(0, 5)
  };
}

export function useImageClassification() {
  const [model, setModel] = useState<mobilenet.MobileNet | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadModel = async () => {
      try {
        setIsModelLoading(true);
        await tf.ready();
        const loadedModel = await mobilenet.load();
        setModel(loadedModel);
      } catch (err) {
        setError('Failed to load AI model. Please refresh the page.');
        console.error('Error loading model:', err);
      } finally {
        setIsModelLoading(false);
      }
    };

    loadModel();
  }, []);

  const classifyImage = useCallback(async (imageFile: File): Promise<ClassificationResult | null> => {
    if (!model) {
      setError('Model not loaded yet. Please wait.');
      return null;
    }

    try {
      setIsLoading(true);
      setError(null);

      const img = document.createElement('img');
      const imageUrl = URL.createObjectURL(imageFile);
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      const predictions = await model.classify(img);
      
      URL.revokeObjectURL(imageUrl);

      const result = mapPredictionToDisasterType(predictions);
      return result;
    } catch (err) {
      setError('Failed to classify image. Please try again.');
      console.error('Error classifying image:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [model]);

  return {
    classifyImage,
    isLoading,
    isModelLoading,
    error,
    isReady: !!model
  };
}
