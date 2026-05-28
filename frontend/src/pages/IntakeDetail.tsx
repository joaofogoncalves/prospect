import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { intakesApi, MAX_REANALYSIS, type Intake } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Layout } from "@/components/Layout";
import { LogoMark } from "@/components/LogoMark";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// While analysis runs in the background (status "processing"), poll the detail
// endpoint until it settles. Cap the polling so a wedged job doesn't spin
// forever — after the cap we show a soft "taking longer" with a manual recheck.
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 60000;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}

export default function IntakeDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [intake, setIntake] = useState<Intake | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [triggering, setTriggering] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);

  const isProcessing = intake?.analysisStatus === "processing";

  const loadIntake = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setIntake(await intakesApi.get(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load intake");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Trigger (or retry/regenerate) analysis. Returns immediately with the intake
  // in "processing"; the poll effect below then watches it to completion.
  const runAnalyze = useCallback(async () => {
    if (!id) return;
    setAnalyzeError(null);
    setPollTimedOut(false);
    setTriggering(true);
    try {
      setIntake(await intakesApi.analyze(id));
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setTriggering(false);
    }
  }, [id]);

  // Silent re-fetch (no full-page loading flash) — used by the "Check again"
  // action after the poll cap is hit.
  const checkAgain = useCallback(async () => {
    if (!id) return;
    setPollTimedOut(false);
    try {
      setIntake(await intakesApi.get(id));
    } catch {
      /* leave the current view; the user can try again */
    }
  }, [id]);

  useEffect(() => {
    loadIntake();
  }, [loadIntake]);

  // Poll while a background analysis is running.
  useEffect(() => {
    if (!id || !isProcessing) return;
    let cancelled = false;
    const startedAt = Date.now();
    const interval = setInterval(async () => {
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        clearInterval(interval);
        if (!cancelled) setPollTimedOut(true);
        return;
      }
      try {
        const fresh = await intakesApi.get(id);
        if (!cancelled) setIntake(fresh); // a non-"processing" status ends the poll
      } catch {
        /* transient — keep polling */
      }
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id, isProcessing]);

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

      {loading && <LoadingState rows={2} />}

      {!loading && error && <ErrorState message={error} onRetry={loadIntake} />}

      {!loading && !error && intake && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{intake.title}</CardTitle>
              <CardDescription>
                Submitted by {intake.user.name ?? intake.user.email} ·{" "}
                {new Date(intake.createdAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <dl className="grid gap-4 sm:grid-cols-3">
                <Field label="Industry" value={intake.industry} />
                <Field label="Budget range" value={intake.budgetRange} />
                <Field label="Timeline" value={intake.timeline} />
              </dl>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Description
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm">
                  {intake.description}
                </dd>
              </div>
            </CardContent>
          </Card>

          <AiAnalysis
            intake={intake}
            isOwner={intake.userId === user?.id}
            busy={isProcessing || triggering}
            analyzeError={analyzeError}
            pollTimedOut={pollTimedOut}
            onRun={runAnalyze}
            onCheckAgain={checkAgain}
          />
        </div>
      )}
    </Layout>
  );
}

// The re-analyze action + its remaining-runs countdown. Owner-only. When the
// per-intake budget is spent the button is disabled with an explanatory note.
function ReanalyzeAction({
  label,
  remaining,
  onRun,
}: {
  label: string;
  remaining: number;
  onRun: () => void;
}) {
  const spent = remaining <= 0;
  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={onRun} disabled={spent}>
        {label}
      </Button>
      <span className="text-xs text-muted-foreground">
        {spent
          ? "No re-analyses left for this intake."
          : `You have ${remaining} ${remaining === 1 ? "analysis" : "analyses"} left.`}
      </span>
    </div>
  );
}

function AiAnalysis({
  intake,
  isOwner,
  busy,
  analyzeError,
  pollTimedOut,
  onRun,
  onCheckAgain,
}: {
  intake: Intake;
  isOwner: boolean;
  busy: boolean;
  analyzeError: string | null;
  pollTimedOut: boolean;
  onRun: () => void;
  onCheckAgain: () => void;
}) {
  const hasAnalysis = Boolean(intake.analyzedAt && intake.summary);
  const remaining = MAX_REANALYSIS - intake.analysisRunCount;
  // A failed background run, or an error from triggering one just now.
  const failure =
    analyzeError ??
    (intake.analysisStatus === "failed" ? intake.analysisError : null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>AI analysis</CardTitle>
            {intake.analyzedAt && (
              <CardDescription className="mt-1">
                Generated {new Date(intake.analyzedAt).toLocaleString()}
              </CardDescription>
            )}
          </div>
          {/* Regenerate is the owner action once analysis is complete. */}
          {isOwner && !busy && hasAnalysis && (
            <ReanalyzeAction
              label="Regenerate"
              remaining={remaining}
              onRun={onRun}
            />
          )}
        </div>
      </CardHeader>
      <CardContent>
        {busy && (
          <div className="flex flex-col gap-3 py-4">
            <div className="flex items-center gap-3 text-muted-foreground">
              <LogoMark animate size={20} />
              <span className="text-sm">
                Analyzing… this can take a few seconds.
              </span>
            </div>
            {pollTimedOut && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  This is taking longer than usual.
                </span>
                <Button variant="outline" size="sm" onClick={onCheckAgain}>
                  Check again
                </Button>
              </div>
            )}
          </div>
        )}

        {!busy && failure && (
          <div className="grid gap-3">
            <ErrorState message={failure} onRetry={isOwner ? onRun : undefined} />
            {isOwner && (
              <span className="text-xs text-muted-foreground">
                {remaining <= 0
                  ? "No re-analyses left for this intake."
                  : `You have ${remaining} ${remaining === 1 ? "analysis" : "analyses"} left.`}
              </span>
            )}
          </div>
        )}

        {!busy && !failure && !hasAnalysis && (
          <EmptyState
            title="No analysis yet"
            description={
              isOwner
                ? "Generate a summary, tags, and a risk checklist for this intake."
                : "Only the person who submitted this intake can run its analysis."
            }
            action={
              isOwner ? (
                <ReanalyzeAction
                  label="Generate analysis"
                  remaining={remaining}
                  onRun={onRun}
                />
              ) : undefined
            }
          />
        )}

        {!busy && !failure && hasAnalysis && (
          <div className="grid gap-6">
            <div>
              <h3 className="mb-1 text-sm font-medium">Summary</h3>
              <p className="text-sm text-muted-foreground">{intake.summary}</p>
            </div>

            {intake.tags && intake.tags.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {intake.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {intake.riskChecklist && intake.riskChecklist.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium">Risk checklist</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {intake.riskChecklist.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
