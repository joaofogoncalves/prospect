import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CircleCheck, Clock } from "lucide-react";
import { intakesApi, type Intake, type IntakeCreator } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@/lib/useQuery";
import { Layout } from "@/components/Layout";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type Sort = "newest" | "oldest" | "title";

// Other people's intakes can grow large, so that list is paged. "My intakes"
// stays unpaged — it's your own short working set.
const OTHERS_PAGE_SIZE = 8;

const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

function creatorLabel(c: IntakeCreator): string {
  return c.name ?? c.email;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function matchesSearch(intake: Intake, query: string): boolean {
  if (!query.trim()) return true;
  const haystack = [
    intake.title,
    intake.industry,
    intake.user.name ?? "",
    intake.user.email,
    // Tags are searchable but not shown by default — see matchedTags below.
    ...(Array.isArray(intake.tags) ? intake.tags : []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

// The intake's tags that contain the active search term. Empty when there's no
// search or nothing matches. Drives the contextual "matched tags" reveal: tags
// stay hidden on the list until they're the reason a row is in your results.
function matchedTags(intake: Intake, query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q || !Array.isArray(intake.tags)) return [];
  return intake.tags.filter((tag) => tag.toLowerCase().includes(q));
}

function sortIntakes(list: Intake[], sort: Sort): Intake[] {
  const sorted = [...list];
  switch (sort) {
    case "oldest":
      return sorted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    default:
      // ISO timestamps sort lexicographically, so newest-first is a reverse compare.
      return sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export default function IntakeList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error, reload } = useQuery(() => intakesApi.list());

  const [search, setSearch] = useState("");
  const [creatorId, setCreatorId] = useState("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [othersPage, setOthersPage] = useState(1);

  // Any filter/sort change resets the "others" list back to the first page.
  useEffect(() => setOthersPage(1), [search, creatorId, sort]);

  const { mine, others, creators } = useMemo(() => {
    const all = data ?? [];
    const mine = all.filter((i) => i.userId === user?.id);
    const others = all.filter((i) => i.userId !== user?.id);

    // Distinct creators among other people's intakes, for the filter dropdown.
    const seen = new Map<string, IntakeCreator>();
    for (const i of others) if (!seen.has(i.userId)) seen.set(i.userId, i.user);
    const creators = [...seen.values()].sort((a, b) =>
      creatorLabel(a).localeCompare(creatorLabel(b)),
    );

    return { mine, others, creators };
  }, [data, user?.id]);

  const myFiltered = useMemo(
    () => sortIntakes(mine.filter((i) => matchesSearch(i, search)), sort),
    [mine, search, sort],
  );

  const othersFiltered = useMemo(
    () =>
      sortIntakes(
        others.filter(
          (i) =>
            matchesSearch(i, search) &&
            (creatorId === "all" || i.userId === creatorId),
        ),
        sort,
      ),
    [others, search, creatorId, sort],
  );

  const pageCount = Math.max(1, Math.ceil(othersFiltered.length / OTHERS_PAGE_SIZE));
  const page = Math.min(othersPage, pageCount);
  const othersPageItems = othersFiltered.slice(
    (page - 1) * OTHERS_PAGE_SIZE,
    page * OTHERS_PAGE_SIZE,
  );

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Intakes</h1>
          <p className="text-sm text-muted-foreground">
            Browse every project request — yours and the rest of the team's.
          </p>
        </div>
        <Button onClick={() => navigate("/intakes/new")}>New intake</Button>
      </div>

      {loading && <LoadingState rows={4} />}

      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && data && data.length === 0 && (
        <EmptyState
          title="No intakes yet"
          description="Create the first project intake to get started."
          action={
            <Button onClick={() => navigate("/intakes/new")}>
              Create intake
            </Button>
          }
        />
      )}

      {!loading && !error && data && data.length > 0 && (
        <div className="grid gap-8">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, industry, tag, or person…"
              aria-label="Search intakes"
              className="max-w-xs"
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Created by
              <select
                value={creatorId}
                onChange={(e) => setCreatorId(e.target.value)}
                aria-label="Filter other intakes by creator"
                className={SELECT_CLASS}
                disabled={creators.length === 0}
              >
                <option value="all">Anyone</option>
                {creators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {creatorLabel(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                aria-label="Sort intakes"
                className={SELECT_CLASS}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="title">Title (A–Z)</option>
              </select>
            </label>
          </div>

          <Section
            id="section-mine"
            title="My intakes"
            count={mine.length}
            filtered={myFiltered.length}
          >
            <IntakeTable
              intakes={myFiltered}
              headingId="section-mine"
              search={search}
              empty={
                mine.length === 0
                  ? "You haven't submitted any intakes yet."
                  : "No intakes match your search."
              }
            />
          </Section>

          <Section
            id="section-others"
            title="All other intakes"
            count={others.length}
            filtered={othersFiltered.length}
          >
            <IntakeTable
              intakes={othersPageItems}
              headingId="section-others"
              showCreator
              search={search}
              empty={
                others.length === 0
                  ? "No one else has submitted an intake yet."
                  : "No intakes match your filters."
              }
            />
            {othersFiltered.length > OTHERS_PAGE_SIZE && (
              <Pagination
                page={page}
                pageCount={pageCount}
                total={othersFiltered.length}
                pageSize={OTHERS_PAGE_SIZE}
                onPrev={() => setOthersPage((p) => Math.max(1, p - 1))}
                onNext={() => setOthersPage((p) => Math.min(pageCount, p + 1))}
              />
            )}
          </Section>
        </div>
      )}
    </Layout>
  );
}

function Section({
  id,
  title,
  count,
  filtered,
  children,
}: {
  id: string;
  title: string;
  count: number;
  filtered: number;
  children: React.ReactNode;
}) {
  // Show "3 of 12" when a filter is hiding some rows, otherwise just the total.
  const label = filtered === count ? `${count}` : `${filtered} of ${count}`;
  return (
    <section>
      <h2
        id={id}
        className="mb-3 flex items-center gap-2 text-sm font-semibold"
      >
        {title}
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium tabular-nums text-primary dark:bg-primary/20">
          {label}
        </span>
      </h2>
      {children}
    </section>
  );
}

function IntakeTable({
  intakes,
  headingId,
  showCreator = false,
  search = "",
  empty,
}: {
  intakes: Intake[];
  headingId: string;
  showCreator?: boolean;
  search?: string;
  empty: string;
}) {
  if (intakes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm" aria-labelledby={headingId}>
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
            <th className="px-4 py-2.5">Title</th>
            <th className="px-4 py-2.5">Industry</th>
            {showCreator && <th className="px-4 py-2.5">Created by</th>}
            <th className="px-4 py-2.5 whitespace-nowrap">Created</th>
            <th className="px-4 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody>
          {intakes.map((intake) => {
            // Tags stay hidden by default; surface only the ones matching the
            // active search, so a tag-driven match shows *why* the row is here.
            const tags = matchedTags(intake, search);
            return (
            // The whole row is clickable, but the only interactive element is the
            // title <Link> — its ::after is stretched over the row. That keeps it
            // keyboard-operable (Tab to the link, Enter to open) without a
            // non-focusable onClick handler on the <tr>.
            <tr
              key={intake.id}
              className="group relative border-b transition-colors last:border-0 odd:bg-muted/20 hover:bg-muted/50 focus-within:bg-muted/50"
            >
              <td className="px-4 py-3">
                <Link
                  to={`/intakes/${intake.id}`}
                  className="font-medium outline-none after:absolute after:inset-0 after:rounded-sm group-hover:underline focus-visible:after:ring-2 focus-visible:after:ring-ring"
                >
                  {intake.title}
                </Link>
                <div className="text-xs text-muted-foreground">
                  {intake.budgetRange} · {intake.timeline}
                </div>
                {tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">
                      matched
                    </span>
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {intake.industry}
              </td>
              {showCreator && (
                <td className="px-4 py-3 text-muted-foreground">
                  {creatorLabel(intake.user)}
                </td>
              )}
              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                {formatDate(intake.createdAt)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge analyzed={Boolean(intake.analyzedAt)} />
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Status carries meaning by icon + text (not color alone), with solid tints that
// hold WCAG AA contrast in both themes: green = analyzed, amber = pending.
function StatusBadge({ analyzed }: { analyzed: boolean }) {
  return analyzed ? (
    <Badge className="gap-1 border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
      <CircleCheck className="size-3" />
      Analyzed
    </Badge>
  ) : (
    <Badge className="gap-1 border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
      <Clock className="size-3" />
      Not analyzed
    </Badge>
  );
}

function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPrev,
  onNext,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Showing {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={page <= 1}
        >
          Previous
        </Button>
        <span className="tabular-nums">
          Page {page} of {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={page >= pageCount}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
