'use client';

import { useEffect, useState } from 'react';

interface TimerProps {
  initialSeconds: number;
  onTimeout?: () => void;
  onTick?: (remaining: number) => void;
}

export function Timer({ initialSeconds, onTimeout, onTick }: TimerProps) {
  const [remaining, setRemaining] = useState(initialSeconds);

  useEffect(() => {
    if (remaining <= 0) {
      onTimeout?.();
      return;
    }

    const interval = setInterval(() => {
      setRemaining((prev) => {
        const newValue = prev - 1;
        onTick?.(newValue);
        return newValue;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [remaining, onTimeout, onTick]);

  const formatTime = (seconds: number) => {
    return `${seconds}秒`;
  };

  return (
    <div className="text-center">
      <div className="text-4xl font-bold text-gray-800 mb-2">
        ⏱️ {formatTime(remaining)}
      </div>
      {remaining <= 5 && remaining > 0 && (
        <p className="text-sm text-gray-600">残り時間</p>
      )}
    </div>
  );
}

