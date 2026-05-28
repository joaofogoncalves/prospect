import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { intakesApi, type IntakeInput } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Layout } from "@/components/Layout";
import { Button, buttonVariants } from "@/components/ui/button";
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

export default function IntakeCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState<IntakeInput>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof IntakeInput>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Create the intake, then hand off to the detail view. Analysis runs as a
  // background job server-side, so creation returns immediately (status
  // "processing") — the detail page shows the live analysis and offers retry.
  // On a creation failure the form (and entered values) stay intact.
  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const intake = await intakesApi.create(form);
      navigate(`/intakes/${intake.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create intake");
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <div className="mb-6">
        <Link
          to="/"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "text-muted-foreground",
          )}
        >
          <ArrowLeft aria-hidden="true" />
          Back to intakes
        </Link>
      </div>

      <Card key="form" className="pi-phase-enter mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>New intake</CardTitle>
          <CardDescription>
            We’ll generate an AI summary, tags, and a risk checklist right after
            you create it.
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

            {error && (
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
          <Button type="submit" form="intake-form" disabled={submitting}>
            {submitting ? "Creating…" : error ? "Try again" : "Create intake"}
          </Button>
        </CardFooter>
      </Card>
    </Layout>
  );
}
