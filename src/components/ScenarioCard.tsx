import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ScenarioCardProps {
  title: string;
  description: string;
  onRun: () => void;
  isRunning?: boolean;
}

const ScenarioCard = ({ title, description, onRun, isRunning }: ScenarioCardProps) => {
  return (
    <Card className="bg-card border-border card-hover">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{description}</p>
        <Button 
          variant="danger" 
          className="w-full gap-2" 
          onClick={onRun}
          disabled={isRunning}
        >
          <Play className="w-4 h-4" />
          {isRunning ? "Running..." : "Run Scenario"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ScenarioCard;
