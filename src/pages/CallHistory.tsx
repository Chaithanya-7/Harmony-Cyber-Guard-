import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  Phone, 
  Shield, 
  AlertTriangle, 
  ShieldOff,
  ArrowLeft,
  RefreshCw,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet-async";

interface CallRecord {
  id: string;
  duration: number;
  risk_level: 'safe' | 'warning' | 'blocked';
  risk_score: number;
  fraud_indicators: string[];
  scenario_type: string | null;
  caller_id: string | null;
  notes: string | null;
  created_at: string;
}

const CallHistory = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [filteredCalls, setFilteredCalls] = useState<CallRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [expandedCall, setExpandedCall] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCalls();
    }
  }, [user]);

  useEffect(() => {
    filterCalls();
  }, [calls, searchQuery, riskFilter]);

  const fetchCalls = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("call_history")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setCalls(data as CallRecord[] || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error fetching calls",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filterCalls = () => {
    let filtered = [...calls];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (call) =>
          call.caller_id?.toLowerCase().includes(query) ||
          call.scenario_type?.toLowerCase().includes(query) ||
          call.fraud_indicators?.some((i) => i.toLowerCase().includes(query))
      );
    }

    if (riskFilter !== "all") {
      filtered = filtered.filter((call) => call.risk_level === riskFilter);
    }

    setFilteredCalls(filtered);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getRiskBadge = (level: string) => {
    switch (level) {
      case "blocked":
        return (
          <Badge className="bg-primary/20 text-primary border-primary/30">
            <ShieldOff className="w-3 h-3 mr-1" />
            Blocked
          </Badge>
        );
      case "warning":
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Warning
          </Badge>
        );
      default:
        return (
          <Badge className="bg-success/20 text-success border-success/30">
            <Shield className="w-3 h-3 mr-1" />
            Safe
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Call History | CallGuard-Sentinel</title>
        <meta name="description" content="View and analyze your call history with detailed fraud detection reports" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 animate-fade-in">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Call History</h1>
                <p className="text-sm text-muted-foreground">
                  {filteredCalls.length} calls recorded
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={fetchCalls} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Filters */}
          <Card className="bg-card border-border mb-6 animate-slide-up">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by caller ID, scenario, or indicators..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Risk Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="safe">Safe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Call List */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                Loading call history...
              </div>
            ) : filteredCalls.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <Phone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {calls.length === 0
                      ? "No calls recorded yet. Make a call to start tracking."
                      : "No calls match your search criteria."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredCalls.map((call, index) => (
                <Collapsible
                  key={call.id}
                  open={expandedCall === call.id}
                  onOpenChange={() =>
                    setExpandedCall(expandedCall === call.id ? null : call.id)
                  }
                >
                  <Card
                    className="bg-card border-border card-hover animate-slide-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                              <Phone className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {call.caller_id || "Unknown Caller"}
                                </span>
                                {getRiskBadge(call.risk_level)}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(call.created_at), "PPp")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                              <p className="text-sm text-muted-foreground">Duration</p>
                              <p className="font-mono font-medium">
                                {formatDuration(call.duration)}
                              </p>
                            </div>
                            <div className="text-right hidden sm:block">
                              <p className="text-sm text-muted-foreground">Risk Score</p>
                              <p
                                className={`font-mono font-medium ${
                                  call.risk_score > 60
                                    ? "text-primary"
                                    : call.risk_score > 30
                                    ? "text-warning"
                                    : "text-success"
                                }`}
                              >
                                {call.risk_score.toFixed(0)}%
                              </p>
                            </div>
                            {expandedCall === call.id ? (
                              <ChevronUp className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="pt-0 border-t border-border">
                        <div className="grid gap-6 md:grid-cols-2 pt-4">
                          {/* Call Details */}
                          <div>
                            <h4 className="text-sm font-medium mb-3">Call Details</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Scenario Type</span>
                                <span className="capitalize">
                                  {call.scenario_type?.replace("_", " ") || "Manual Call"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Duration</span>
                                <span className="font-mono">{formatDuration(call.duration)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Risk Score</span>
                                <span className="font-mono">{call.risk_score.toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>

                          {/* Fraud Indicators */}
                          <div>
                            <h4 className="text-sm font-medium mb-3">Detected Indicators</h4>
                            {call.fraud_indicators && call.fraud_indicators.length > 0 ? (
                              <ul className="space-y-2">
                                {call.fraud_indicators.map((indicator, i) => (
                                  <li
                                    key={i}
                                    className="flex items-center gap-2 text-sm text-muted-foreground"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                                    {indicator}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                No fraud indicators detected
                              </p>
                            )}
                          </div>
                        </div>

                        {call.notes && (
                          <div className="mt-4 pt-4 border-t border-border">
                            <h4 className="text-sm font-medium mb-2">Notes</h4>
                            <p className="text-sm text-muted-foreground">{call.notes}</p>
                          </div>
                        )}

                        <div className="mt-4 pt-4 border-t border-border">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/call/${call.id}`)}
                            className="w-full sm:w-auto"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Full Details
                          </Button>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CallHistory;
