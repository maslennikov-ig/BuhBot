import { HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { documentation } from '@/config/documentation';
import { cn } from '@/lib/utils';

type DocEntry = { title: string; description: string };

interface HelpButtonProps {
  section: keyof typeof documentation | `settings.${keyof typeof documentation.settings}`;
  className?: string;
}

export function HelpButton({ section, className }: HelpButtonProps) {
  const getDoc = (): DocEntry | null => {
    if (section.startsWith('settings.')) {
      const key = section.split('.')[1] as keyof typeof documentation.settings;
      return documentation.settings[key];
    }
    const doc = documentation[section as keyof typeof documentation];
    if ('title' in doc && 'description' in doc) {
      return doc as DocEntry;
    }
    return null;
  };

  const content = getDoc();

  if (!content) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-primary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            className
          )}
          aria-label="Показать справку"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4">
        <div className="space-y-2">
          <h4 className="font-medium leading-none text-base">{content.title}</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{content.description}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
