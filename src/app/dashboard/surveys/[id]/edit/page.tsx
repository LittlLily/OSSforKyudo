"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type AuthState =
  | { status: "loading" }
  | { status: "authed"; role: "admin" | "user" }
  | { status: "error"; message: string };

type QuestionForm = {
  prompt: string;
  type: "single" | "multiple";
  allowOptionAdd: boolean;
  options: string[];
};

type ProfileResult = {
  id: string;
  display_name: string | null;
  student_number: string | null;
  generation: string | null;
  gender: string | null;
};

type SearchFilters = {
  display_name: string;
  student_number: string;
  generation: string;
  gender: string;
};

type SurveyEditResponse = {
  survey?: {
    id: string;
    title: string;
    description: string | null;
    status: "draft" | "open" | "closed";
    opens_at: string | null;
    closes_at: string | null;
    is_anonymous: boolean;
  };
  questions?: {
    id: string;
    prompt: string;
    type: "single" | "multiple";
    allow_option_add: boolean;
    options: { id: string; label: string }[];
  }[];
  targets?: ProfileResult[];
  error?: string;
};

const emptyQuestion: QuestionForm = {
  prompt: "",
  type: "single",
  allowOptionAdd: false,
  options: ["", ""],
};

const toLocalInputValue = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function SurveyEditPage() {
  const params = useParams<{ id: string }>();
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "open" | "closed">("draft");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [questions, setQuestions] = useState<QuestionForm[]>([
    { ...emptyQuestion },
  ]);
  const [filters, setFilters] = useState<SearchFilters>({
    display_name: "",
    student_number: "",
    generation: "",
    gender: "",
  });
  const [searchResults, setSearchResults] = useState<ProfileResult[]>([]);
  const [searchSelected, setSearchSelected] = useState<string[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<ProfileResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    title?: string;
    questions?: string;
    targets?: string;
  }>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = `/login?next=/dashboard/surveys/${params.id}/edit`;
          return;
        }
        const data = (await res.json()) as {
          user?: { role?: "admin" | "user" };
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || "failed to load user");
        const role = data.user?.role ?? "user";
        if (role !== "admin") {
          setAuth({ status: "error", message: "forbidden" });
          return;
        }
        setAuth({ status: "authed", role });
      } catch (err) {
        setAuth({
          status: "error",
          message: err instanceof Error ? err.message : "unknown error",
        });
      }
    })();
  }, [params.id]);

  useEffect(() => {
    if (!params.id) return;
    (async () => {
      setMessage(null);
      try {
        const res = await fetch(`/api/admin/surveys/${params.id}`, {
          cache: "no-store",
        });
        if (res.status === 401) {
          location.href = `/login?next=/dashboard/surveys/${params.id}/edit`;
          return;
        }
        const data = (await res.json()) as SurveyEditResponse;
        if (!res.ok) throw new Error(data.error || "failed to load survey");
        if (!data.survey) throw new Error("survey not found");
        setTitle(data.survey.title ?? "");
        setDescription(data.survey.description ?? "");
        setStatus(data.survey.status);
        setOpensAt(
          data.survey.opens_at
            ? toLocalInputValue(new Date(data.survey.opens_at))
            : ""
        );
        setClosesAt(
          data.survey.closes_at
            ? toLocalInputValue(new Date(data.survey.closes_at))
            : ""
        );
        setIsAnonymous(Boolean(data.survey.is_anonymous));
        setSelectedAccounts(data.targets ?? []);
        const loadedQuestions: QuestionForm[] =
          data.questions?.map((question) => ({
            prompt: question.prompt ?? "",
            type: question.type === "multiple" ? "multiple" : "single",
            allowOptionAdd: Boolean(question.allow_option_add),
            options: question.options.map((option) => option.label ?? ""),
          })) ?? [];
        setQuestions(
          loadedQuestions.length ? loadedQuestions : [{ ...emptyQuestion }]
        );
        setLoaded(true);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "unknown error");
      }
    })();
  }, [params.id]);

  const updateQuestion = (index: number, value: Partial<QuestionForm>) => {
    setQuestions((prev) =>
      prev.map((question, i) =>
        i === index ? { ...question, ...value } : question
      )
    );
  };

  const updateOption = (
    questionIndex: number,
    optionIndex: number,
    value: string
  ) => {
    setQuestions((prev) =>
      prev.map((question, qIndex) => {
        if (qIndex !== questionIndex) return question;
        const options = question.options.map((option, oIndex) =>
          oIndex === optionIndex ? value : option
        );
        return { ...question, options };
      })
    );
  };

  const addOption = (questionIndex: number) => {
    setQuestions((prev) =>
      prev.map((question, qIndex) =>
        qIndex === questionIndex
          ? { ...question, options: [...question.options, ""] }
          : question
      )
    );
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    setQuestions((prev) =>
      prev.map((question, qIndex) => {
        if (qIndex !== questionIndex) return question;
        const options = question.options.filter((_, oIndex) => oIndex !== optionIndex);
        return { ...question, options: options.length ? options : [""] };
      })
    );
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, { ...emptyQuestion }]);
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateFilter = (key: keyof SearchFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const buildSearchParams = () => {
    const params = new URLSearchParams();
    if (filters.display_name) params.set("display_name", filters.display_name);
    if (filters.student_number)
      params.set("student_number", filters.student_number);
    if (filters.generation) params.set("generation", filters.generation);
    if (filters.gender) params.set("gender", filters.gender);
    return params.toString();
  };

  const searchProfiles = async () => {
    setSearching(true);
    setMessage(null);
    try {
      const query = buildSearchParams();
      const res = await fetch(`/api/admin/profile-list?${query}`, {
        cache: "no-store",
      });
      if (res.status === 401) {
        location.href = `/login?next=/dashboard/surveys/${params.id}/edit`;
        return;
      }
      const data = (await res.json()) as {
        users?: ProfileResult[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "failed to load users");
      setSearchResults(data.users ?? []);
      setSearchSelected([]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "unknown error");
    } finally {
      setSearching(false);
    }
  };

  const toggleSearchSelect = (accountId: string) => {
    setSearchSelected((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  };

  const toggleSelectAll = () => {
    if (searchSelected.length === searchResults.length) {
      setSearchSelected([]);
      return;
    }
    setSearchSelected(searchResults.map((user) => user.id));
  };

  const addSelectedAccounts = () => {
    if (searchSelected.length === 0) return;
    const selected = searchResults.filter((user) =>
      searchSelected.includes(user.id)
    );
    setSelectedAccounts((prev) => {
      const existing = new Set(prev.map((user) => user.id));
      const merged = [...prev];
      for (const user of selected) {
        if (!existing.has(user.id)) merged.push(user);
      }
      return merged;
    });
    setSearchSelected([]);
  };

  const removeSelectedAccount = (accountId: string) => {
    setSelectedAccounts((prev) => prev.filter((user) => user.id !== accountId));
  };

  const submit = async () => {
    setMessage(null);
    const nextErrors: { title?: string; questions?: string; targets?: string } =
      {};
    if (!title.trim()) {
      nextErrors.title = "タイトルは必須です";
    }
    if (questions.length === 0) {
      nextErrors.questions = "質問を1つ以上追加してください";
    }
    const hasEmptyQuestion = questions.some(
      (question) => !question.prompt.trim()
    );
    const hasEmptyOptions = questions.some(
      (question) =>
        question.options.map((option) => option.trim()).filter(Boolean).length ===
        0
    );
    if (hasEmptyQuestion || hasEmptyOptions) {
      nextErrors.questions =
        "質問文と選択肢をすべて入力してください";
    }
    if (selectedAccounts.length === 0) {
      nextErrors.targets = "対象者を1人以上選択してください";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      opens_at: opensAt ? new Date(opensAt).toISOString() : null,
      closes_at: closesAt ? new Date(closesAt).toISOString() : null,
      is_anonymous: isAnonymous,
      questions: questions.map((question) => ({
        prompt: question.prompt.trim(),
        type: question.type,
        allowOptionAdd: question.allowOptionAdd,
        options: question.options.map((option) => option.trim()).filter(Boolean),
      })),
      accountIds: selectedAccounts.map((account) => account.id),
    };

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/surveys/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "failed to update survey");
      location.href = `/dashboard/surveys/${params.id}`;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "unknown error");
    } finally {
      setLoading(false);
    }
  };

  if (auth.status === "loading" || !loaded) {
    return <main className="p-6">loading...</main>;
  }
  if (auth.status === "error") {
    return (
      <main className="p-6">
        <p>error: {auth.message}</p>
      </main>
    );
  }

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link className="underline" href={`/dashboard/surveys/${params.id}`}>
          Back
        </Link>
        <h1 className="text-2xl font-bold">Edit survey</h1>
      </div>

      {message ? <p className="text-sm">error: {message}</p> : null}

      <section className="space-y-3">
        <div>
          <label className="block text-sm font-semibold">Title</label>
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          {errors.title ? (
            <p className="mt-1 text-sm text-red-600">{errors.title}</p>
          ) : null}
        </div>
        <div>
          <label className="block text-sm font-semibold">Description</label>
          <textarea
            className="mt-1 w-full border rounded px-3 py-2"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-semibold">Status</label>
            <select
              className="mt-1 border rounded px-3 py-2"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "draft" | "open" | "closed")
              }
            >
              <option value="draft">draft</option>
              <option value="open">open</option>
              <option value="closed">closed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold">Open at</label>
            <input
              className="mt-1 border rounded px-3 py-2"
              type="datetime-local"
              value={opensAt}
              onChange={(event) => setOpensAt(event.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold">Close at</label>
            <input
              className="mt-1 border rounded px-3 py-2"
              type="datetime-local"
              value={closesAt}
              onChange={(event) => setClosesAt(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(event) => setIsAnonymous(event.target.checked)}
            />
            Anonymous
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Targets</h2>
        <div className="border rounded p-4 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              className="border rounded px-3 py-2"
              placeholder="display_name"
              value={filters.display_name}
              onChange={(event) =>
                updateFilter("display_name", event.target.value)
              }
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="student_number"
              value={filters.student_number}
              onChange={(event) =>
                updateFilter("student_number", event.target.value)
              }
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="generation"
              value={filters.generation}
              onChange={(event) =>
                updateFilter("generation", event.target.value)
              }
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="gender"
              value={filters.gender}
              onChange={(event) => updateFilter("gender", event.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="border rounded px-3 py-1"
              type="button"
              onClick={searchProfiles}
              disabled={searching}
            >
              {searching ? "Searching..." : "Search"}
            </button>
            <button
              className="text-xs underline"
              type="button"
              onClick={toggleSelectAll}
              disabled={searchResults.length === 0}
            >
              Select all
            </button>
            <button
              className="text-xs underline"
              type="button"
              onClick={addSelectedAccounts}
              disabled={searchSelected.length === 0}
            >
              Add selected
            </button>
          </div>
          <div className="space-y-2">
            {searchResults.length === 0 ? (
              <p className="text-sm">no results</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {searchResults.map((user) => (
                  <li key={user.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={searchSelected.includes(user.id)}
                      onChange={() => toggleSearchSelect(user.id)}
                    />
                    <span>{user.display_name ?? "-"}</span>
                    <span className="text-xs text-gray-600">
                      {user.student_number ?? "-"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="border rounded p-4 space-y-2">
          <div className="text-sm font-semibold">
            Selected ({selectedAccounts.length})
          </div>
          {selectedAccounts.length === 0 ? (
            <p className="text-sm">no selected accounts</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {selectedAccounts.map((user) => (
                <li key={user.id} className="flex items-center gap-2">
                  <span>{user.display_name ?? "-"}</span>
                  <span className="text-xs text-gray-600">
                    {user.student_number ?? "-"}
                  </span>
                  <button
                    className="text-xs underline"
                    type="button"
                    onClick={() => removeSelectedAccount(user.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          {errors.targets ? (
            <p className="text-sm text-red-600">{errors.targets}</p>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Questions</h2>
          <button
            className="border rounded px-3 py-1"
            type="button"
            onClick={addQuestion}
          >
            Add question
          </button>
        </div>
        {errors.questions ? (
          <p className="text-sm text-red-600">{errors.questions}</p>
        ) : null}
        {questions.map((question, index) => (
          <div key={index} className="border rounded p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold">Q{index + 1}</span>
              <select
                className="border rounded px-2 py-1"
                value={question.type}
                onChange={(event) =>
                  updateQuestion(index, {
                    type: event.target.value as "single" | "multiple",
                  })
                }
              >
                <option value="single">single</option>
                <option value="multiple">multiple</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={question.allowOptionAdd}
                  onChange={(event) =>
                    updateQuestion(index, {
                      allowOptionAdd: event.target.checked,
                    })
                  }
                />
                allow option add
              </label>
              <button
                className="text-xs underline"
                type="button"
                onClick={() => removeQuestion(index)}
                disabled={questions.length === 1}
              >
                Remove question
              </button>
            </div>
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="Question prompt"
              value={question.prompt}
              onChange={(event) =>
                updateQuestion(index, { prompt: event.target.value })
              }
            />
            <div className="space-y-2">
              {question.options.map((option, optionIndex) => (
                <div key={optionIndex} className="flex items-center gap-2">
                  <input
                    className="flex-1 border rounded px-3 py-2"
                    placeholder={`Option ${optionIndex + 1}`}
                    value={option}
                    onChange={(event) =>
                      updateOption(index, optionIndex, event.target.value)
                    }
                  />
                  <button
                    className="text-xs underline"
                    type="button"
                    onClick={() => removeOption(index, optionIndex)}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                className="text-xs underline"
                type="button"
                onClick={() => addOption(index)}
              >
                Add option
              </button>
            </div>
          </div>
        ))}
      </section>

      <div className="flex items-center gap-3">
        <button
          className="border rounded px-4 py-2"
          type="button"
          onClick={submit}
          disabled={loading}
        >
          {loading ? "Saving..." : "Update survey"}
        </button>
      </div>
    </main>
  );
}
