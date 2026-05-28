import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { intakesApi, type IntakeInput } from "@/lib/api";
import { Layout } from "@/components/Layout";
import { LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const EMPTY: IntakeInput = {
  title: "",
  description: "",
  budgetRange: "",
  timeline: "",
  industry: "",
};

type Phase = "form" | "working" | "error";

export default function IntakeCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState<IntakeInput>(EMPTY);
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  // Set once the intake is persisted; lets us retry analysis without re-creating
  // (and without the user re-entering anything).
  const [savedId, setSavedId] = useState<string | null>(null);

  function update<K extends keyof IntakeInput>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Create the intake (server also runs analysis). Used for the initial submit
  // and for retrying when creation itself failed.
  async function submitCreate(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setPhase("working");
    try {
      const intake = await intakesApi.create(form);
      if (intake.analyzedAt) {
        navigate(`/intakes/${intake.id}`); // created + analyzed
        return;
      }
      // Intake saved, but analysis failed — recoverable, no data lost.
      setSavedId(intake.id);
      setError(intake.analysisError ?? "AI analysis failed.");
      setPhase("error");
    } catch (err) {
      // Creation itself failed; the form values are still intact.
      setError(err instanceof Error ? err.message : "Failed to create intake");
      setPhase("error");
    }
  }

  // Retry analysis for an already-saved intake.
  async function retryAnalysis() {
    if (!savedId) return;
    setError(null);
    setPhase("working");
    try {
      await intakesApi.analyze(savedId);
      navigate(`/intakes/${savedId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setPhase("error");
    }
  }

  // Working: creating and/or analyzing.
  if (phase === "working") {
    return (
      <Layout>
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>
              {savedId ? "Re-running analysis…" : "Creating intake…"}
            </CardTitle>
            <CardDescription>
              Generating an AI summary, tags, and risk checklist. This can take a
              few seconds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoadingState rows={2} />
          </CardContent>
        </Card>
      </Layout>
    );
  }

  // Error after the intake was saved: offer retry / continue / cancel.
  if (phase === "error" && savedId) {
    return (
      <Layout>
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>Intake saved — analysis failed</CardTitle>
            <CardDescription>
              Your intake <strong>“{form.title}”</strong> was saved. The AI
              analysis didn’t complete, but nothing you entered was lost.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
            >
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => navigate("/")}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/intakes/${savedId}`)}
            >
              Continue without analysis
            </Button>
            <Button onClick={retryAnalysis}>Retry analysis</Button>
          </CardFooter>
        </Card>
      </Layout>
    );
  }

  // Default: the form (also shown when creation itself failed, values intact).
  return (
    <Layout>
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          ← Back to intakes
        </Button>
      </div>

      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>New intake</CardTitle>
          <CardDescription>
            We’ll generate an AI summary, tags, and a risk checklist when you
            create it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form id="intake-form" onSubmit={submitCreate} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. Enterprise demand-forecasting platform"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="What is being requested and why?"
                rows={5}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="budgetRange">Budget range</Label>
                <Input
                  id="budgetRange"
                  value={form.budgetRange}
                  onChange={(e) => update("budgetRange", e.target.value)}
                  placeholder="e.g. $2M – $4M"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="timeline">Timeline</Label>
                <Input
                  id="timeline"
                  value={form.timeline}
                  onChange={(e) => update("timeline", e.target.value)}
                  placeholder="e.g. 9 months"
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="industry">Industry</Label>
              <Input
                id="industry"
                value={form.industry}
                onChange={(e) => update("industry", e.target.value)}
                placeholder="e.g. Retail"
                required
              />
            </div>

            {phase === "error" && error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
              >
                <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            )}
          </form>
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate("/")}>
            Cancel
          </Button>
          <Button type="submit" form="intake-form">
            {phase === "error" ? "Try again" : "Create intake"}
          </Button>
        </CardFooter>
      </Card>
    </Layout>
  );
}
