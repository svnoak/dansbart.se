import { Link } from 'react-router-dom';
import { Card, Button } from '@/ui';

export function WeeklyChallengeCard() {
  return (
    <Card className="border-2 border-[rgb(var(--color-accent))]/30 bg-[rgb(var(--color-accent-muted))]/40 p-4">
      <h3 className="font-semibold text-[rgb(var(--color-text))]">
        Veckans utmaning
      </h3>
      <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">
        Hjälp till att förbättra klassificeringen av dansstilar genom att granska och rösta på låtar.
      </p>
      <Link to="/classify" className="mt-4 block">
        <Button variant="primary" size="sm" className="w-full">
          Starta quiz
        </Button>
      </Link>
    </Card>
  );
}
