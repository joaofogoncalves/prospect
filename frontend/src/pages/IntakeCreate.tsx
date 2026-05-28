import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { intakesApi, type IntakeInput } from "@/lib/api";
import { Layout } from "@/components/Layout";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const intake = await intakesApi.create(form);
      // Go straight to the detail view, where AI analysis runs.
      navigate(`/intakes/${intake.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create intake");
      setSubmitting(false);
    }
  }

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
        </CardHeader>
        <CardContent>
          <form id="intake-form" onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. East span bridge repair bond"
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
                  placeholder="e.g. $1M – $2M"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="timeline">Timeline</Label>
                <Input
                  id="timeline"
                  value={form.timeline}
                  onChange={(e) => update("timeline", e.target.value)}
                  placeholder="e.g. 6 months"
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
                placeholder="e.g. Infrastructure"
                required
              />
            </div>

            {error && (
              <ErrorState message={error} onRetry={() => setError(null)} />
            )}
          </form>
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/")}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" form="intake-form" disabled={submitting}>
            {submitting ? "Creating…" : "Create intake"}
          </Button>
        </CardFooter>
      </Card>
    </Layout>
  );
}
