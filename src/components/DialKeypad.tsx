import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, Delete, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialKeypadProps {
  onCall: (phoneNumber: string) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

const keypadButtons = [
  { value: '1', letters: '' },
  { value: '2', letters: 'ABC' },
  { value: '3', letters: 'DEF' },
  { value: '4', letters: 'GHI' },
  { value: '5', letters: 'JKL' },
  { value: '6', letters: 'MNO' },
  { value: '7', letters: 'PQRS' },
  { value: '8', letters: 'TUV' },
  { value: '9', letters: 'WXYZ' },
  { value: '*', letters: '' },
  { value: '0', letters: '+' },
  { value: '#', letters: '' },
];

export function DialKeypad({ onCall, onCancel, disabled }: DialKeypadProps) {
  const [phoneNumber, setPhoneNumber] = useState('');

  const handleKeyPress = (value: string) => {
    if (phoneNumber.length < 15) {
      setPhoneNumber(prev => prev + value);
    }
  };

  const handleBackspace = () => {
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPhoneNumber('');
  };

  const handleCall = () => {
    if (phoneNumber.length >= 3) {
      onCall(phoneNumber);
    }
  };

  const formatPhoneNumber = (number: string) => {
    // Simple formatting for display
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    if (cleaned.length <= 10) return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    return `+${cleaned.slice(0, cleaned.length - 10)} ${cleaned.slice(-10, -7)}-${cleaned.slice(-7, -4)}-${cleaned.slice(-4)}`;
  };

  return (
    <div className="w-full max-w-xs mx-auto space-y-4">
      {/* Phone Number Display */}
      <div className="relative">
        <Input
          value={formatPhoneNumber(phoneNumber)}
          onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
          placeholder="Enter phone number"
          className="text-center text-2xl font-mono h-14 bg-secondary/50 border-border"
          disabled={disabled}
        />
        {phoneNumber && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Keypad Grid */}
      <div className="grid grid-cols-3 gap-2">
        {keypadButtons.map((btn) => (
          <Button
            key={btn.value}
            variant="secondary"
            onClick={() => handleKeyPress(btn.value)}
            disabled={disabled}
            className={cn(
              "h-16 flex flex-col items-center justify-center gap-0.5",
              "hover:bg-secondary/80 active:scale-95 transition-transform"
            )}
          >
            <span className="text-xl font-semibold">{btn.value}</span>
            {btn.letters && (
              <span className="text-[10px] text-muted-foreground tracking-widest">
                {btn.letters}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-2 pt-2">
        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={disabled}
            className="h-14"
          >
            Cancel
          </Button>
        )}
        
        <Button
          variant="ghost"
          onClick={handleBackspace}
          disabled={disabled || !phoneNumber}
          className={cn("h-14", !onCancel && "col-start-1")}
        >
          <Delete className="h-5 w-5" />
        </Button>

        <Button
          onClick={handleCall}
          disabled={disabled || phoneNumber.length < 3}
          className={cn(
            "h-14 bg-success hover:bg-success/90 text-success-foreground",
            !onCancel && "col-span-1"
          )}
        >
          <Phone className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
