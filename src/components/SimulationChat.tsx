
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, AlertTriangle, CheckCircle, RotateCcw, XCircle } from "lucide-react";

interface Message {
    role: 'user' | 'system' | 'assistant';
    content: string;
}

interface SimulationChatProps {
    scenarioId: string;
    scenarioTitle: string;
    onClose: () => void;
}

// --- Dynamic Mock Logic ---
const getSmartMockResponse = (scenario: string, userText: string): { text: string; scoreDelta: number; status?: 'failed' | 'success' } => {
    const lower = userText.toLowerCase();

    if (scenario === 'irs') {
        if (lower.includes('police') || lower.includes('cop') || lower.includes('lawyer')) {
            return {
                text: "There is no need to involve them! This is a federal matter. If you hang up to call them, we will send officers to arrest you immediately!",
                scoreDelta: 10
            };
        }
        if (lower.includes('fake') || lower.includes('scam') || lower.includes('liar')) {
            return {
                text: "How dare you! I am a federal officer! ID Badge 9928. Do not disrespect authority or I will increase the penalty.",
                scoreDelta: 15
            };
        }
        if (lower.includes('gift card') || lower.includes('apple') || lower.includes('target')) {
            return {
                text: "Yes, exactly. Go to the store now. Do not speak to anyone. Buy $500 in cards and read me the numbers.",
                scoreDelta: -30,
                status: 'failed'
            };
        }
        if (lower.includes('pay') || lower.includes('money') || lower.includes('bank')) {
            return {
                text: "We need the payment immediately to stop the warrant. Can you verify your bank account number for me?",
                scoreDelta: -20
            };
        }
        return {
            text: "Stop wasting time. The warrant is active. You must resolve this payment or go to jail. Do you understand?",
            scoreDelta: -5
        };
    }

    if (scenario === 'grandchild') {
        if (lower.includes('name') || lower.includes('who is this')) {
            return {
                text: "It's me... your favorite grandchild... I have a cold so I sound different. Please don't quiz me, I'm scared!",
                scoreDelta: 10
            };
        }
        if (lower.includes('mom') || lower.includes('dad') || lower.includes('parents')) {
            return {
                text: "No! Don't tell them! They will be so mad at me. Please just help me first.",
                scoreDelta: 5
            };
        }
        if (lower.includes('wire') || lower.includes('send') || lower.includes('money')) {
            return {
                text: "Yes please hurry. Send it to the bail bondsman via Western Union. The name is 'Jose Rodrigues'.",
                scoreDelta: -25,
                status: 'failed'
            };
        }
        return {
            text: "Grandma/Grandpa, please... I just want to come home. They say I need $2,000.",
            scoreDelta: -5
        };
    }

    // Default / Tech Support
    if (lower.includes('download') || lower.includes('install') || lower.includes('click')) {
        return {
            text: "Good. Now open the file 'Support.exe' so I can fix the virus. It is very dangerous.",
            scoreDelta: -30,
            status: 'failed'
        };
    }
    if (lower.includes('mac') || lower.includes('apple') || lower.includes('linux')) {
        return {
            text: "The virus affects those computers too! It is capturing your IP address right now.",
            scoreDelta: 10
        };
    }
    return {
        text: "Do you see the error on your screen? I need to connect remotely to delete the hackers.",
        scoreDelta: -5
    };
};

const OPENERS: Record<string, string> = {
    irs: "This is Officer Smith from the IRS. We have a warrant for your arrest due to unpaid taxes. Listen carefully.",
    grandchild: "Grandma? It's me... I've been in a bad accident... please help me.",
    tech: "Hello, this is Windows Technical Support. Your computer has sent us a distress signal about a virus."
};

