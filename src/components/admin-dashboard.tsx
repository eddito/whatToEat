"use client";

import Link from "next/link";
import {
  Database,
  Eye,
  ImagePlus,
  ListChecks,
  LockKeyhole,
  Pencil,
  Save,
  Search,
  ShieldCheck,
  Star,
  Store,
  Trash2,
  Upload,
  UserPlus,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase";

type AdminRole = "owner" | "member" | "viewer";

type AdminSummary = {
  team: {
    name: string;
    slug: string;
  };
  currentUser: {
    id: string;
    role: AdminRole;
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
    role: AdminRole;
    joinedAt: string;
  }>;
};

type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "error";
type RequestState = "idle" | "loading" | "success" | "error";

type AdminMember = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  joinedAt: string;
};

type AdminMembersResponse = {
  members?: AdminMember[];
  canManage?: boolean;
  currentUserId?: string;
  error?: string;
};

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
  coverPhotoUrl?: string;
  photoCount: number;
};

type AdminPlacesResponse = {
  places?: AdminPlace[];
  canEdit?: boolean;
  error?: string;
};

type ListVisibility = "private" | "public_view" | "public_rate";

type AdminList = {
  id: string;
  databaseId: string;
  slug: string;
  name: string;
  description: string;
  visibility: ListVisibility;
  placeCount: number;
  createdAt: string;
};

type AdminListsResponse = {
  lists?: AdminList[];
  canManage?: boolean;
  error?: string;
};

type ListFormState = {
  name: string;
  description: string;
  visibility: ListVisibility;
};

