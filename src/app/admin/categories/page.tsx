"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, FolderPlus, FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { Can, PageHeader } from "@/components/admin/page";
import { CategoryFormModal } from "@/components/admin/catalog-category-form";
import { catalogKeys, flattenCategories, MAX_CATEGORY_DEPTH, Thumb, useCategoryTree } from "@/components/admin/catalog-shared";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Modal, Spinner } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { CategoryNode } from "@/lib/types";

/** Returns a copy of the tree with the children of `parentId` in the given order. */
function reorderTree(nodes: CategoryNode[], parentId: string | null, orderedIds: string[]): CategoryNode[] {
  const sort = (list: CategoryNode[]) => orderedIds.map((id, i) => ({ ...list.find((n) => n.id === id)!, sortOrder: i }));
  if (parentId === null) return sort(nodes);
  return nodes.map((n) => (n.id === parentId ? { ...n, children: sort(n.children) } : { ...n, children: reorderTree(n.children, parentId, orderedIds) }));
}

export default function CategoriesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const canWrite = can("categories.write");
  const tree = useCategoryTree();
  const [editing, setEditing] = useState<{ id: string | null; parentId: string | null } | null>(null);
  const [deleting, setDeleting] = useState<CategoryNode | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const reorder = useMutation({
    mutationFn: (body: { parentId: string | null; orderedIds: string[] }) => api.put("/categories/reorder", body),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: catalogKeys.categories });
      const previous = qc.getQueryData<CategoryNode[]>(catalogKeys.categories);
      if (previous) qc.setQueryData(catalogKeys.categories, reorderTree(previous, body.parentId, body.orderedIds));
      return { previous };
    },
    onError: (err, _body, ctx) => {
      if (ctx?.previous) qc.setQueryData(catalogKeys.categories, ctx.previous);
      toast(errorMessage(err), "error");
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: catalogKeys.categories }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: () => {
      setDeleting(null);
      toast("Category deleted");
      void qc.invalidateQueries({ queryKey: catalogKeys.categories });
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });

  const move = (node: CategoryNode, siblings: CategoryNode[], delta: -1 | 1) => {
    const ids = siblings.map((s) => s.id);
    const from = ids.indexOf(node.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to]!, ids[from]!];
    reorder.mutate({ parentId: node.parentId, orderedIds: ids });
  };

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const all = flattenCategories(tree.data);
  const parents = all.filter((c) => c.children.length > 0);

  const renderLevel = (nodes: CategoryNode[]) => (
    <ul>
      {nodes.map((node, i) => {
        const open = !collapsed.has(node.id);
        const hasChildren = node.children.length > 0;
        return (
          <li key={node.id}>
            <div className="flex items-center gap-2 border-b border-black/[0.04] py-2.5 pr-3 hover:bg-black/[0.015] sm:gap-3" style={{ paddingLeft: 12 + node.depth * 24 }}>
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggle(node.id)}
                  aria-expanded={open}
                  aria-label={`${open ? "Collapse" : "Expand"} ${node.name}`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-ink/50 hover:bg-black/5"
                >
                  {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <span className="w-6 shrink-0" />
              )}
              <Thumb src={node.imageUrl} size={36} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span className="truncate">{node.name}</span>
                  {!node.isActive && <Badge>Hidden</Badge>}
                </p>
                <p className="truncate text-xs text-ink/45">
                  /{node.slug}
                  <span className="sm:hidden"> · {node.productCount ?? 0} products</span>
                </p>
              </div>
              <div className="hidden w-32 shrink-0 text-right text-xs text-ink/55 sm:block">
                {node.productCount ?? 0} product{node.productCount === 1 ? "" : "s"}
                {hasChildren && (
                  <span className="block text-ink/40">
                    {node.children.length} subcategor{node.children.length === 1 ? "y" : "ies"}
                  </span>
                )}
              </div>
              {canWrite && (
                <div className="flex shrink-0 items-center">
                  <IconButton label={`Move ${node.name} up`} disabled={i === 0 || reorder.isPending} onClick={() => move(node, nodes, -1)}>
                    <ArrowUp size={14} />
                  </IconButton>
                  <IconButton label={`Move ${node.name} down`} disabled={i === nodes.length - 1 || reorder.isPending} onClick={() => move(node, nodes, 1)}>
                    <ArrowDown size={14} />
                  </IconButton>
                  <IconButton label={`Add a subcategory to ${node.name}`} disabled={node.depth >= MAX_CATEGORY_DEPTH} onClick={() => setEditing({ id: null, parentId: node.id })}>
                    <FolderPlus size={14} />
                  </IconButton>
                  <IconButton label={`Edit ${node.name}`} onClick={() => setEditing({ id: node.id, parentId: node.parentId })}>
                    <Pencil size={14} />
                  </IconButton>
                  <IconButton label={`Delete ${node.name}`} onClick={() => setDeleting(node)}>
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              )}
            </div>
            {hasChildren && open && renderLevel(node.children)}
          </li>
        );
      })}
    </ul>
  );

  const blocked = deleting ? (deleting.children.length ? "Move or delete its subcategories first." : deleting.productCount ? `${deleting.productCount} product(s) use this category. Move them to another category first, or hide the category instead.` : null) : null;

  return (
    <>
      <PageHeader
        title="Categories"
        description="Organise the catalog into a tree of up to four levels. The order here is the storefront menu order."
        actions={
          <Can permission="categories.write">
            <Button icon={<Plus size={15} />} onClick={() => setEditing({ id: null, parentId: null })}>
              New category
            </Button>
          </Can>
        }
      />
      <Card
        padded={false}
        title={`${all.length} categor${all.length === 1 ? "y" : "ies"}`}
        actions={
          parents.length > 0 && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set())}>
                Expand all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set(parents.map((p) => p.id)))}>
                Collapse all
              </Button>
            </>
          )
        }
      >
        {tree.error ? (
          <ErrorState error={tree.error} retry={() => tree.refetch()} />
        ) : tree.isLoading ? (
          <Spinner />
        ) : !tree.data?.length ? (
          <EmptyState
            icon={<FolderTree size={22} />}
            title="No categories yet"
            body="Every product belongs to a category. Start with the shop's collections, such as Kurti Sets, Anarkali and Kids Wear."
            action={
              canWrite && (
                <Button size="sm" icon={<Plus size={14} />} onClick={() => setEditing({ id: null, parentId: null })}>
                  New category
                </Button>
              )
            }
          />
        ) : (
          <div className={clsx("overflow-x-auto", reorder.isPending && "cursor-progress")}>{renderLevel(tree.data)}</div>
        )}
      </Card>

      {editing && <CategoryFormModal categoryId={editing.id} defaultParentId={editing.parentId} tree={tree.data ?? []} onClose={() => setEditing(null)} />}
      {blocked ? (
        <Modal
          open
          size="sm"
          title={`${deleting?.name} can't be deleted yet`}
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                Close
              </Button>
              {deleting && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing({ id: deleting.id, parentId: deleting.parentId });
                    setDeleting(null);
                  }}
                >
                  Edit category
                </Button>
              )}
            </>
          }
        >
          <p className="text-sm text-ink/70">{blocked}</p>
        </Modal>
      ) : (
        <ConfirmDialog
          open={!!deleting}
          title={`Delete ${deleting?.name}?`}
          body="The category is removed permanently. This cannot be undone."
          confirmLabel="Delete"
          tone="danger"
          loading={remove.isPending}
          onConfirm={() => deleting && remove.mutate(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/55 hover:bg-black/5 hover:text-ink disabled:pointer-events-none disabled:opacity-25"
    >
      {children}
    </button>
  );
}
