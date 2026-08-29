"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  Database,
  Eye,
  GripVertical,
  ImagePlus,
  ListChecks,
  LockKeyhole,
  Pencil,
  RefreshCw,
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
import { useEffect, useState } from "react";
import type { DragEvent, FormEvent } from "react";
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

type AdminSummaryResponse = Partial<AdminSummary> & {
  ok?: boolean;
  error?: string;
  message?: string;
  summary?: {
    team: {
      id: string;
      name: string;
      slug: string;
      role: AdminRole;
    };
    counts: {
      lists: number;
      activePlaces: number;
      archivedPlaces: number;
      ratings: number;
      members: number;
    };
    generatedAt: string;
  };
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
  featuredDishes?: AdminPlaceDish[];
  supportsFeaturedDishes?: boolean;
};

type AdminPlaceDish = {
  id: string;
  name: string;
  description: string;
  photoUrl: string;
  sortOrder: number;
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

type AdminListPlace = {
  id: string;
  name: string;
  category: string;
  region: string;
  sortOrder: number;
  archivedAt: string | null;
};

type AdminListPlacesResponse = {
  places?: AdminListPlace[];
  error?: string;
  message?: string;
};

type AdminPlaceListAssignment = {
  id: string;
  databaseId: string;
  slug: string;
  name: string;
  visibility: ListVisibility;
  included: boolean;
  sortOrder: number;
};

type AdminPlaceListsResponse = {
  lists?: AdminPlaceListAssignment[];
  canEdit?: boolean;
  error?: string;
  message?: string;
};

type AdminImportPlan = {
  dryRun: true;
  sourceName: string;
  teamSlug: string;
  archiveMissing: boolean;
  summary: {
    listsCreated: number;
    listsUpdated: number;
    placesCreated: number;
    placesUpdated: number;
    listLinksCreated: number;
    listLinksUpdated: number;
    ratingsCreated: number;
    ratingsUpdated: number;
    ratingsSkipped: number;
    placesArchivedMissing: number;
  };
  counts: {
    seedPlaces: number;
    seedLists: number;
    importedRatings: number;
  };
};

type AdminImportBatch = {
  id: string;
  sourceName: string;
  operation: string;
  status: string;
  counts: {
    places: number;
    listPlaces: number;
    ratings: number;
  };
  createdAt: string;
  finishedAt: string | null;
  rolledBackAt: string | null;
};

type AdminImportRollbackPlan = {
  batch: AdminImportBatch;
  dryRun: true;
  impact: {
    ratingsToDelete: number;
    listPlacesToDelete: number;
    placesToArchive: number;
  };
  warnings: string[];
};

type AdminImportPlanResponse = {
  importPlan?: AdminImportPlan;
  error?: string;
  message?: string;
};

type AdminImportBatchesResponse = {
  importBatches?: AdminImportBatch[];
  error?: string;
  message?: string;
};

type AdminImportRollbackPlanResponse = {
  rollbackPlan?: AdminImportRollbackPlan;
  error?: string;
  message?: string;
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

const importStatusLabels: Record<string, string> = {
  completed: "已完成",
  failed: "失败",
  rolled_back: "已回滚",
  pending: "等待中",
  running: "运行中",
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

function normalizeAdminSummary(result: AdminSummaryResponse | null): AdminSummary | null {
  if (!result) {
    return null;
  }

  if (result.summary) {
    return {
      team: {
        name: result.summary.team.name,
        slug: result.summary.team.slug,
      },
      currentUser: result.currentUser ?? {
        id: "",
        role: result.summary.team.role,
        name: "当前账号",
      },
      stats: result.stats ?? {
        places: result.summary.counts.activePlaces,
        lists: result.summary.counts.lists,
        ratings: result.summary.counts.ratings,
        members: result.summary.counts.members,
      },
      members: result.members ?? [],
    };
  }

  if (result.team && result.currentUser && result.stats) {
    return {
      team: result.team,
      currentUser: result.currentUser,
      stats: result.stats,
      members: result.members ?? [],
    };
  }

  return null;
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

function normalizeAdminPlace(place: AdminPlace): AdminPlace {
  return {
    ...place,
    featuredDishes: place.featuredDishes ?? [],
    supportsFeaturedDishes: Array.isArray(place.featuredDishes),
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

function AdminListPermissions({
  token,
  canManage,
  canOrder,
}: {
  token: string;
  canManage: boolean;
  canOrder: boolean;
}) {
  const [lists, setLists] = useState<AdminList[]>([]);
  const [selectedList, setSelectedList] = useState<AdminList | null>(null);
  const [listPlaces, setListPlaces] = useState<AdminListPlace[]>([]);
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
  const [listPlacesState, setListPlacesState] = useState<RequestState>("idle");
  const [orderState, setOrderState] = useState<RequestState>("idle");
  const [message, setMessage] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const [draggedPlaceId, setDraggedPlaceId] = useState<string | null>(null);
  const [dragOverPlaceId, setDragOverPlaceId] = useState<string | null>(null);

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
      setListPlaces([]);
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

  async function loadListPlaces(list: AdminList) {
    setListPlacesState("loading");
    setOrderMessage("");

    const response = await fetch(`/api/admin/lists/${encodeURIComponent(list.slug)}/places`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const result = (await response.json().catch(() => null)) as AdminListPlacesResponse | null;

    if (!response.ok) {
      setListPlaces([]);
      setListPlacesState("error");
      setOrderMessage(result?.message ?? result?.error ?? "榜单店铺加载失败。");
      return;
    }

    setListPlaces((result?.places ?? []).sort((a, b) => a.sortOrder - b.sortOrder));
    setListPlacesState("success");
  }

  useEffect(() => {
    if (!selectedList) {
      setListPlaces([]);
      return;
    }

    void loadListPlaces(selectedList);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedList?.slug, token]);

  function selectList(list: AdminList) {
    setSelectedList(list);
    setForm(toListForm(list));
    setSaveState("idle");
    setDeleteState("idle");
    setOrderState("idle");
    setMessage("");
    setOrderMessage("");
  }

  function moveListPlace(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= listPlaces.length) {
      return;
    }

    setListPlaces((current) => {
      const next = [...current];
      const currentPlace = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = currentPlace;
      return next.map((place, nextIndex) => ({ ...place, sortOrder: nextIndex }));
    });
    setOrderState("idle");
    setOrderMessage("排序已调整，保存后生效。");
  }

  function moveListPlaceTo(draggedId: string, targetId: string) {
    if (!canOrder || draggedId === targetId) {
      return;
    }

    setListPlaces((current) => {
      const fromIndex = current.findIndex((place) => place.id === draggedId);
      const toIndex = current.findIndex((place) => place.id === targetId);

      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
        return current;
      }

      const next = [...current];
      const [draggedPlace] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, draggedPlace);
      return next.map((place, nextIndex) => ({ ...place, sortOrder: nextIndex }));
    });
    setOrderState("idle");
    setOrderMessage("排序已调整，保存后生效。");
  }

  function handleOrderDragStart(event: DragEvent<HTMLDivElement>, placeId: string) {
    if (!canOrder || isBusy) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", placeId);
    setDraggedPlaceId(placeId);
    setDragOverPlaceId(placeId);
  }

  function handleOrderDragOver(event: DragEvent<HTMLDivElement>, placeId: string) {
    if (!canOrder || isBusy || !draggedPlaceId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverPlaceId(placeId);
  }

  function handleOrderDrop(event: DragEvent<HTMLDivElement>, targetId: string) {
    if (!canOrder || isBusy) {
      return;
    }

    event.preventDefault();
    const draggedId = event.dataTransfer.getData("text/plain") || draggedPlaceId;

    if (draggedId) {
      moveListPlaceTo(draggedId, targetId);
    }

    setDraggedPlaceId(null);
    setDragOverPlaceId(null);
  }

  function handleOrderDragEnd() {
    setDraggedPlaceId(null);
    setDragOverPlaceId(null);
  }

  async function handleSaveListPlaceOrder() {
    if (!selectedList || !canOrder || listPlaces.length === 0) {
      return;
    }

    setOrderState("loading");
    setOrderMessage("");

    const response = await fetch(`/api/admin/lists/${encodeURIComponent(selectedList.slug)}/places/order`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        placeIds: listPlaces.map((place) => place.id),
      }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;

    if (!response.ok) {
      setOrderState("error");
      setOrderMessage(result?.message ?? result?.error ?? "榜单排序保存失败。");
      return;
    }

    setOrderState("success");
    setOrderMessage("榜单排序已保存。");
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

  const isBusy =
    loadState === "loading" ||
    saveState === "loading" ||
    createState === "loading" ||
    deleteState === "loading" ||
    orderState === "loading";

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

          <div className="admin-list-order-box">
            <div className="admin-place-lists-head">
              <div>
                <strong>榜单排序</strong>
                <p>{selectedList ? `${selectedList.name} · ${listPlaces.length} 家店铺` : "请选择榜单"}</p>
              </div>
              <button
                className="button secondary"
                disabled={!selectedList || !canOrder || isBusy || listPlaces.length <= 1}
                onClick={handleSaveListPlaceOrder}
                type="button"
              >
                <Save aria-hidden="true" size={16} />
                {orderState === "loading" ? "保存中..." : "保存排序"}
              </button>
            </div>

            {listPlacesState === "loading" ? (
              <p className="section-note">正在加载榜单店铺...</p>
            ) : listPlaces.length === 0 ? (
              <p className="section-note">当前榜单暂无店铺。</p>
            ) : (
              <div className="admin-list-order-rows" role="list">
                {listPlaces.map((place, index) => (
                  <div
                    aria-grabbed={draggedPlaceId === place.id}
                    className={`admin-list-order-row${draggedPlaceId === place.id ? " dragging" : ""}${
                      dragOverPlaceId === place.id && draggedPlaceId !== place.id ? " drag-over" : ""
                    }`}
                    draggable={canOrder && !isBusy}
                    key={place.id}
                    onDragEnd={handleOrderDragEnd}
                    onDragOver={(event) => handleOrderDragOver(event, place.id)}
                    onDragStart={(event) => handleOrderDragStart(event, place.id)}
                    onDrop={(event) => handleOrderDrop(event, place.id)}
                    role="listitem"
                  >
                    <span className="admin-list-order-index">{index + 1}</span>
                    <span aria-hidden="true" className="admin-list-order-grip">
                      <GripVertical size={16} />
                    </span>
                    <span className="admin-list-order-main">
                      <strong>{place.name}</strong>
                      <small>{[place.category, place.region].filter(Boolean).join(" · ") || "未记录分类地区"}</small>
                    </span>
                    <span className="admin-list-order-actions">
                      <button
                        aria-label={`${place.name} 上移`}
                        className="admin-icon-button"
                        disabled={!canOrder || isBusy || index === 0}
                        onClick={() => moveListPlace(index, -1)}
                        title="上移"
                        type="button"
                      >
                        <ArrowUp aria-hidden="true" size={16} />
                      </button>
                      <button
                        aria-label={`${place.name} 下移`}
                        className="admin-icon-button"
                        disabled={!canOrder || isBusy || index === listPlaces.length - 1}
                        onClick={() => moveListPlace(index, 1)}
                        title="下移"
                        type="button"
                      >
                        <ArrowDown aria-hidden="true" size={16} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}

            <p
              aria-live="polite"
              className={
                orderState === "error" || listPlacesState === "error"
                  ? "admin-inline-message error"
                  : orderState === "success"
                    ? "admin-inline-message success"
                    : "admin-inline-message"
              }
            >
              {orderMessage ||
                (canOrder ? "可拖动店铺行，或用上移/下移调整公开页面中的店铺顺序。" : "当前角色只能查看榜单排序。")}
            </p>
          </div>
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
  const [dishPhotoFile, setDishPhotoFile] = useState<File | null>(null);
  const [dishPhotoInputKey, setDishPhotoInputKey] = useState(0);
  const [dishName, setDishName] = useState("");
  const [dishDescription, setDishDescription] = useState("");
  const [placeLists, setPlaceLists] = useState<AdminPlaceListAssignment[]>([]);
  const [loadState, setLoadState] = useState<RequestState>("loading");
  const [saveState, setSaveState] = useState<RequestState>("idle");
  const [uploadState, setUploadState] = useState<RequestState>("idle");
  const [dishUploadState, setDishUploadState] = useState<RequestState>("idle");
  const [placeListState, setPlaceListState] = useState<RequestState>("idle");
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

    const nextPlaces = (result?.places ?? []).map(normalizeAdminPlace);
    setPlaces(nextPlaces);
    setLoadState("success");

    if (nextPlaces.length === 0) {
      setSelectedPlace(null);
      setForm(emptyPlaceForm);
      setPlaceLists([]);
      setPlaceListState("idle");
      setDishPhotoFile(null);
      setDishName("");
      setDishDescription("");
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

  async function loadPlaceLists(placeId: string) {
    setPlaceListState("loading");

    const response = await fetch(`/api/admin/place-lists?placeId=${encodeURIComponent(placeId)}`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const result = (await response.json().catch(() => null)) as AdminPlaceListsResponse | null;

    if (!response.ok) {
      setPlaceListState("error");
      setPlaceLists([]);
      setMessage(result?.error ?? "店铺榜单加载失败。");
      return;
    }

    setPlaceLists(result?.lists ?? []);
    setPlaceListState("success");
  }

  useEffect(() => {
    if (!selectedPlace) {
      return;
    }

    void loadPlaceLists(selectedPlace.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlace?.id, token]);

  function selectPlace(place: AdminPlace) {
    setSelectedPlace(place);
    setForm(toPlaceForm(place));
    setSaveState("idle");
    setUploadState("idle");
    setDishUploadState("idle");
    setPlaceListState("idle");
    setPlaceLists([]);
    setPhotoFile(null);
    setPhotoInputKey((current) => current + 1);
    setDishPhotoFile(null);
    setDishPhotoInputKey((current) => current + 1);
    setDishName("");
    setDishDescription("");
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

  async function handleUploadDishPhoto() {
    if (!selectedPlace || !canEdit || !dishPhotoFile) {
      return;
    }

    if (!selectedPlace.supportsFeaturedDishes) {
      setDishUploadState("error");
      setMessage("后端分支接入特色菜照片字段后即可保存。");
      return;
    }

    setDishUploadState("loading");
    setMessage("");

    const body = new FormData();
    body.append("file", dishPhotoFile);
    body.append("name", dishName.trim() || "特色菜");
    body.append("description", dishDescription.trim());
    body.append("sortOrder", String(selectedPlace.featuredDishes?.length ?? 0));

    const response = await fetch(`/api/admin/places/${encodeURIComponent(selectedPlace.id)}/dishes`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
      },
      body,
    });
    const result = (await response.json().catch(() => null)) as {
      error?: string;
      message?: string;
      dish?: AdminPlaceDish;
    } | null;

    if (!response.ok || !result?.dish) {
      setDishUploadState("error");
      setMessage(result?.message ?? result?.error ?? "特色菜照片上传失败。");
      return;
    }

    const nextDish: AdminPlaceDish = {
      id: result.dish.id,
      name: result.dish.name || dishName.trim() || "特色菜",
      description: result.dish.description || dishDescription.trim(),
      photoUrl: result.dish.photoUrl,
      sortOrder: result.dish.sortOrder ?? selectedPlace.featuredDishes?.length ?? 0,
    };
    const nextPlace = {
      ...selectedPlace,
      featuredDishes: [...(selectedPlace.featuredDishes ?? []), nextDish],
    };

    setSelectedPlace(nextPlace);
    setPlaces((current) => current.map((place) => (place.id === nextPlace.id ? nextPlace : place)));
    setDishPhotoFile(null);
    setDishPhotoInputKey((current) => current + 1);
    setDishName("");
    setDishDescription("");
    setDishUploadState("success");
    setMessage("特色菜照片已上传。");
  }

  function updatePlaceList(listId: string, updates: Partial<Pick<AdminPlaceListAssignment, "included" | "sortOrder">>) {
    setPlaceLists((current) => current.map((list) => (list.id === listId ? { ...list, ...updates } : list)));
    setPlaceListState("idle");
  }

  async function handleSavePlaceLists() {
    if (!selectedPlace || !canEdit) {
      return;
    }

    setPlaceListState("loading");
    setMessage("");

    const response = await fetch("/api/admin/place-lists", {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        placeId: selectedPlace.id,
        lists: placeLists.map((list) => ({
          listId: list.id,
          included: list.included,
          sortOrder: list.sortOrder,
        })),
      }),
    });
    const result = (await response.json().catch(() => null)) as AdminPlaceListsResponse | null;

    if (!response.ok) {
      setPlaceListState("error");
      setMessage(result?.error ?? "店铺榜单保存失败。");
      return;
    }

    setPlaceLists(result?.lists ?? []);
    setPlaceListState("success");
    setMessage(result?.message ?? "店铺榜单已保存。");
  }

  const isBusy =
    loadState === "loading" ||
    saveState === "loading" ||
    uploadState === "loading" ||
    dishUploadState === "loading" ||
    placeListState === "loading";

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

              <div className="admin-place-lists-box">
                <div className="admin-place-lists-head">
                  <strong>所属榜单</strong>
                  <p>勾选榜单并设置排序值，数字越小越靠前。</p>
                </div>

                {placeListState === "loading" ? (
                  <p className="section-note">正在加载店铺榜单...</p>
                ) : placeLists.length === 0 ? (
                  <p className="section-note">暂无可用榜单。</p>
                ) : (
                  <div className="admin-place-list-assignments">
                    {placeLists.map((list) => (
                      <label className="admin-place-list-assignment" key={list.id}>
                        <input
                          checked={list.included}
                          onChange={(event) => updatePlaceList(list.id, { included: event.target.checked })}
                          type="checkbox"
                        />
                        <span>
                          <strong>{list.name}</strong>
                          <small>{visibilityLabels[list.visibility]}</small>
                        </span>
                        <input
                          aria-label={`${list.name}排序`}
                          min={0}
                          onChange={(event) =>
                            updatePlaceList(list.id, { sortOrder: Number.parseInt(event.target.value || "0", 10) })
                          }
                          type="number"
                          value={list.sortOrder}
                        />
                      </label>
                    ))}
                  </div>
                )}

                <button
                  className="button secondary"
                  disabled={!selectedPlace || !canEdit || isBusy || placeLists.length === 0}
                  onClick={handleSavePlaceLists}
                  type="button"
                >
                  <ListChecks aria-hidden="true" size={16} />
                  {placeListState === "loading" ? "保存中..." : "保存榜单"}
                </button>
              </div>

              <div className="admin-photo-uploader">
                {selectedPlace?.coverPhotoUrl ? (
                  <Image
                    className="admin-photo-preview"
                    src={selectedPlace.coverPhotoUrl}
                    alt={`${selectedPlace.name}封面`}
                    width={480}
                    height={300}
                  />
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

              <div className="admin-dish-uploader">
                <div className="admin-place-lists-head">
                  <strong>特色菜照片</strong>
                  <p>为这家店补充菜品图片、名称和介绍，公开列表页会展示缩略图。</p>
                </div>

                {selectedPlace && (selectedPlace.featuredDishes?.length ?? 0) > 0 ? (
                  <div className="admin-dish-photo-grid" aria-label="已上传特色菜照片">
                    {(selectedPlace.featuredDishes ?? []).map((dish) => (
                      <span className="admin-dish-photo" key={dish.id}>
                        <Image src={dish.photoUrl} alt={dish.name || "特色菜"} width={120} height={90} />
                        <small>{dish.name || "特色菜"}</small>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="section-note">
                    {selectedPlace?.supportsFeaturedDishes ? "暂无特色菜照片。" : "后端分支接入特色菜照片字段后即可保存。"}
                  </p>
                )}

                <div className="admin-form-grid">
                  <label className="field">
                    <span>菜品名称</span>
                    <input
                      maxLength={80}
                      onChange={(event) => setDishName(event.target.value)}
                      placeholder="例如 招牌牛肉"
                      value={dishName}
                    />
                  </label>
                  <label className="field">
                    <span>菜品图片</span>
                    <input
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      capture="environment"
                      key={dishPhotoInputKey}
                      onChange={(event) => setDishPhotoFile(event.target.files?.[0] ?? null)}
                      type="file"
                    />
                  </label>
                </div>

                <label className="field">
                  <span>详情介绍</span>
                  <textarea
                    maxLength={400}
                    onChange={(event) => setDishDescription(event.target.value)}
                    placeholder="口味、推荐理由、份量或避雷点"
                    rows={3}
                    value={dishDescription}
                  />
                </label>

                <button
                  className="button secondary"
                  disabled={!selectedPlace || !canEdit || !selectedPlace.supportsFeaturedDishes || !dishPhotoFile || isBusy}
                  onClick={handleUploadDishPhoto}
                  type="button"
                >
                  <Upload aria-hidden="true" size={16} />
                  {dishUploadState === "loading" ? "上传中..." : "上传特色菜"}
                </button>
              </div>
            </fieldset>

            <div className="admin-form-footer">
              <p
                aria-live="polite"
                className={
                  saveState === "error" ||
                  loadState === "error" ||
                  uploadState === "error" ||
                  dishUploadState === "error" ||
                  placeListState === "error"
                    ? "admin-inline-message error"
                    : saveState === "success" ||
                        uploadState === "success" ||
                        dishUploadState === "success" ||
                        placeListState === "success"
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

function AdminImportOperations({ canManage, token }: { canManage: boolean; token: string }) {
  const [plan, setPlan] = useState<AdminImportPlan | null>(null);
  const [batches, setBatches] = useState<AdminImportBatch[]>([]);
  const [rollbackPlan, setRollbackPlan] = useState<AdminImportRollbackPlan | null>(null);
  const [loadState, setLoadState] = useState<RequestState>("idle");
  const [rollbackState, setRollbackState] = useState<RequestState>("idle");
  const [message, setMessage] = useState("");

  async function loadImportData() {
    if (!canManage) {
      return;
    }

    setLoadState("loading");
    setMessage("");

    const headers = {
      authorization: `Bearer ${token}`,
    };
    const [planResponse, batchesResponse] = await Promise.all([
      fetch("/api/admin/import-plan?archiveMissing=true", { headers }),
      fetch("/api/admin/import-batches?limit=5", { headers }),
    ]);
    const planResult = (await planResponse.json().catch(() => null)) as AdminImportPlanResponse | null;
    const batchesResult = (await batchesResponse.json().catch(() => null)) as AdminImportBatchesResponse | null;

    if (!planResponse.ok || !batchesResponse.ok) {
      setLoadState("error");
      setMessage(
        planResult?.message ??
          planResult?.error ??
          batchesResult?.message ??
          batchesResult?.error ??
          "导入运维数据加载失败。",
      );
      return;
    }

    setPlan(planResult?.importPlan ?? null);
    setBatches(batchesResult?.importBatches ?? []);
    setLoadState("success");
    setMessage("导入预检和批次记录已刷新。");
  }

  async function handleRollbackPlan(batchId: string) {
    setRollbackState("loading");
    setMessage("");

    const response = await fetch(`/api/admin/import-batches/${encodeURIComponent(batchId)}/rollback-plan`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const result = (await response.json().catch(() => null)) as AdminImportRollbackPlanResponse | null;

    if (!response.ok || !result?.rollbackPlan) {
      setRollbackState("error");
      setMessage(result?.message ?? result?.error ?? "回滚影响读取失败。");
      return;
    }

    setRollbackPlan(result.rollbackPlan);
    setRollbackState("success");
    setMessage("已读取只读回滚影响，不会修改数据。");
  }

  useEffect(() => {
    void loadImportData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, token]);

  if (!canManage) {
    return null;
  }

  const planMetrics = plan
    ? [
        { label: "种子店铺", value: plan.counts.seedPlaces },
        { label: "店铺更新", value: plan.summary.placesUpdated },
        { label: "评分更新", value: plan.summary.ratingsUpdated },
        { label: "将归档缺失", value: plan.summary.placesArchivedMissing },
      ]
    : [];

  return (
    <section className="container section compact-section">
      <div className="admin-panel admin-import-panel">
        <div className="admin-place-lists-head">
          <div>
            <strong>导入运维</strong>
            <p>Owner 可查看 seed dry-run 预检、最近导入批次和只读回滚影响。</p>
          </div>
          <button className="button secondary" disabled={loadState === "loading"} onClick={() => void loadImportData()} type="button">
            <RefreshCw aria-hidden="true" size={15} />
            {loadState === "loading" ? "刷新中..." : "刷新"}
          </button>
        </div>

        {plan ? (
          <div className="admin-import-plan" aria-label="导入预检">
            <div>
              <span className="eyebrow">{plan.sourceName}</span>
              <strong>只读 dry-run 预检</strong>
              <p>{plan.archiveMissing ? "已包含缺失项归档预估。" : "未包含缺失项归档预估。"}</p>
            </div>
            <div className="admin-import-metrics">
              {planMetrics.map((metric) => (
                <span key={metric.label}>
                  <strong>{metric.value}</strong>
                  <small>{metric.label}</small>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="section-note">{loadState === "loading" ? "正在读取导入预检..." : "暂无导入预检数据。"}</p>
        )}

        <div className="admin-import-batches" aria-label="最近导入批次">
          {batches.length === 0 ? (
            <p className="section-note">{loadState === "loading" ? "正在读取导入批次..." : "暂无导入批次。"}</p>
          ) : (
            batches.map((batch) => (
              <div className="admin-import-batch-row" key={batch.id}>
                <div>
                  <strong>{batch.sourceName}</strong>
                  <small>
                    {formatDateTime(batch.createdAt)} · {batch.operation} · {importStatusLabels[batch.status] ?? batch.status}
                  </small>
                </div>
                <div className="admin-import-batch-counts">
                  <span>{batch.counts.places} 店铺</span>
                  <span>{batch.counts.listPlaces} 关联</span>
                  <span>{batch.counts.ratings} 评分</span>
                </div>
                <button
                  className="button secondary"
                  disabled={rollbackState === "loading"}
                  onClick={() => void handleRollbackPlan(batch.id)}
                  type="button"
                >
                  查看影响
                </button>
              </div>
            ))
          )}
        </div>

        {rollbackPlan ? (
          <div className="admin-import-rollback" aria-label="只读回滚影响">
            <strong>只读回滚影响</strong>
            <div className="admin-import-metrics">
              <span>
                <strong>{rollbackPlan.impact.placesToArchive}</strong>
                <small>将归档店铺</small>
              </span>
              <span>
                <strong>{rollbackPlan.impact.listPlacesToDelete}</strong>
                <small>将删除关联</small>
              </span>
              <span>
                <strong>{rollbackPlan.impact.ratingsToDelete}</strong>
                <small>将删除评分</small>
              </span>
            </div>
            <p className="section-note">{rollbackPlan.warnings[0] ?? "该预览不会修改数据。"}</p>
          </div>
        ) : null}

        <p
          aria-live="polite"
          className={
            loadState === "error" || rollbackState === "error"
              ? "admin-inline-message error"
              : loadState === "success" || rollbackState === "success"
                ? "admin-inline-message success"
                : "admin-inline-message"
          }
        >
          {message || "这里只做只读预检；真实导入和回滚仍需人工确认后执行。"}
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
      const result = (await response.json().catch(() => null)) as AdminSummaryResponse | null;

      if (!mounted) {
        return;
      }

      if (!response.ok) {
        setState(response.status === 403 ? "forbidden" : "error");
        setMessage(result && "error" in result ? result.error ?? "后台数据加载失败。" : "后台数据加载失败。");
        return;
      }

      const nextSummary = normalizeAdminSummary(result);

      if (!nextSummary) {
        setState("error");
        setMessage("后台数据加载失败。");
        return;
      }

      setSummary(nextSummary);
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

      {token ? (
        <AdminListPermissions
          canManage={summary.currentUser.role === "owner"}
          canOrder={summary.currentUser.role !== "viewer"}
          token={token}
        />
      ) : null}

      {token ? <AdminPlaceMaintenance canEdit={summary.currentUser.role !== "viewer"} token={token} /> : null}

      {token ? <AdminImportOperations canManage={summary.currentUser.role === "owner"} token={token} /> : null}

      {token ? <AdminMemberManagement canManage={summary.currentUser.role === "owner"} token={token} /> : null}
    </>
  );
}
