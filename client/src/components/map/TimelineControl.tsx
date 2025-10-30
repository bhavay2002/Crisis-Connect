import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { format, subDays, startOfDay, endOfDay, isBefore, isAfter, isWithinInterval } from "date-fns";

interface TimelineControlProps {
  startDate: Date;
  endDate: Date;
  onTimeRangeChange: (start: Date, end: Date) => void;
}

export function TimelineControl({ startDate, endDate, onTimeRangeChange }: TimelineControlProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [speed, setSpeed] = useState(1);

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const maxSteps = Math.max(totalDays, 1);

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= maxSteps - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / speed);

    return () => clearInterval(interval);
  }, [isPlaying, maxSteps, speed]);

  useEffect(() => {
    const currentDate = new Date(startDate.getTime() + currentStep * 24 * 60 * 60 * 1000);
    onTimeRangeChange(startOfDay(startDate), endOfDay(currentDate));
  }, [currentStep, startDate, onTimeRangeChange]);

  const handleStepChange = (value: number[]) => {
    setCurrentStep(value[0]);
    setIsPlaying(false);
  };

  const handlePlayPause = () => {
    if (currentStep >= maxSteps - 1) {
      setCurrentStep(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const handleStepForward = () => {
    setCurrentStep((prev) => Math.min(prev + 1, maxSteps - 1));
    setIsPlaying(false);
  };

  const handleStepBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
    setIsPlaying(false);
  };

  const currentDate = new Date(startDate.getTime() + currentStep * 24 * 60 * 60 * 1000);

  return (
    <Card className="absolute bottom-4 left-4 right-4 z-[1000] shadow-lg" data-testid="timeline-control">
      <CardContent className="pt-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Timeline Playback</p>
              <p className="text-xs text-muted-foreground">
                {format(currentDate, "MMM dd, yyyy")} ({currentStep + 1} of {maxSteps})
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 4 : 1)}
                data-testid="button-speed"
              >
                {speed}x
              </Button>
            </div>
          </div>

          <Slider
            value={[currentStep]}
            onValueChange={handleStepChange}
            max={maxSteps - 1}
            step={1}
            className="w-full"
            data-testid="slider-timeline"
          />

          <div className="flex justify-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleReset}
              data-testid="button-reset"
            >
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleStepBack}
              disabled={currentStep === 0}
              data-testid="button-step-back"
            >
              Step Back
            </Button>
            <Button
              size="sm"
              onClick={handlePlayPause}
              data-testid="button-play-pause"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 mr-1" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" />
                  Play
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleStepForward}
              disabled={currentStep >= maxSteps - 1}
              data-testid="button-step-forward"
            >
              Step Forward
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentStep(maxSteps - 1)}
              data-testid="button-skip-forward"
            >
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
