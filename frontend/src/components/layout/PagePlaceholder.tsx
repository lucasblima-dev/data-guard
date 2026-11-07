import { Card } from "../ui/Card";

/** Casca temporaria das telas ainda nao implementadas. */
export function PagePlaceholder({ title, description }: { title: string; description: string }) {
  return (
    <Card className="p-8">
      <h1 className="text-2xl font-semibold tracking-tighter">{title}</h1>
      <p className="mt-1.5 text-sm text-fg-muted">{description}</p>
    </Card>
  );
}