type CreateListFormState = ListFormState & {
  slug: string;
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

const roleLabels: Record<AdminRole, string> = {
  owner: "Owner",
  member: "Member",
  viewer: "Viewer",
};

const visibilityLabels: Record<ListVisibility, string> = {
  private: "私密",
  public_view: "公开查看",
  public_rate: "开放评分",
};

const visibilityNotes: Record<ListVisibility, string> = {
  private: "仅小队成员可见。",
  public_view: "外部访客可查看，登录外部用户不可评分。",
  public_rate: "外部访客可查看，登录外部用户可评分。",
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

function toListForm(list: AdminList): ListFormState {
  return {
    name: list.name,
    description: list.description,
    visibility: list.visibility,
  };
}

function AdminListPermissions({ token, canManage }: { token: string; canManage: boolean }) {
  const [lists, setLists] = useState<AdminList[]>([]);
  const [selectedList, setSelectedList] = useState<AdminList | null>(null);
  const [form, setForm] = useState<ListFormState>({ name: "", description: "", visibility: "public_rate" });
  const [createForm, setCreateForm] = useState<CreateListFormState>({
    slug: "",
    name: "",
    description: "",
    visibility: "private",
  });
  const [loadState, setLoadState] = useState<RequestState>("loading");
  const [saveState, setSaveState] = useState<RequestState>("idle");
  const [createState, setCreateState] = useState<RequestState>("idle");
  const [deleteState, setDeleteState] = useState<RequestState>("idle");
  const [message, setMessage] = useState("");

  async function loadLists() {
    setLoadState("loading");
    setMessage("");

    const response = await fetch("/api/admin/lists", {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const result = (await response.json().catch(() => null)) as AdminListsResponse | null;

    if (!response.ok) {
      setLoadState("error");
      setMessage(result?.error ?? "榜单权限加载失败。");
      return;
    }

    const nextLists = result?.lists ?? [];
    setLists(nextLists);
    setLoadState("success");

    if (nextLists.length === 0) {
      setSelectedList(null);
      setForm({ name: "", description: "", visibility: "public_rate" });
      setMessage("暂无榜单。");
      return;
    }

    const nextSelected = selectedList
      ? nextLists.find((list) => list.id === selectedList.id) ?? nextLists[0]
      : nextLists[0];
    setSelectedList(nextSelected);
    setForm(toListForm(nextSelected));
  }

  useEffect(() => {
    void loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function selectList(list: AdminList) {
    setSelectedList(list);
    setForm(toListForm(list));
    setSaveState("idle");
    setDeleteState("idle");
    setMessage("");
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage) {
      return;
    }

    setCreateState("loading");
    setMessage("");

    const response = await fetch("/api/admin/lists", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(createForm),
    });
    const result = (await response.json().catch(() => null)) as { error?: string; message?: string; list?: AdminList } | null;

    if (!response.ok || !result?.list) {
      setCreateState("error");
      setMessage(result?.error ?? "榜单创建失败。");
      return;
    }

    setLists((current) => [...current, result.list as AdminList]);
    setSelectedList(result.list);
    setForm(toListForm(result.list));
    setCreateForm({ slug: "", name: "", description: "", visibility: "private" });
    setCreateState("success");
    setMessage(result.message ?? "榜单已创建。");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedList || !canManage) {
      return;
    }

    setSaveState("loading");
    setMessage("");

    const response = await fetch("/api/admin/lists", {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        listId: selectedList.id,
        name: form.name,
        description: form.description,
        visibility: form.visibility,
      }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string; message?: string; list?: AdminList } | null;

    if (!response.ok || !result?.list) {
      setSaveState("error");
      setMessage(result?.error ?? "榜单权限保存失败。");
      return;
    }

    setSaveState("success");
    setMessage(result.message ?? "榜单权限已保存。");
    setSelectedList(result.list);
    setForm(toListForm(result.list));
    setLists((current) => current.map((list) => (list.id === result.list?.id ? result.list : list)));
  }

  async function handleDelete() {
    if (!selectedList || !canManage) {
      return;
    }

    const confirmed = window.confirm(`删除榜单 ${selectedList.name}？榜单内的店铺不会被删除。`);

    if (!confirmed) {
      return;
    }

    setDeleteState("loading");
    setMessage("");

    const response = await fetch(`/api/admin/lists?listId=${encodeURIComponent(selectedList.id)}`, {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const result = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;

    if (!response.ok) {
      setDeleteState("error");
      setMessage(result?.error ?? "榜单删除失败。");
      return;
    }

    const nextLists = lists.filter((list) => list.id !== selectedList.id);
    const nextSelected = nextLists[0] ?? null;
    setLists(nextLists);
    setSelectedList(nextSelected);
    setForm(nextSelected ? toListForm(nextSelected) : { name: "", description: "", visibility: "public_rate" });
    setDeleteState("success");
    setMessage(result?.message ?? "榜单已删除。");
  }

  const isBusy = loadState === "loading" || saveState === "loading" || createState === "loading" || deleteState === "loading";

  return (
    <section className="container section">
      <div className="admin-panel">
        <div className="section-header tight">
          <div>
            <h2 className="section-title">榜单权限</h2>
            <p className="section-note">控制榜单是否公开、是否允许外部登录用户评分。</p>
          </div>
          <span className={canManage ? "admin-role-badge role-owner" : "admin-role-badge"}>
            <ShieldCheck aria-hidden="true" size={14} />
            {canManage ? "Owner 可管理" : "只读"}
          </span>
        </div>

        <div className="admin-list-permissions">
          <div className="admin-list-selector" aria-label="榜单列表">
            {loadState === "loading" ? (
              <p className="section-note">正在加载榜单...</p>
            ) : lists.length === 0 ? (
              <p className="section-note">暂无榜单。</p>
            ) : (
              lists.map((list) => (
                <button
                  aria-pressed={selectedList?.id === list.id}
                  className={selectedList?.id === list.id ? "admin-list-row active" : "admin-list-row"}
                  key={list.id}
                  onClick={() => selectList(list)}
                  type="button"
                >
                  <span className="task-icon">
                    <ListChecks aria-hidden="true" size={16} />
                  </span>
                  <span>
                    <strong>{list.name}</strong>
                    <small>{list.placeCount} 家店铺</small>
                  </span>
                  <span className={`admin-visibility-pill visibility-${list.visibility}`}>
                    {visibilityLabels[list.visibility]}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="admin-list-create-box">
            <strong>新建榜单</strong>
            <form className="admin-list-create-form" onSubmit={handleCreate}>
              <label className="field">
                <span>Slug</span>
                <input
                  disabled={!canManage || isBusy}
                  maxLength={48}
                  onChange={(event) => setCreateForm((current) => ({ ...current, slug: event.target.value }))}
                  placeholder="new-list"
                  required
                  value={createForm.slug}
                />
              </label>
              <label className="field">
                <span>名称</span>
                <input
                  disabled={!canManage || isBusy}
                  maxLength={40}
                  onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                  required
                  value={createForm.name}
                />
              </label>
              <label className="field">
                <span>状态</span>
                <select
                  disabled={!canManage || isBusy}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, visibility: event.target.value as ListVisibility }))
                  }
                  value={createForm.visibility}
                >
                  <option value="private">私密</option>
                  <option value="public_view">公开查看</option>
                  <option value="public_rate">开放评分</option>
                </select>
              </label>
              <button className="button secondary" disabled={!canManage || isBusy} type="submit">
                <ListChecks aria-hidden="true" size={16} />
                {createState === "loading" ? "创建中..." : "创建"}
              </button>
            </form>
          </div>

          <form className="admin-edit-form" onSubmit={handleSave}>
            <fieldset disabled={!selectedList || !canManage || isBusy}>
              <legend>{selectedList ? selectedList.name : "选择榜单"}</legend>

              <div className="admin-form-grid">
                <label className="field">
                  <span>榜单名称</span>
                  <input
                    maxLength={40}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    required
                    value={form.name}
                  />
                </label>
                <label className="field">
                  <span>公开状态</span>
                  <select
                    onChange={(event) =>
                      setForm((current) => ({ ...current, visibility: event.target.value as ListVisibility }))
                    }
                    value={form.visibility}
                  >
                    <option value="private">私密</option>
                    <option value="public_view">公开查看</option>
                    <option value="public_rate">开放评分</option>
                  </select>
                </label>
              </div>

              <label className="field">
                <span>说明</span>
                <textarea
                  maxLength={200}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                  value={form.description}
                />
              </label>
            </fieldset>

            <div className="admin-permission-preview">
              <div>
                <span className="task-icon">
                  <Eye aria-hidden="true" size={16} />
                </span>
                <strong>{visibilityLabels[form.visibility]}</strong>
                <p>{visibilityNotes[form.visibility]}</p>
              </div>
              <div>
                <span className="task-icon">
                  <UserRoundCheck aria-hidden="true" size={16} />
                </span>
                <strong>{canManage ? "可保存变更" : "需要 Owner"}</strong>
                <p>{canManage ? "保存后公开页和评分权限会立即按新状态生效。" : "当前角色只能查看榜单权限。"}</p>
              </div>
            </div>

            <div className="admin-form-footer">
              <p
                aria-live="polite"
                className={
                  saveState === "error" || loadState === "error" || createState === "error" || deleteState === "error"
                    ? "admin-inline-message error"
                    : saveState === "success" || createState === "success" || deleteState === "success"
                      ? "admin-inline-message success"
                      : "admin-inline-message"
                }
              >
                {message || (selectedList ? `创建于 ${formatDate(selectedList.createdAt)}` : "请选择一条榜单。")}
              </p>
              <button className="button auth-submit" disabled={!selectedList || !canManage || isBusy} type="submit">
                <Save aria-hidden="true" size={16} />
                {saveState === "loading" ? "保存中..." : "保存权限"}
              </button>
              <button
                className="button secondary member-remove-button"
                disabled={!selectedList || !canManage || isBusy || lists.length <= 1}
                onClick={handleDelete}
                type="button"
              >
                <Trash2 aria-hidden="true" size={15} />
                {deleteState === "loading" ? "删除中..." : "删除榜单"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

function AdminPlaceMaintenance({ token, canEdit }: { token: string; canEdit: boolean }) {
  const [places, setPlaces] = useState<AdminPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<AdminPlace | null>(null);
  const [form, setForm] = useState<PlaceFormState>(emptyPlaceForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [loadState, setLoadState] = useState<RequestState>("loading");
  const [saveState, setSaveState] = useState<RequestState>("idle");
  const [uploadState, setUploadState] = useState<RequestState>("idle");
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
    setUploadState("idle");
    setPhotoFile(null);
    setPhotoInputKey((current) => current + 1);
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

  async function handleUploadPhoto() {
    if (!selectedPlace || !canEdit || !photoFile) {
      return;
    }

    setUploadState("loading");
    setMessage("");

    const body = new FormData();
    body.append("placeId", selectedPlace.id);
    body.append("file", photoFile);

    const response = await fetch("/api/admin/photos", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
      },
      body,
    });
    const result = (await response.json().catch(() => null)) as {
      error?: string;
      message?: string;
      coverPhotoUrl?: string;
      photoCount?: number;
    } | null;

    if (!response.ok) {
      setUploadState("error");
      setMessage(result?.error ?? "图片上传失败。");
      return;
    }

    const nextPlace = {
      ...selectedPlace,
      coverPhotoUrl: result?.coverPhotoUrl ?? selectedPlace.coverPhotoUrl,
      photoCount: result?.photoCount ?? selectedPlace.photoCount + 1,
    };

    setSelectedPlace(nextPlace);
    setPlaces((current) => current.map((place) => (place.id === nextPlace.id ? nextPlace : place)));
    setPhotoFile(null);
    setPhotoInputKey((current) => current + 1);
    setUploadState("success");
    setMessage(result?.message ?? "图片已上传。");
  }

  const isBusy = loadState === "loading" || saveState === "loading" || uploadState === "loading";

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

              <div className="admin-photo-uploader">
                {selectedPlace?.coverPhotoUrl ? (
                  <img className="admin-photo-preview" src={selectedPlace.coverPhotoUrl} alt={`${selectedPlace.name}封面`} />
                ) : (
                  <div className="admin-photo-empty">
                    <ImagePlus aria-hidden="true" size={18} />
                    <span>暂无封面</span>
                  </div>
                )}
                <div className="admin-photo-controls">
                  <label className="field">
                    <span>店铺图片</span>
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      key={photoInputKey}
                      onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
                      type="file"
                    />
                  </label>
                  <button
                    className="button secondary"
                    disabled={!selectedPlace || !canEdit || !photoFile || isBusy}
                    onClick={handleUploadPhoto}
                    type="button"
                  >
                    <Upload aria-hidden="true" size={16} />
                    {uploadState === "loading" ? "上传中..." : "上传图片"}
                  </button>
                  <p className="section-note">{selectedPlace ? `${selectedPlace.photoCount} 张图片，支持 JPG / PNG / WebP。` : "请选择店铺。"}</p>
                </div>
              </div>
            </fieldset>

            <div className="admin-form-footer">
              <p
                aria-live="polite"
                className={
                  saveState === "error" || loadState === "error" || uploadState === "error"
                    ? "admin-inline-message error"
                    : saveState === "success" || uploadState === "success"
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

function AdminMemberManagement({ token, canManage }: { token: string; canManage: boolean }) {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [account, setAccount] = useState("");
  const [newRole, setNewRole] = useState<AdminRole>("member");
  const [passwordAccount, setPasswordAccount] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loadState, setLoadState] = useState<RequestState>("loading");
  const [saveState, setSaveState] = useState<RequestState>("idle");
  const [passwordState, setPasswordState] = useState<RequestState>("idle");
  const [message, setMessage] = useState("");

  async function loadMembers() {
    setLoadState("loading");
    setMessage("");

    const response = await fetch("/api/admin/members", {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const result = (await response.json().catch(() => null)) as AdminMembersResponse | null;

    if (!response.ok) {
      setLoadState("error");
      setMessage(result?.error ?? "成员列表加载失败。");
      return;
    }

    setMembers(result?.members ?? []);
    setCurrentUserId(result?.currentUserId ?? "");
    setLoadState("success");
  }

  useEffect(() => {
    void loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage || !account.trim()) {
      return;
    }

    setSaveState("loading");
    setMessage("");

    const response = await fetch("/api/admin/members", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        account,
        role: newRole,
      }),
    });
    const result = (await response.json().catch(() => null)) as AdminMembersResponse & { message?: string };

    if (!response.ok) {
      setSaveState("error");
      setMessage(result?.error ?? "成员添加失败。");
      return;
    }

    setMembers(result.members ?? []);
    setAccount("");
    setNewRole("member");
    setSaveState("success");
    setMessage(result.message ?? "成员已添加。");
  }

  async function handleRoleChange(member: AdminMember, role: AdminRole) {
    if (!canManage || member.id === currentUserId || member.role === role) {
      return;
    }

    setSaveState("loading");
    setMessage("");

    const response = await fetch("/api/admin/members", {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        userId: member.id,
        role,
      }),
    });
    const result = (await response.json().catch(() => null)) as AdminMembersResponse & { message?: string };

    if (!response.ok) {
      setSaveState("error");
      setMessage(result?.error ?? "成员角色保存失败。");
      return;
    }

    setMembers(result.members ?? []);
    setSaveState("success");
    setMessage(result.message ?? "成员角色已保存。");
  }

  async function handleRemoveMember(member: AdminMember) {
    if (!canManage || member.id === currentUserId) {
      return;
    }

    const confirmed = window.confirm(`移除成员 ${member.name}？`);

    if (!confirmed) {
      return;
    }

    setSaveState("loading");
    setMessage("");

    const response = await fetch(`/api/admin/members?userId=${encodeURIComponent(member.id)}`, {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const result = (await response.json().catch(() => null)) as AdminMembersResponse & { message?: string };

    if (!response.ok) {
      setSaveState("error");
      setMessage(result?.error ?? "成员移除失败。");
      return;
    }

    setMembers(result.members ?? []);
    setSaveState("success");
    setMessage(result.message ?? "成员已移除。");
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage || !passwordAccount.trim() || newPassword.length < 8) {
      return;
    }

    setPasswordState("loading");
    setMessage("");

    const response = await fetch("/api/admin/members/password", {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        account: passwordAccount,
        password: newPassword,
      }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;

    if (!response.ok) {
      setPasswordState("error");
      setMessage(result?.error ?? "密码重置失败。");
      return;
    }

    setPasswordAccount("");
    setNewPassword("");
    setPasswordState("success");
    setMessage(result?.message ?? "成员密码已重置。");
  }

  const isBusy = loadState === "loading" || saveState === "loading" || passwordState === "loading";

  return (
    <section className="container section">
      <div className="admin-panel">
        <div className="section-header tight">
          <div>
            <h2 className="section-title">成员</h2>
            <p className="section-note">Owner 可添加已有账号、调整角色和移除成员。</p>
          </div>
          <span className={canManage ? "admin-role-badge role-owner" : "admin-role-badge"}>
            <UsersRound aria-hidden="true" size={14} />
            {canManage ? "Owner 可管理" : "只读"}
          </span>
        </div>

        <form className="admin-member-add-form" onSubmit={handleAddMember}>
          <label className="field">
            <span>账号</span>
            <input
              disabled={!canManage || isBusy}
              onChange={(event) => setAccount(event.target.value)}
              placeholder="邮箱、手机号或用户名"
              type="text"
              value={account}
            />
          </label>
          <label className="field">
            <span>角色</span>
            <select
              disabled={!canManage || isBusy}
              onChange={(event) => setNewRole(event.target.value as AdminRole)}
              value={newRole}
            >
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
              <option value="owner">Owner</option>
            </select>
          </label>
          <button className="button secondary" disabled={!canManage || isBusy || !account.trim()} type="submit">
            <UserPlus aria-hidden="true" size={16} />
            {saveState === "loading" ? "添加中..." : "添加成员"}
          </button>
        </form>

        <form className="admin-member-password-form" onSubmit={handlePasswordReset}>
          <label className="field">
            <span>邮箱或手机号</span>
            <input
              disabled={!canManage || isBusy}
              inputMode="email"
              onChange={(event) => setPasswordAccount(event.target.value)}
              placeholder="仅支持邮箱或手机号"
              type="text"
              value={passwordAccount}
            />
          </label>
          <label className="field">
            <span>新密码</span>
            <input
              autoComplete="new-password"
              disabled={!canManage || isBusy}
              minLength={8}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="至少 8 位"
              type="password"
              value={newPassword}
            />
          </label>
          <button
            className="button secondary"
            disabled={!canManage || isBusy || !passwordAccount.trim() || newPassword.length < 8}
            type="submit"
          >
            <LockKeyhole aria-hidden="true" size={16} />
            {passwordState === "loading" ? "重置中..." : "重置密码"}
          </button>
        </form>

        <div className="member-table" role="table" aria-label="小队成员">
          <div className="member-row header" role="row">
            <span role="columnheader">成员</span>
            <span role="columnheader">角色</span>
            <span role="columnheader">加入</span>
            <span role="columnheader">操作</span>
          </div>
          {loadState === "loading" ? (
            <p className="section-note">正在加载成员...</p>
          ) : members.length === 0 ? (
            <p className="section-note">暂无成员。</p>
          ) : (
            members.map((member) => {
              const isSelf = member.id === currentUserId;

              return (
                <div className="member-row" key={member.id} role="row">
                  <span role="cell">
                    <strong>{member.name}</strong>
                    <small>{member.email || "未记录邮箱"}</small>
                  </span>
                  <span role="cell">
                    <select
                      aria-label={`${member.name} 角色`}
                      className="member-role-select"
                      disabled={!canManage || isBusy || isSelf}
                      onChange={(event) => void handleRoleChange(member, event.target.value as AdminRole)}
                      value={member.role}
                    >
                      <option value="owner">Owner</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </span>
                  <span role="cell">{formatDate(member.joinedAt)}</span>
                  <span role="cell">
                    <button
                      className="button secondary member-remove-button"
                      disabled={!canManage || isBusy || isSelf}
                      onClick={() => void handleRemoveMember(member)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={15} />
                      移除
                    </button>
                  </span>
                </div>
              );
            })
          )}
        </div>

        <p
          aria-live="polite"
          className={
            saveState === "error" || loadState === "error" || passwordState === "error"
              ? "admin-inline-message error"
              : saveState === "success" || passwordState === "success"
                ? "admin-inline-message success"
                : "admin-inline-message"
          }
        >
          {message || (canManage ? "修改会立即影响后台权限。" : "当前角色只能查看成员。")}
        </p>
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

      {token ? <AdminListPermissions canManage={summary.currentUser.role === "owner"} token={token} /> : null}

      {token ? <AdminPlaceMaintenance canEdit={summary.currentUser.role !== "viewer"} token={token} /> : null}

      {token ? <AdminMemberManagement canManage={summary.currentUser.role === "owner"} token={token} /> : null}
    </>
  );
}
