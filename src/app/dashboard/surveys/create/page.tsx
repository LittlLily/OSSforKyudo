"use client";

import Link from "next/link";
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

type TargetGroupForm = {
  display_name: string;
  student_number: string;
  generation: string;
  gender: string;
};

const emptyQuestion: QuestionForm = {
  prompt: "",
  type: "single",
  allowOptionAdd: false,
  options: ["", ""],
};

const emptyGroup: TargetGroupForm = {
  display_name: "",
  student_number: "",
  generation: "",
  gender: "",
};

export default function SurveyCreatePage() {
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
  const [targetGroups, setTargetGroups] = useState<TargetGroupForm[]>([
    { ...emptyGroup },
  ]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (res.status === 401) {
          location.href = "/login?next=/dashboard/surveys/create";
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
  }, []);

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

  const updateGroup = (index: number, value: Partial<TargetGroupForm>) => {
    setTargetGroups((prev) =>
      prev.map((group, i) => (i === index ? { ...group, ...value } : group))
    );
  };

  const addGroup = () => {
    setTargetGroups((prev) => [...prev, { ...emptyGroup }]);
  };

  const removeGroup = (index: number) => {
    setTargetGroups((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async () => {
    setMessage(null);
    if (!title.trim()) {
      setMessage("title is required");
      return;
    }
    if (questions.length === 0) {
      setMessage("questions required");
      return;
    }

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
      targetGroups: targetGroups.map((group) => ({
        conditions: [
          { field: "display_name", value: group.display_name.trim() },
          { field: "student_number", value: group.student_number.trim() },
          { field: "generation", value: group.generation.trim() },
          { field: "gender", value: group.gender.trim() },
        ].filter((condition) => condition.value),
      })),
    };

    setLoading(true);
    try {
      const res = await fetch("/api/admin/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "failed to create survey");
      if (data.id) {
        location.href = `/dashboard/surveys/${data.id}`;
        return;
      }
      setMessage("created");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "unknown error");
    } finally {
      setLoading(false);
    }
  };

  if (auth.status === "loading") return <main className="p-6">loading...</main>;
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
        <Link className="underline" href="/dashboard/surveys">
          Back
        </Link>
        <h1 className="text-2xl font-bold">Create survey</h1>
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
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Target groups (OR)</h2>
          <button
            className="border rounded px-3 py-1"
            type="button"
            onClick={addGroup}
          >
            Add group
          </button>
        </div>
        {targetGroups.map((group, index) => (
          <div key={index} className="border rounded p-4 space-y-2">
            <div className="text-sm font-semibold">Group {index + 1} (AND)</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="border rounded px-3 py-2"
                placeholder="display_name"
                value={group.display_name}
                onChange={(event) =>
                  updateGroup(index, { display_name: event.target.value })
                }
              />
              <input
                className="border rounded px-3 py-2"
                placeholder="student_number"
                value={group.student_number}
                onChange={(event) =>
                  updateGroup(index, { student_number: event.target.value })
                }
              />
              <input
                className="border rounded px-3 py-2"
                placeholder="generation"
                value={group.generation}
                onChange={(event) =>
                  updateGroup(index, { generation: event.target.value })
                }
              />
              <input
                className="border rounded px-3 py-2"
                placeholder="gender"
                value={group.gender}
                onChange={(event) =>
                  updateGroup(index, { gender: event.target.value })
                }
              />
            </div>
            <div>
              <button
                className="text-xs underline"
                type="button"
                onClick={() => removeGroup(index)}
                disabled={targetGroups.length === 1}
              >
                Remove group
              </button>
            </div>
          </div>
        ))}
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
          {loading ? "Saving..." : "Create survey"}
        </button>
      </div>
    </main>
  );
}