export function SimulationChat({ scenarioId, scenarioTitle, onClose }: SimulationChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [score, setScore] = useState(100);
    const [status, setStatus] = useState<'ongoing' | 'success' | 'failed'>('ongoing');

    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        startSimulation();
    }, [scenarioId]);

    // Auto-scroll logic
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const startSimulation = async () => {
        setIsLoading(true);
        setMessages([]);
        setScore(100);
        setStatus('ongoing');

        const opener = OPENERS[scenarioId] || OPENERS.irs;

        // Fake loading for realism
        await new Promise(r => setTimeout(r, 600));

        setMessages([{ role: 'assistant', content: opener }]);
        setIsLoading(false);
    };

    const handleSend = async () => {
        const textToSend = input;
        if (!textToSend.trim() || isLoading || status !== 'ongoing') return;

        setInput("");
        const newMessages: Message[] = [...messages, { role: 'user', content: textToSend }];
        setMessages(newMessages);
        setIsLoading(true);

        // Simulate thinking delay
        await new Promise(r => setTimeout(r, 1200));

        const response = getSmartMockResponse(scenarioId, textToSend);

        setMessages(prev => [...prev, { role: 'assistant', content: response.text }]);

        // Score Update
        let newScore = Math.min(100, Math.max(0, score + response.scoreDelta));
        setScore(newScore);

        if (response.status) {
            setStatus(response.status);
        } else if (newScore < 30) {
            setStatus('failed');
        } else if (newMessages.length >= 8) {
            setStatus('success');
        }

        setIsLoading(false);
    };

    const getStatusColor = () => {
        if (score > 70) return "text-green-500";
        if (score > 40) return "text-yellow-500";
        return "text-red-500";
    };

    return (
        <Card className="h-[600px] flex flex-col border-primary/20 shadow-lg animate-in fade-in zoom-in-95 duration-300">
            <CardHeader className="border-b bg-muted/30 pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Bot className="w-5 h-5 text-primary" />
                        {scenarioTitle} Simulation
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`${getStatusColor()} font-bold`}>
                            Score: {score}%
                        </Badge>
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <XCircle className="w-5 h-5" />
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-hidden p-0 relative">
                <ScrollArea className="h-full p-4">
                    <div className="space-y-4 pb-4">
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${msg.role === 'user'
                                        ? 'bg-primary text-primary-foreground rounded-br-none'
                                        : 'bg-muted text-foreground rounded-bl-none border border-border'
                                        }`}
                                >
                                    <p>{msg.content}</p>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start w-full">
                                <div className="bg-muted px-4 py-2 rounded-lg rounded-bl-none text-sm text-muted-foreground animate-pulse">
                                    Scammer is typing...
                                </div>
                            </div>
                        )}
                        <div ref={scrollRef} />
                    </div>
                </ScrollArea>

                {/* Game Over Overlay */}
                {status !== 'ongoing' && (
                    <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in z-50">
                        {status === 'success' ? (
                            <CheckCircle className="w-16 h-16 text-green-500 mb-4 animate-bounce" />
                        ) : (
                            <AlertTriangle className="w-16 h-16 text-red-500 mb-4 animate-pulse" />
                        )}
                        <h2 className="text-3xl font-bold mb-2">
                            {status === 'success' ? 'Scam Blocked!' : 'You Got Scammed!'}
                        </h2>
                        <p className="text-muted-foreground mb-6 max-w-sm">
                            {status === 'success'
                                ? "Excellent work! You asked the right questions and didn't give in to pressure."
                                : "The scammer convinced you to comply. In real life, never send money or give access to strangers."}
                        </p>
                        <div className="flex gap-4">
                            <Button onClick={onClose} variant="outline">Exit</Button>
                            <Button onClick={startSimulation} className="gap-2">
                                <RotateCcw className="w-4 h-4" /> Try Again
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>

            <CardFooter className="p-3 bg-muted/30 border-t">
                <form
                    className="flex w-full gap-2"
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                >
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your response..."
                        disabled={isLoading || status !== 'ongoing'}
                        className="flex-1"
                    />
                    <Button type="submit" size="icon" disabled={isLoading || status !== 'ongoing'}>
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            </CardFooter>
        </Card>
    );
}
