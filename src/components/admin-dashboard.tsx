"use client";

import Link from "next/link";
import {
  Database,
  ListChecks,
  LockKeyhole,
  Pencil,
  Save,
  Search,
  ShieldCheck,
  Star,
  Store,
  UsersRound,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase";

type AdminSummary = {
  team: {
    name: string;
    slug: string;
  };
  currentUser: {
    role: "owner" | "member" | "viewer";
    name: string;
  };
  stats: {
    places: number;
    lists: number;
    ratings: number;
    members: number;
  };
  members: Array<{
    name: string;
    role: "owner" | "member" | "viewer";
    joinedAt: string;
  }>;
};

type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "error";
type RequestState = "idle" | "loading" | "success" | "error";

type AdminPlace = {
  id: string;
  databaseId: string;
  name: string;
  category: string;
  tasteTags: string[];
  signatureDishes: string;
  review: string;
  region: string;
  locationLabel: string;
  parkingNote: string;
  sourceLabel: string;
  visited: boolean;
  geocodeStatus: string;
  updatedAt: string;
};

type AdminPlacesResponse = {
  places?: AdminPlace[];
  canEdit?: boolean;
  error?: string;
};

type PlaceFormState = {
  name: string;
  category: string;
  tasteTagsText: string;
  signatureDishes: string;
  review: string;
  region: string;
  locationLabel: string;
  parkingNote: string;
  sourceLabel: string;
  visited: boolean;
};

const roleLabels = {
  owner: "Owner",
  member: "Member",
  viewer: "Viewer",
};

const emptyPlaceForm: PlaceFormState = {
  name: "",
  category: "",
  tasteTagsText: "",
  signatureDishes: "",
  review: "",
  region: "",
  locationLabel: "",
  parkingNote: "",
  sourceLabel: "",
  visited: false,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toPlaceForm(place: AdminPlace): PlaceFormState {
  return {
    name: place.name,
    category: place.category,
    tasteTagsText: place.tasteTags.join("、"),
    signatureDishes: place.signatureDishes,
    review: place.review,
    region: place.region,
    locationLabel: place.locationLabel,
    parkingNote: place.parkingNote,
    sourceLabel: place.sourceLabel,
    visited: place.visited,
  };
}

function parseTasteTags(value: string) {
  return value
    .split(/[、,，\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function AdminPlaceMaintenance({ token, canEdit }: { token: string; canEdit: boolean }) {
  const [places, setPlaces] = useState<AdminPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<AdminPlace | null>(null);
  const [form, setForm] = useState<PlaceFormState>(emptyPlaceForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadState, setLoadState] = useState<RequestState>("loading");
  const [saveState, setSaveState] = useState<RequestState>("idle");
  const [message, setMessage] = useState("");

  async function loadPlaces(query = searchQuery) {
    setLoadState("loading");
    setMessage("");

    const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
    const response = await fetch(`/api/admin/places${params}`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const result = (await response.json().catch(() => null)) as AdminPlacesResponse | null;

    if (!response.ok) {
      setLoadState("error");
      setMessage(result?.error ?? "店铺列表加载失败。");
      return;
    }

    const nextPlaces = result?.places ?? [];
    setPlaces(nextPlaces);
    setLoadState("success");

    if (nextPlaces.length === 0) {
      setSelectedPlace(null);
      setForm(emptyPlaceForm);
      setMessage("没有匹配的店铺。");
      return;
    }

    const nextSelected = selectedPlace
      ? nextPlaces.find((place) => place.id === selectedPlace.id) ?? nextPlaces[0]
      : nextPlaces[0];
    setSelectedPlace(nextSelected);
    setForm(toPlaceForm(nextSelected));
  }

  useEffect(() => {
    void loadPlaces("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function selectPlace(place: AdminPlace) {
    setSelectedPlace(place);
    setForm(toPlaceForm(place));
    setSaveState("idle");
    setMessage("");
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadPlaces(searchQuery);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPlace || !canEdit) {
      return;
    }

    setSaveState("loading");
    setMessage("");

    const response = await fetch("/api/admin/places", {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        placeId: selectedPlace.id,
        name: form.name,
        category: form.category,
        tasteTags: parseTasteTags(form.tasteTagsText),
        signatureDishes: form.signatureDishes,
        review: form.review,
        region: form.region,
        locationLabel: form.locationLabel,
        parkingNote: form.parkingNote,
        sourceLabel: form.sourceLabel,
        visited: form.visited,
      }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string; message?: string; place?: AdminPlace } | null;

    if (!response.ok || !result?.place) {
      setSaveState("error");
      setMessage(result?.error ?? "店铺资料保存失败。");
      return;
    }

    setSaveState("success");
    setMessage(result.message ?? "店铺资料已保存。");
    setSelectedPlace(result.place);
    setForm(toPlaceForm(result.place));
    setPlaces((current) => current.map((place) => (place.id === result.place?.id ? result.place : place)));
  }

  const isBusy = loadState === "loading" || saveState === "loading";

  return (
    <section className="container section">
      <div className="admin-panel">
        <div className="section-header tight">
          <div>
            <h2 className="section-title">店铺维护</h2>
            <p className="section-note">基础资料、位置、标签和探店状态。</p>
          </div>
          <span className={canEdit ? "admin-role-badge role-member" : "admin-role-badge"}>
            <Pencil aria-hidden="true" size={14} />
            {canEdit ? "可编辑" : "只读"}
          </span>
        </div>

        <form className="admin-search-form" onSubmit={handleSearch}>
          <label className="field">
            <span>搜索店铺</span>
            <input
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="店名、类型或地区"
              type="search"
              value={searchQuery}
            />
          </label>
          <button className="button secondary" disabled={isBusy} type="submit">
            <Search aria-hidden="true" size={16} />
            搜索
          </button>
        </form>

        <div className="admin-place-editor">
          <div className="admin-place-list" aria-label="店铺列表">
            {loadState === "loading" ? (
              <p className="section-note">正在加载店铺...</p>
            ) : places.length === 0 ? (
              <p className="section-note">暂无店铺。</p>
            ) : (
              places.map((place) => (
                <button
                  aria-pressed={selectedPlace?.id === place.id}
                  className={selectedPlace?.id === place.id ? "admin-place-row active" : "admin-place-row"}
                  key={place.id}
                  onClick={() => selectPlace(place)}
                  type="button"
                >
                  <span className="task-icon">
                    <Store aria-hidden="true" size={16} />
                  </span>
                  <span>
                    <strong>{place.name}</strong>
                    <small>
                      {[place.category, place.region].filter(Boolean).join(" · ") || "资料待补"}
                    </small>
                  </span>
                  <span className={place.visited ? "admin-status-pill visited" : "admin-status-pill"}>
                    {place.visited ? "已探店" : "待探"}
                  </span>
                </button>
              ))
            )}
          </div>

          <form className="admin-edit-form" onSubmit={handleSave}>
            <fieldset disabled={!selectedPlace || !canEdit || isBusy}>
              <legend>{selectedPlace ? selectedPlace.name : "选择店铺"}</legend>

              <div className="admin-form-grid">
                <label className="field">
                  <span>店名</span>
                  <input
                    maxLength={80}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    required
                    value={form.name}
                  />
                </label>
                <label className="field">
                  <span>类型</span>
                  <input
                    maxLength={40}
                    onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                    value={form.category}
                  />
                </label>
                <label className="field">
                  <span>地区</span>
                  <input
                    maxLength={40}
                    onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))}
                    value={form.region}
                  />
                </label>
                <label className="field">
                  <span>来源</span>
                  <input
                    maxLength={80}
                    onChange={(event) => setForm((current) => ({ ...current, sourceLabel: event.target.value }))}
                    value={form.sourceLabel}
                  />
                </label>
              </div>

              <label className="field">
                <span>口味标签</span>
                <input
                  maxLength={120}
                  onChange={(event) => setForm((current) => ({ ...current, tasteTagsText: event.target.value }))}
                  value={form.tasteTagsText}
                />
              </label>

              <label className="field">
                <span>具体位置</span>
                <input
                  maxLength={160}
                  onChange={(event) => setForm((current) => ({ ...current, locationLabel: event.target.value }))}
                  value={form.locationLabel}
                />
              </label>

              <label className="field">
                <span>特色菜</span>
                <textarea
                  maxLength={200}
                  onChange={(event) => setForm((current) => ({ ...current, signatureDishes: event.target.value }))}
                  rows={2}
                  value={form.signatureDishes}
                />
              </label>

              <label className="field">
                <span>停车</span>
                <textarea
                  maxLength={160}
                  onChange={(event) => setForm((current) => ({ ...current, parkingNote: event.target.value }))}
                  rows={2}
                  value={form.parkingNote}
                />
              </label>

              <label className="field">
                <span>评价</span>
                <textarea
                  maxLength={800}
                  onChange={(event) => setForm((current) => ({ ...current, review: event.target.value }))}
                  rows={4}
                  value={form.review}
                />
              </label>

              <label className="admin-checkbox-field">
                <input
                  checked={form.visited}
                  onChange={(event) => setForm((current) => ({ ...current, visited: event.target.checked }))}
                  type="checkbox"
                />
                <span>已探店</span>
              </label>
            </fieldset>

            <div className="admin-form-footer">
              <p
                aria-live="polite"
                className={
                  saveState === "error" || loadState === "error"
                    ? "admin-inline-message error"
                    : saveState === "success"
                      ? "admin-inline-message success"
                      : "admin-inline-message"
                }
              >
                {message ||
                  (selectedPlace ? `最后更新 ${formatDateTime(selectedPlace.updatedAt)}` : "请选择一条店铺。")}
              </p>
              <button className="button auth-submit" disabled={!selectedPlace || !canEdit || isBusy} type="submit">
                <Save aria-hidden="true" size={16} />
                {saveState === "loading" ? "保存中..." : "保存资料"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

export function AdminDashboard() {
  const supabase = getBrowserSupabase();
  const [state, setState] = useState<LoadState>("loading");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadSummary() {
      if (!supabase) {
        setState("error");
        setMessage("缺少 Supabase 前端环境变量。");
        return;
      }

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        setToken("");
        setState("signed-out");
        return;
      }

      const response = await fetch("/api/admin/summary", {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
      const result = (await response.json().catch(() => null)) as AdminSummary | { error?: string } | null;

      if (!mounted) {
        return;
      }

      if (!response.ok) {
        setState(response.status === 403 ? "forbidden" : "error");
        setMessage(result && "error" in result ? result.error ?? "后台数据加载失败。" : "后台数据加载失败。");
        return;
      }

      setSummary(result as AdminSummary);
      setToken(token);
      setState("ready");
    }

    void loadSummary();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  if (state === "loading") {
    return (
      <section className="container section">
        <div className="admin-panel admin-state-panel">
          <strong>正在加载后台数据...</strong>
          <p className="section-note">会先确认登录状态和小队成员身份。</p>
        </div>
      </section>
    );
  }

  if (state === "signed-out") {
    return (
      <section className="container section">
        <div className="admin-panel admin-state-panel">
          <LockKeyhole aria-hidden="true" size={24} />
          <strong>需要登录</strong>
          <p className="section-note">后台只对小队成员开放。登录后会自动读取你的角色。</p>
          <Link className="button secondary" href="/login?next=/admin">
            去登录
          </Link>
        </div>
      </section>
    );
  }

  if (state === "forbidden" || state === "error" || !summary) {
    return (
      <section className="container section">
        <div className="admin-panel admin-state-panel">
          <ShieldCheck aria-hidden="true" size={24} />
          <strong>{state === "forbidden" ? "没有后台权限" : "后台暂时不可用"}</strong>
          <p className="section-note">{message || "请稍后重试。"}</p>
        </div>
      </section>
    );
  }

  const metrics = [
    { label: "店铺", value: summary.stats.places, icon: Database },
    { label: "榜单", value: summary.stats.lists, icon: ListChecks },
    { label: "评分", value: summary.stats.ratings, icon: Star },
    { label: "成员", value: summary.stats.members, icon: UsersRound },
  ];

  return (
    <>
      <section className="container section">
        <div className="admin-overview">
          <div>
            <span className="eyebrow">{summary.team.slug}</span>
            <h2 className="section-title">{summary.team.name}</h2>
            <p className="section-note">
              当前账号 {summary.currentUser.name}，角色 {roleLabels[summary.currentUser.role]}。
            </p>
          </div>
          <span className={`admin-role-badge role-${summary.currentUser.role}`}>
            <ShieldCheck aria-hidden="true" size={14} />
            {roleLabels[summary.currentUser.role]}
          </span>
        </div>
      </section>

      <section className="container section compact-section">
        <div className="admin-grid four">
          {metrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <div className="admin-panel admin-metric" key={metric.label}>
                <span className="task-icon">
                  <Icon aria-hidden="true" size={17} />
                </span>
                <span className="stat-value">{metric.value}</span>
                <span className="stat-label">{metric.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {token ? <AdminPlaceMaintenance canEdit={summary.currentUser.role !== "viewer"} token={token} /> : null}

      <section className="container section">
        <div className="admin-panel">
          <div className="section-header tight">
            <div>
              <h2 className="section-title">成员</h2>
              <p className="section-note">当前先开放只读成员列表，角色管理会在下一切片补上。</p>
            </div>
          </div>
          <div className="member-table" role="table" aria-label="小队成员">
            <div className="member-row header" role="row">
              <span role="columnheader">成员</span>
              <span role="columnheader">角色</span>
              <span role="columnheader">加入</span>
            </div>
            {summary.members.map((member) => (
              <div className="member-row" key={`${member.name}-${member.joinedAt}`} role="row">
                <span role="cell">
                  <strong>{member.name}</strong>
                </span>
                <span role="cell">{roleLabels[member.role]}</span>
                <span role="cell">{formatDate(member.joinedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
