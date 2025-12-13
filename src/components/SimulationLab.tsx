import { FlaskConical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ScenarioCard from "./ScenarioCard";
import { useState } from "react";
import { SimulationChat } from "./SimulationChat";

const scenarios = [
  {
    id: "irs",
    title: "IRS Impersonation",
    description: "Claims unpaid taxes and threatens arrest. Test your ability to spot government imposters.",
  },
  {
    id: "grandchild",
    title: "Grandchild in Trouble",
    description: "Fake grandchild claiming to be arrested abroad. Classic 'emergency' scam.",
  },
  {
    id: "tech",
    title: "Tech Support Fraud",
    description: "Fake support claiming computer virus. Don't give them remote access!",
  },
];

interface SimulationLabProps {
  onScenarioComplete: (result: { type: string; blocked: boolean }) => void;
}

const SimulationLab = ({ onScenarioComplete }: SimulationLabProps) => {
  const [runningScenarioId, setRunningScenarioId] = useState<string | null>(null);

  const handleRunScenario = (scenarioId: string) => {
    setRunningScenarioId(scenarioId);
  };

  const handleCloseSimulation = () => {
    setRunningScenarioId(null);
  };

  if (runningScenarioId) {
    const scenario = scenarios.find(s => s.id === runningScenarioId);
    return (
      <SimulationChat
        scenarioId={runningScenarioId}
        scenarioTitle={scenario?.title || 'Simulation'}
        onClose={handleCloseSimulation}
      />
    );
  }

  return (
    <Card className="bg-card border-border animate-slide-up">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <FlaskConical className="w-5 h-5 text-success" />
          Scam Simulation Lab
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Practice your defense skills against AI-powered scammers in a safe environment.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {scenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              title={scenario.title}
              description={scenario.description}
              isRunning={false}
              onRun={() => handleRunScenario(scenario.id)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SimulationLab;


