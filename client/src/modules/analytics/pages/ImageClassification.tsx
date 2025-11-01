import { useState, useRef, useEffect } from 'react';
import { useImageClassification } from '@/hooks/useImageClassification';

type ClassificationResult = {
  disasterType: 'fire' | 'flood' | 'earthquake' | 'storm' | 'road_accident' | 'landslide' | 'other';
  confidence: number;
  rawPredictions: Array<{
    className: string;
    probability: number;
  }>;
};
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, AlertCircle, CheckCircle2, Loader2, Camera } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';

const DISASTER_TYPE_LABELS: Record<string, string> = {
  fire: 'Fire',
  flood: 'Flood',
  earthquake: 'Earthquake',
  storm: 'Storm',
  road_accident: 'Road Accident',
  landslide: 'Landslide',
  other: 'Other/Unknown'
};

const DISASTER_TYPE_COLORS: Record<string, string> = {
  fire: 'bg-red-500',
  flood: 'bg-blue-500',
  earthquake: 'bg-amber-500',
  storm: 'bg-purple-500',
  road_accident: 'bg-orange-500',
  landslide: 'bg-yellow-600',
  other: 'bg-gray-500'
};

export default function ImageClassification() {
  const { classifyImage, isLoading, isModelLoading, error, isReady } = useImageClassification();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (selectedImage) {
        URL.revokeObjectURL(selectedImage);
      }
    };
  }, [selectedImage]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return;
    }

    if (!isReady) {
      setUploadWarning('AI model is still loading. Please wait a moment and try again.');
      return;
    }

    setUploadWarning(null);

    if (selectedImage) {
      URL.revokeObjectURL(selectedImage);
    }

    const imageUrl = URL.createObjectURL(file);
    setSelectedImage(imageUrl);
    setResult(null);

    const classificationResult = await classifyImage(file);
    if (classificationResult) {
      setResult(classificationResult);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleReset = () => {
    if (selectedImage) {
      URL.revokeObjectURL(selectedImage);
    }
    setSelectedImage(null);
    setResult(null);
    setUploadWarning(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Image Classification</h1>
          <p className="text-muted-foreground">
            Upload an image to automatically detect the type of disaster using AI
          </p>
        </div>

        {isModelLoading && (
          <Alert className="mb-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              Loading AI model... This may take a few moments.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {uploadWarning && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{uploadWarning}</AlertDescription>
          </Alert>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Upload Image</CardTitle>
            <CardDescription>
              Select an image file to analyze and detect disaster type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-image-file"
            />

            {!selectedImage ? (
              <div
                onClick={handleUploadClick}
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
                data-testid="button-upload-area"
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-2">Click to upload an image</p>
                <p className="text-sm text-muted-foreground/75">
                  Supported formats: JPG, PNG, GIF, WebP
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden bg-muted">
                  <img
                    src={selectedImage}
                    alt="Selected for classification"
                    className="w-full h-auto max-h-96 object-contain mx-auto"
                    data-testid="img-preview"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleUploadClick}
                    variant="outline"
                    disabled={isLoading || !isReady}
                    data-testid="button-change-image"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Change Image
                  </Button>
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    disabled={isLoading}
                    data-testid="button-reset"
                  >
                    Reset
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {isLoading && (
          <Card>
            <CardContent className="py-8">
              <div className="flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Analyzing image...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {result && !isLoading && (
          <Card data-testid="card-classification-result">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Classification Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Detected Disaster Type
                </h3>
                <div className="flex items-center gap-3">
                  <Badge
                    className={`${DISASTER_TYPE_COLORS[result.disasterType]} text-white text-lg px-4 py-2`}
                    data-testid="badge-disaster-type"
                  >
                    {DISASTER_TYPE_LABELS[result.disasterType]}
                  </Badge>
                  <span className="text-2xl font-bold" data-testid="text-confidence">
                    {result.confidence.toFixed(1)}% confidence
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  AI Analysis Details
                </h3>
                <div className="space-y-2">
                  {result.rawPredictions.map((pred: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      data-testid={`prediction-${index}`}
                    >
                      <span className="text-sm font-medium">{pred.className}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-32 bg-muted-foreground/20 rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{ width: `${pred.probability * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-12 text-right">
                          {(pred.probability * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This is an AI-powered classification and may not be 100% accurate. 
                  Please verify the disaster type before submitting a report.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
